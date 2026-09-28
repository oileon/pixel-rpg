// Entidade base: sprite com física arcade, posição nos pés, direção (8 sentidos), movimento por
// caminho ou velocidade manual e animação automática (idle/walk) conforme o manifesto.

import Phaser from 'phaser';
import { animKey, textureKey, type AnimState, type VisualDef } from '../assets/manifest';
import { TILE_SIZE } from '../config';
import { vectorToDirection, type Direction8 } from '../systems/directions';
import { gameEvents } from '../systems/events';
import type { PathOptions, WorldScene } from '../scenes/WorldScene';

export type EntityKind = 'player' | 'monster' | 'npc';

export interface Point {
  x: number;
  y: number;
}

const entityByObject = new WeakMap<Phaser.GameObjects.GameObject, Entity>();

/** Entidade dona de um GameObject (ex.: resultado de input `currentlyOver`). */
export function entityFromGameObject(obj: Phaser.GameObjects.GameObject): Entity | undefined {
  return entityByObject.get(obj);
}

let nextEntityId = 1;

const STUCK_CHECK_MS = 400;
const STUCK_MIN_DISTANCE = 1;

export class Entity {
  /** Id único da instância (não confundir com o id de definição do monstro). */
  readonly id = nextEntityId++;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  facing: Direction8;
  /** Velocidade de movimento em px/s. */
  speed: number;
  dead = false;

  private path: Point[] = [];
  private manualVelocity: Point | null = null;
  private moving = false;
  private isRemoved = false;
  private currentAnim = '';
  private stuckTimer = 0;
  private stuckFrom: Point = { x: 0, y: 0 };
  /** Animação de ação (ex.: ataque) tocando por cima de idle/walk até este instante. */
  private actionUntil = 0;
  /** Hit-stop: animação pausada até este instante. */
  private animFrozenUntil = 0;
  private animFrozen = false;
  private readonly frameSize: { w: number; h: number };
  private readonly baseOrigin: Point;
  private readonly baseBodyOffset: Point;

