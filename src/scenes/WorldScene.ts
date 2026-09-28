// Cena base de mapa: monta o tilemap (lógico + cenário real), cria o jogador, câmera, input (clique/WASD), saídas e
// mantém a lista de entidades. TownScene/FieldScene só adicionam o que é específico.

import Phaser from 'phaser';
import { CAMERA_SKY_MARGIN, HOLD_REPATH_MS, SKY_COLOR, TILE_SIZE } from '../config';
import { Entity, entityFromGameObject, type Point } from '../entities/Entity';
import { Player } from '../entities/Player';
import { BLOCKING_TILES, type MapDef, type MapExit, type Tile, type TileRect } from '../maps/types';
import type { Direction8 } from '../systems/directions';
import { gameEvents, type PointerInfo } from '../systems/events';
import { Interactions } from '../systems/interaction';
import { spawnNpcs } from '../systems/npcs';
import { findPath, nearestReachable, smoothPath, type WalkGrid } from '../systems/pathfinding';
import { spawnReturnStones } from '../systems/returnStones';
import { renderScenery } from '../systems/scenery';
import { session } from '../systems/session';
import { SkyBackground } from '../systems/sky';
import { TILESET_KEY } from '../systems/textures';
import { ClickMarker } from '../ui/ClickMarker';
import { DIALOG_SCENE_KEY } from '../ui/DialogScene';
import { Hud } from '../ui/Hud';

export interface TravelData {
  spawnId?: string;
  facing?: Direction8;
}

/** Raio do corpo (em tiles) usado para suavizar caminhos sem raspar em quinas. */
const PATH_BODY_RADIUS = 0.3;

/** Monstros mais perto que isso (px, entre os pés) se afastam aos poucos — evita empilhar no mesmo ponto. */
const MONSTER_SEPARATION = 26;
/** Velocidade máxima (px/s) do afastamento; fraca o bastante para não atrapalhar perseguição/ataque. */
const SEPARATION_SPEED = 50;

export interface PathOptions {
  /** Destino inalcançável (nuvem, outra margem) → vai até o tile alcançável mais perto dele. */
  closest?: boolean;
}

class TileWalkGrid implements WalkGrid {
  private readonly blocked: ReadonlySet<Tile> = new Set(BLOCKING_TILES);

  constructor(private readonly tiles: Tile[][]) {}

  get width(): number {
    return this.tiles[0]?.length ?? 0;
  }

  get height(): number {
    return this.tiles.length;
  }

  isBlocked(x: number, y: number): boolean {
    const tile = this.tiles[y]?.[x];
    return tile === undefined || this.blocked.has(tile);
  }
}

export class WorldScene extends Phaser.Scene {
  /** Cena de mapa ativa no momento (null durante o boot). */
  static current: WorldScene | null = null;

  player!: Player;
  grid!: WalkGrid;
  layer!: Phaser.Tilemaps.TilemapLayer;
  hud!: Hud;
  /** NPCs e objetos usáveis (Pedra de Retorno): clique leva até eles; tecla E usa o mais perto. */
  interactions!: Interactions;

  private readonly entitySet = new Set<Entity>();
  private spawnId = 'start';
  private arrivalFacing: Direction8 = 'south';
  private isTraveling = false;
  private holdingGround = false;
  private lastRepath = 0;
  private clickMarker!: ClickMarker;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private usingKeyboard = false;

  constructor(readonly mapDef: MapDef) {
    super({ key: mapDef.id });
  }

  init(data: TravelData): void {
    this.spawnId = data.spawnId && this.mapDef.spawns[data.spawnId] ? data.spawnId : 'start';
    if (!this.mapDef.spawns[this.spawnId]) this.spawnId = Object.keys(this.mapDef.spawns)[0] ?? 'start';
    this.arrivalFacing = data.facing ?? session.facing;
    this.isTraveling = false;
    this.holdingGround = false;
    this.usingKeyboard = false;
    this.entitySet.clear();
  }