  constructor(
    readonly world: WorldScene,
    readonly kind: EntityKind,
    readonly visual: VisualDef,
    x: number,
    y: number,
    options: { facing?: Direction8; speed?: number } = {},
  ) {
    this.facing = options.facing ?? 'south';
    this.speed = options.speed ?? 100;

    const source = visual.source;
    const frameH = source.kind === 'placeholder' ? source.height : source.frameHeight;
    const frameW = source.kind === 'placeholder' ? source.width : source.frameWidth;

    this.sprite = world.physics.add.sprite(x, y, textureKey.placeholder(visual.key));
    this.frameSize = { w: frameW, h: frameH };
    this.baseOrigin = { x: 0.5, y: visual.feetY / frameH };
    this.sprite.setOrigin(this.baseOrigin.x, this.baseOrigin.y);
    entityByObject.set(this.sprite, this);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(visual.body.width, visual.body.height, false);
    this.baseBodyOffset = { x: frameW / 2 - visual.body.width / 2, y: visual.feetY - visual.body.height / 2 };
    body.setOffset(this.baseBodyOffset.x, this.baseBodyOffset.y);
    body.setCollideWorldBounds(true);

    this.showStatic();
    this.sprite.setDepth(y);
    world.registerEntity(this);
    gameEvents.emit('entitySpawned', { entity: this });
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get tileX(): number {
    return Math.floor(this.sprite.x / TILE_SIZE);
  }

  get tileY(): number {
    return Math.floor(this.sprite.y / TILE_SIZE);
  }

  get isMoving(): boolean {
    return this.moving;
  }

  /** Waypoints restantes (cópia). */
  get currentPath(): Point[] {
    return this.path.map((p) => ({ ...p }));
  }

  distanceTo(other: Point): number {
    return Math.hypot(other.x - this.x, other.y - this.y);
  }

  /**
   * Anda até (x, y) desviando de obstáculos. Retorna false se não há caminho.
   * `closest`: destino inalcançável vira o tile alcançável mais perto dele (clique do jogador).
   */
  moveTo(x: number, y: number, options: PathOptions = {}): boolean {
    if (this.dead) return false;
    const path = this.world.findWorldPath(this.x, this.y, x, y, options);
    if (!path) return false;
    this.manualVelocity = null;
    this.path = path;
    return true;
  }

  /** Segue uma lista de pontos (px) em linha reta entre eles, sem pathfinding. */
  moveAlong(points: readonly Point[]): void {
    this.manualVelocity = null;
    this.path = points.map((p) => ({ ...p }));
  }

  /** Velocidade direta (ex.: WASD). Cancela o caminho atual. `null` volta ao controle por caminho. */
  setManualVelocity(velocity: Point | null): void {
    this.manualVelocity = velocity;
    if (velocity) this.path = [];
  }

  stop(): void {
    this.path = [];
    this.manualVelocity = null;
    this.sprite.setVelocity(0, 0);
  }

  face(dir: Direction8): void {
    this.facing = dir;
  }

  faceTowards(x: number, y: number): void {
    this.facing = vectorToDirection(x - this.x, y - this.y) ?? this.facing;
  }

  /**
   * Toca uma animação de ação (ex.: 'attack') na direção atual por `durationMs`, por cima de
   * idle/walk (andar a interrompe). Retorna false se a animação não existe no manifesto.
   */
  playAction(state: string, durationMs: number): boolean {
    if (this.dead || this.visual.source.kind !== 'sheet') return false;
    const key = animKey(this.visual.key, state as AnimState, this.facing);
    const anim = this.world.anims.get(key);
    if (!anim || anim.frames.length === 0) return false;
    this.sprite.anims.play({ key, duration: durationMs, repeat: 0 });
    this.currentAnim = key;
    this.actionUntil = this.world.time.now + durationMs;
    this.animFrozen = false;
    return true;
  }

  /** Hit-stop: congela o quadro atual por `ms`. A ação em curso é estendida pelo mesmo tempo. */
  freezeAnimation(ms: number): void {
    if (this.dead || ms <= 0) return;
    const now = this.world.time.now;
    if (this.actionUntil > now) this.actionUntil += ms;
    this.animFrozenUntil = Math.max(this.animFrozenUntil, now + ms);
    if (this.sprite.anims.isPlaying) {
      this.sprite.anims.pause();
      this.animFrozen = true;
    }
  }

  /**
   * Desloca só o desenho (px), sem mexer na posição lógica nem na colisão (origem e offset do
   * corpo mudam juntos). Usado no avanço do ataque e no recuo ao levar golpe.
   */
  setVisualOffset(dx: number, dy: number): void {
    if (!this.sprite.scene) return;
    this.sprite.setOrigin(this.baseOrigin.x - dx / this.frameSize.w, this.baseOrigin.y - dy / this.frameSize.h);
    (this.sprite.body as Phaser.Physics.Arcade.Body | null)?.setOffset(this.baseBodyOffset.x - dx, this.baseBodyOffset.y - dy);
  }

  /** Chamado pela cena a cada frame. */
  update(time: number, delta: number): void {
    if (this.dead) return;
    let vx = 0;
    let vy = 0;
    const dt = delta / 1000;

    if (this.manualVelocity) {
      vx = this.manualVelocity.x;
      vy = this.manualVelocity.y;
    } else {
      while (this.path.length > 0) {
        const target = this.path[0]!;
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= Math.max(0.5, this.speed * dt)) {
          // Chegou ao waypoint: encaixa e segue para o próximo no mesmo frame.
          (this.sprite.body as Phaser.Physics.Arcade.Body).reset(target.x, target.y);
          this.path.shift();
          continue;
        }
        vx = (dx / dist) * this.speed;
        vy = (dy / dist) * this.speed;
        break;
      }
    }

    this.sprite.setVelocity(vx, vy);
    const wasMoving = this.moving;
    this.moving = vx !== 0 || vy !== 0;
    if (this.moving) this.facing = vectorToDirection(vx, vy) ?? this.facing;

    this.checkStuck(delta);
    this.updateVisual(time);
    this.sprite.setDepth(this.sprite.y);
    if (wasMoving !== this.moving) this.onMovingChanged(this.moving);
  }

  /** Gancho para subclasses. */
  protected onMovingChanged(_moving: boolean): void {}

  /** Mata a entidade: emite `entityDied`, some com fade e é destruída. */
  die(): void {
    if (this.dead) return;
    this.stop();
    this.dead = true;
    (this.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    this.sprite.disableInteractive();
    gameEvents.emit('entityDied', { entity: this });
    this.world.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 400,
      onComplete: () => this.destroy(),
    });
  }

  /** true depois de `destroy()` (a entidade saiu da cena e não deve mais ser usada). */
  get removed(): boolean {
    return this.isRemoved;
  }

  /**
   * Remove da cena sem animação. Idempotente: marca `dead`, sai do registro da cena e emite
   * `entityRemoved` uma única vez, mesmo se o sprite já tiver sido destruído pelo Phaser.
   */
  destroy(): void {
    if (this.isRemoved) return;
    this.isRemoved = true;
    this.dead = true;
    this.path = [];
    this.manualVelocity = null;
    this.world.unregisterEntity(this);
    if (this.sprite.scene) this.sprite.destroy();
    gameEvents.emit('entityRemoved', { entity: this });
  }

  private checkStuck(delta: number): void {
    if (!this.moving || this.manualVelocity || this.path.length === 0) {
      this.stuckTimer = 0;
      this.stuckFrom = { x: this.x, y: this.y };
      return;
    }
    this.stuckTimer += delta;
    if (this.stuckTimer >= STUCK_CHECK_MS) {
      if (this.distanceTo(this.stuckFrom) < STUCK_MIN_DISTANCE) this.stop();
      this.stuckTimer = 0;
      this.stuckFrom = { x: this.x, y: this.y };
    }
  }

  private updateVisual(time: number): void {
    const now = this.world.time.now;
    if (this.animFrozen) {
      if (now < this.animFrozenUntil) return;
      this.animFrozen = false;
      this.sprite.anims.resume();
    }
    if (this.actionUntil > 0) {
      if (!this.moving && now < this.actionUntil) return;
      // Fim da ação (ou começou a andar): volta para idle/walk.
      this.actionUntil = 0;
      this.currentAnim = '';
    }
    const state: AnimState = this.moving ? 'walk' : 'idle';
    const source = this.visual.source;

    if (source.kind === 'sheet') {
      const key = animKey(this.visual.key, state, this.facing);
      if (this.world.anims.exists(key)) {
        if (this.currentAnim !== key) {
          this.sprite.anims.play(key, true);
          this.currentAnim = key;
        }
        return;
      }
      this.currentAnim = '';
      this.sprite.anims.stop();
    }
    this.showStatic();
    // Sem animação de andar: "quique" procedural.
    const bob = this.moving ? 1 + 0.08 * Math.sin(time / 70) : 1;
    this.sprite.setScale(1 / Math.sqrt(bob), bob);
  }

  private showStatic(): void {
    const source = this.visual.source;
    const key = this.visual.key;
    const textures = this.world.textures;
    if (source.kind === 'sheet' && textures.exists(textureKey.sheet(key))) {
      const col = source.directionOrder.indexOf(this.facing);
      this.sprite.setTexture(textureKey.sheet(key), source.rotationRow * source.columns + Math.max(0, col));
    } else if (source.kind === 'rotations' && textures.exists(textureKey.rotation(key, this.facing))) {
      this.sprite.setTexture(textureKey.rotation(key, this.facing));
    } else {
      // Placeholder (ou asset que falhou ao carregar).
      this.sprite.setTexture(textureKey.placeholder(key));
      this.sprite.setFlipX(this.facing.includes('west'));
    }
  }
}