  create(): void {
    WorldScene.current = this;
    const map = this.mapDef;
    const widthPx = map.width * TILE_SIZE;
    const heightPx = map.height * TILE_SIZE;

    this.cameras.main.setBackgroundColor(SKY_COLOR);
    const tilemap = this.make.tilemap({ data: map.tiles, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('Tileset não carregado');
    const layer = tilemap.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Falha ao criar camada do mapa');
    this.layer = layer.setDepth(-10);
    this.layer.setCollision([...BLOCKING_TILES]);
    // A camada lógica segue dando colisão; com a arte real carregada ela só fica invisível.
    const scenery = renderScenery(this, map);
    if (scenery) this.layer.setVisible(false);
    new SkyBackground(this, map, scenery);
    this.grid = new TileWalkGrid(map.tiles);
    this.physics.world.setBounds(0, 0, widthPx, heightPx);

    const spawn = map.spawns[this.spawnId] ?? { x: 1, y: 1 };
    const start = this.tileCenter(spawn.x, spawn.y);
    this.player = new Player(this, start.x, start.y, this.arrivalFacing);
    this.interactions = new Interactions(this);
    spawnReturnStones(this, this.interactions);
    spawnNpcs(this, this.interactions);

    const cam = this.cameras.main;
    // Um pouco de céu além da borda do mapa (física e pathfinding continuam limitados ao mapa).
    const m = CAMERA_SKY_MARGIN;
    cam.setBounds(-m, -m, widthPx + m * 2, heightPx + m * 2);
    cam.startFollow(this.player.sprite, true, 0.15, 0.15);
    cam.setRoundPixels(true);
    cam.fadeIn(250);

    this.clickMarker = new ClickMarker(this);
    this.hud = new Hud(this, map.name);
    this.setupInput();

    session.currentMapId = map.id;
    if (map.safe) session.lastSafePoint = { mapId: map.id, spawnId: map.spawns.start ? 'start' : this.spawnId };

    // O DisplayList já destruiu os sprites quando este handler roda; Entity.destroy() é
    // idempotente e emite entityRemoved mesmo assim. Na viagem normal, removeAllEntities()
    // já rodou antes do scene.start (ver travel()).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      session.facing = this.player.facing;
      this.removeAllEntities();
      if (WorldScene.current === this) WorldScene.current = null;
    });

    gameEvents.emit('mapEntered', { mapId: map.id, spawnId: this.spawnId, scene: this });
    // Diálogo acima de tudo (a UIScene é trazida para o topo no mapEntered).
    if (!this.scene.isActive(DIALOG_SCENE_KEY)) this.scene.launch(DIALOG_SCENE_KEY);
    this.scene.bringToTop(DIALOG_SCENE_KEY);
  }

  /** true do início de `travel()` até a cena ser desligada. */
  get traveling(): boolean {
    return this.isTraveling;
  }

  /** true enquanto o jogador está andando por WASD/setas (atualizado no início de cada update). */
  get keyboardMoving(): boolean {
    return this.usingKeyboard;
  }

  private removeAllEntities(): void {
    for (const entity of [...this.entitySet]) entity.destroy();
    this.entitySet.clear();
  }

  override update(time: number, delta: number): void {
    if (!this.isTraveling) {
      this.updateKeyboard();
      this.updateHold(time);
    }
    for (const entity of [...this.entitySet]) entity.update(time, delta);
    this.separateMonsters();
    if (!this.isTraveling) this.checkExits();
  }

  // ---------- API para entidades e gameplay ----------

  get entities(): ReadonlySet<Entity> {
    return this.entitySet;
  }

  registerEntity(entity: Entity): void {
    this.entitySet.add(entity);
    this.physics.add.collider(entity.sprite, this.layer);
  }

  unregisterEntity(entity: Entity): void {
    this.entitySet.delete(entity);
  }

  /** Entidades vivas dentro de um raio (px), opcionalmente filtradas por tipo. */
  entitiesInRadius(x: number, y: number, radius: number, kind?: Entity['kind']): Entity[] {
    const result: Entity[] = [];
    for (const e of this.entitySet) {
      if (e.dead || (kind && e.kind !== kind)) continue;
      if (Math.hypot(e.x - x, e.y - y) <= radius) result.push(e);
    }
    return result;
  }

  tileCenter(tx: number, ty: number): Point {
    return { x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE };
  }

  isWalkable(x: number, y: number): boolean {
    return !this.grid.isBlocked(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
  }

  /** Caminho em px de (fromX, fromY) até (toX, toY), sem o ponto inicial. null = inalcançável. */
  findWorldPath(fromX: number, fromY: number, toX: number, toY: number, options: PathOptions = {}): Point[] | null {
    const start = { x: Math.floor(fromX / TILE_SIZE), y: Math.floor(fromY / TILE_SIZE) };
    const goal = { x: Math.floor(toX / TILE_SIZE), y: Math.floor(toY / TILE_SIZE) };
    const blockedGoal = this.grid.isBlocked(goal.x, goal.y);
    let tiles = options.closest && blockedGoal ? null : findPath(this.grid, start, goal);
    if (!tiles && options.closest) {
      // Nunca "cai" numa saída sem querer (ex.: clicar na nuvem ao lado da ponte); só clicando nela.
      const nearest = nearestReachable(this.grid, start, goal, (t) => !this.exitAt(t.x, t.y));
      tiles = findPath(this.grid, start, nearest);
    }
    if (!tiles) return null;
    const last = tiles[tiles.length - 1]!;
    const exact = last.x === goal.x && last.y === goal.y;
    const points = [
      { x: fromX / TILE_SIZE, y: fromY / TILE_SIZE },
      ...tiles.slice(1).map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 })),
    ];
    const finalPoint = exact ? { x: toX / TILE_SIZE, y: toY / TILE_SIZE } : { x: last.x + 0.5, y: last.y + 0.5 };
    if (points.length > 1) points[points.length - 1] = finalPoint;
    else points.push(finalPoint);
    return smoothPath(this.grid, points, PATH_BODY_RADIUS).map((p) => ({ x: p.x * TILE_SIZE, y: p.y * TILE_SIZE }));
  }

  /** Ponto (px, centro de tile) livre aleatório dentro de uma área em tiles. */
  randomWalkablePointIn(area: TileRect, rng: () => number = Math.random): Point | null {
    for (let i = 0; i < 40; i++) {
      const tx = area.x + Math.floor(rng() * area.w);
      const ty = area.y + Math.floor(rng() * area.h);
      if (!this.grid.isBlocked(tx, ty)) return this.tileCenter(tx, ty);
    }
    return null;
  }

  /**
   * Troca de mapa com fade, levando a direção do jogador. `traveling` vira true e `mapExiting`
   * é emitido antes do fade começar (o gameplay deve congelar IA/dano a partir daí).
   */
  travel(toMap: string, toSpawn: string): void {
    if (this.isTraveling) return;
    this.isTraveling = true;
    this.holdingGround = false;
    this.usingKeyboard = false;
    this.player.stop();
    const data: TravelData = { spawnId: toSpawn, facing: this.player.facing };
    gameEvents.emit('mapExiting', { fromMapId: this.mapDef.id, toMapId: toMap, toSpawnId: toSpawn, scene: this });
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      session.facing = this.player.facing;
      // Remove as entidades com a cena ainda viva (sprites intactos) antes do shutdown.
      this.removeAllEntities();
      this.scene.start(toMap, data);
    });
    this.cameras.main.fadeOut(250);
  }

  /** Volta ao último mapa seguro (usado na morte do jogador). */
  returnToLastSafePoint(): void {
    const { mapId, spawnId } = session.lastSafePoint;
    this.travel(mapId, spawnId);
  }

  // ---------- Input ----------

  private setupInput(): void {
    this.input.mouse?.disableContextMenu();
    const keyboard = this.input.keyboard;
    if (keyboard) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = keyboard.addKeys(
        { up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D },
        false,
      ) as typeof this.keys;
    }

    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        // Só o botão esquerdo age (entidade ou chão); os demais são ignorados.
        if (this.isTraveling || pointer.button !== 0) return;
        const info: PointerInfo = { worldX: pointer.worldX, worldY: pointer.worldY, button: pointer.button };
        const target = over.map(entityFromGameObject).find((e) => e && e.kind !== 'player' && !e.dead);
        if (target) {
          this.holdingGround = false;
          gameEvents.emit('entityClicked', { entity: target, pointer: info });
          return;
        }
        const usable = this.interactions.findIn(over);
        if (usable) {
          this.holdingGround = false;
          this.interactions.approach(usable);
          return;
        }
        this.holdingGround = true;
        this.lastRepath = this.time.now;
        if (this.player.moveTo(pointer.worldX, pointer.worldY, { closest: true })) {
          // Clique em nuvem/obstáculo: o marcador vai para onde o jogador realmente vai parar.
          const end = this.isWalkable(pointer.worldX, pointer.worldY) ? null : this.player.currentPath.at(-1);
          this.clickMarker.show(end?.x ?? pointer.worldX, end?.y ?? pointer.worldY);
        }
        gameEvents.emit('groundClicked', { x: pointer.worldX, y: pointer.worldY, pointer: info });
      },
    );
    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      this.holdingGround = false;
    });
  }

  private updateHold(time: number): void {
    const pointer = this.input.activePointer;
    if (!this.holdingGround || !pointer.isDown) return;
    if (time - this.lastRepath < HOLD_REPATH_MS) return;
    this.lastRepath = time;
    pointer.updateWorldPoint(this.cameras.main);
    this.player.moveTo(pointer.worldX, pointer.worldY, { closest: true });
  }

  private updateKeyboard(): void {
    if (!this.keys) return;
    const k = this.keys;
    const dx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const dy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.holdingGround = false;
      this.usingKeyboard = true;
      this.player.setManualVelocity({ x: (dx / len) * this.player.speed, y: (dy / len) * this.player.speed });
    } else if (this.usingKeyboard) {
      this.usingKeyboard = false;
      this.player.stop();
    }
  }

  /** Empurrão suave entre monstros sobrepostos (soma na velocidade do frame; não mexe em caminhos). */
  private separateMonsters(): void {
    const monsters = [...this.entitySet].filter((e) => e.kind === 'monster' && !e.dead);
    for (let i = 0; i < monsters.length; i++) {
      for (let j = i + 1; j < monsters.length; j++) {
        const a = monsters[i]!;
        const b = monsters[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= MONSTER_SEPARATION) continue;
        if (dist < 0.01) {
          // Exatamente no mesmo ponto: direção fixa pelos ids para desempatar.
          const angle = (a.id * 2.399 + b.id) % (Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        const push = SEPARATION_SPEED * (1 - Math.min(dist, MONSTER_SEPARATION) / MONSTER_SEPARATION);
        const nx = (dx / dist) * push;
        const ny = (dy / dist) * push;
        const va = (a.sprite.body as Phaser.Physics.Arcade.Body).velocity;
        const vb = (b.sprite.body as Phaser.Physics.Arcade.Body).velocity;
        va.x -= nx;
        va.y -= ny;
        vb.x += nx;
        vb.y += ny;
      }
    }
  }

  private exitAt(tx: number, ty: number): MapExit | undefined {
    return this.mapDef.exits.find(({ area: a }) => tx >= a.x && tx < a.x + a.w && ty >= a.y && ty < a.y + a.h);
  }

  private checkExits(): void {
    const exit = this.exitAt(this.player.tileX, this.player.tileY);
    if (exit) this.travel(exit.toMap, exit.toSpawn);
  }
}
