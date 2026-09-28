// Liga os sistemas de gameplay a uma cena de mapa: combate por clique, IA de combate dos monstros,
// morte/Fadiga, regeneração e itens no chão. Uma instância por cena (criada no `mapEntered`).
//
// Trocar de mapa descarta itens no chão e o estado dos monstros (HP, aggro) — intencional, estilo RO.

import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { FEEL, getItem, getMonster, getSeal, hasSeal } from '../data';
import type { MonsterDef } from '../data/types';
import type { Entity, Point } from '../entities/Entity';
import { Monster } from '../entities/Monster';
import type { WorldScene } from '../scenes/WorldScene';
import type { EntityAI } from '../systems/ai';
import { monsterCombatStats, resolveAttack, type AttackResult } from '../systems/combat';
import { gameEvents } from '../systems/events';
import { worldToScreen } from '../systems/feel';
import type { DroppedItem } from '../systems/loot';
import { session } from '../systems/session';
import { attackDelayMs } from '../systems/stats';
import { TILE_SIZE } from '../config';
import { floatText } from '../ui/floatingText';
import { fatigueNotice } from '../ui/format';
import { ensureItemIcons, itemIconKey, rarityCss, RARITY_COLORS } from '../ui/itemIcons';
import {
  AUTO_PICKUP_DELAY_MS,
  AUTO_PICKUP_INTERVAL_MS,
  AUTO_PICKUP_RADIUS,
  CHASE_REPATH_MS,
  DEATH_DELAY_MS,
  DOWNED_ARRIVAL_DELAY_MS,
  GROUND_ITEM_LIFETIME_MS,
  KEYS,
  LEASH_EXTRA_TILES,
  MONSTER_WINDUP_MS,
  PICKUP_CLICK_RADIUS,
  PICKUP_RANGE,
  PLAYER_ATTACK_RANGE,
  RETURN_REGEN_PER_SEC,
  RETURN_REPATH_MS,
  SEEN_CHECK_MS,
} from './config';
import { CombatFeel } from './combatFeel';
import './events';
import { decideMonsterMode, hitReaction, returnTimeoutMs, shouldTeleportHome, type MonsterMode } from './monsterBrain';
import {
  grantKill,
  knockOutPlayer,
  markCombat,
  needsRevive,
  pickUp,
  playerCombat,
  playerDerived,
  playerState,
  revivePlayer,
  seeMonster,
  takeDamage,
  updateRegen,
} from './playerState';

const HP_BAR_WIDTH = 28;
/** Textos e barras acima das entidades, abaixo dos números flutuantes. */
const OVERHEAD_DEPTH = 40000;

interface MonsterRuntime {
  def: MonsterDef;
  hp: number;
  provoked: boolean;
  mode: MonsterMode;
  nextAttackAt: number;
  lastRepath: number;
  returnStartedAt: number;
  /** Prazo da volta atual (ver returnTimeoutMs). */
  returnTimeoutMs: number;
  wander: EntityAI | null;
  /** Ponto onde nasceu (sempre caminhável). */
  home: Point;
  leash: number;
  hpBar: Phaser.GameObjects.Graphics;
}

interface GroundItem {
  itemId: string;
  quantity: number;
  spawnedAt: number;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
}

type CollectResult = 'ok' | 'partial' | 'full' | 'gone';

/** Golpe do jogador já iniciado (animação tocando); o dano sai em `impactAt`. */
interface PendingSwing {
  target: Monster;
  impactAt: number;
}

/** IA atribuída a `monster.ai`: delega para o controlador da cena. */
class CombatAI implements EntityAI {
  constructor(private readonly owner: SceneGameplay) {}

  update(entity: Entity, time: number, delta: number): void {
    if (entity instanceof Monster) this.owner.updateMonster(entity, time, delta);
  }
}

export class SceneGameplay {
  private readonly runtimes = new Map<Monster, MonsterRuntime>();
  private readonly groundItems = new Set<GroundItem>();
  private readonly combatAI = new CombatAI(this);
  private readonly targetRing: Phaser.GameObjects.Ellipse;
  private readonly feel: CombatFeel;
  /** Monstros criados neste frame: adotados no próximo, depois que o spawner ajustou `ai`. */
  private pendingMonsters: Monster[] = [];

  private target: Monster | null = null;
  private swing: PendingSwing | null = null;
  private pickupTarget: GroundItem | null = null;
  private nextPlayerAttackAt = 0;
  private lastChase = 0;
  private lastAutoPickup = 0;
  private lastSeenCheck = 0;
  private fullWarned = false;
  private playerDown = false;
  /** Saindo do mapa: IA e dano congelados. */
  private frozen = false;

  constructor(private readonly scene: WorldScene) {
    ensureItemIcons(scene);
    this.feel = new CombatFeel(scene);
    this.targetRing = scene.add.ellipse(0, 0, 30, 12).setStrokeStyle(2, 0xff5a5a, 0.95).setVisible(false);
    scene.tweens.add({ targets: this.targetRing, scale: 1.15, yoyo: true, repeat: -1, duration: 400 });

    for (const entity of scene.entities) if (entity instanceof Monster) this.pendingMonsters.push(entity);
    gameEvents.onScene(scene, 'entitySpawned', ({ entity }) => {
      if (entity instanceof Monster) this.pendingMonsters.push(entity);
    });
    gameEvents.onScene(scene, 'entityClicked', ({ entity }) => this.onEntityClicked(entity));
    gameEvents.onScene(scene, 'groundClicked', ({ x, y }) => this.onGroundClicked(x, y));
    gameEvents.onScene(scene, 'entityRemoved', ({ entity }) => this.onEntityRemoved(entity));
    gameEvents.onScene(scene, 'mapExiting', (e) => {
      if (e.scene === scene) this.freeze();
    });

    const onUpdate = (time: number, delta: number) => this.update(time, delta);
    scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));

    scene.player.speed = playerDerived(playerState).moveSpeed;
    if (needsRevive(playerState)) this.handleDownedArrival();
  }

  // ---------- Loop ----------

  private get halted(): boolean {
    return this.frozen || this.scene.traveling;
  }

  private update(time: number, _delta: number): void {
    this.adoptPendingMonsters();
    this.updateVisuals();
    if (this.halted || this.playerDown) return;
    this.updateSeen(time);

    if (this.scene.keyboardMoving) {
      this.target = null;
      this.pickupTarget = null;
      this.swing = null;
    }
    this.updateSwing(time);
    this.updatePlayerAttack(time);
    this.updatePickup();
    this.updateAutoPickup(time);
    updateRegen(playerState, time);
  }

  /** Bestiário: monstros na tela contam como vistos (checado a cada SEEN_CHECK_MS). */
  private updateSeen(time: number): void {
    if (time - this.lastSeenCheck < SEEN_CHECK_MS) return;
    this.lastSeenCheck = time;
    const view = this.scene.cameras.main.worldView;
    for (const [monster, rt] of this.runtimes) {
      if (monster.dead || !view.contains(monster.x, monster.y)) continue;
      if (seeMonster(playerState, rt.def.id)) {
        gameEvents.emit('notify', { text: `Novo no Bestiário: ${rt.def.name} (tecla ${KEYS.bestiary})`, color: '#c8e6ff' });
      }
    }
  }

  private freeze(): void {
    this.frozen = true;
    this.target = null;
    this.swing = null;
    this.pickupTarget = null;
    for (const monster of this.runtimes.keys()) monster.stop();
  }

  /** Assume o controle dos monstros novos, guardando a IA de passeio que o spawner deu. */
  private adoptPendingMonsters(): void {
    if (this.pendingMonsters.length === 0) return;
    for (const monster of this.pendingMonsters) {
      if (monster.dead || monster.removed || this.runtimes.has(monster) || !this.scene.entities.has(monster)) continue;
      const def = getMonster(monster.def.id);
      const area = monster.homeArea;
      const areaRadius = area ? (Math.hypot(area.w, area.h) / 2) * TILE_SIZE : 0;
      this.runtimes.set(monster, {
        def,
        hp: def.hp,
        provoked: false,
        mode: 'idle',
        nextAttackAt: 0,
        lastRepath: 0,
        returnStartedAt: 0,
        returnTimeoutMs: 0,
        wander: monster.ai,
        home: { x: monster.x, y: monster.y },
        leash: areaRadius + LEASH_EXTRA_TILES * TILE_SIZE,
        hpBar: this.scene.add.graphics().setVisible(false),
      });
      monster.ai = this.combatAI;
    }
    this.pendingMonsters = [];
  }

  // ---------- Jogador ----------

  private onEntityClicked(entity: Entity): void {
    if (this.playerDown || this.halted || !(entity instanceof Monster) || !this.runtimes.has(entity)) return;
    this.target = entity;
    this.pickupTarget = null;
    this.lastChase = 0;
  }

  private onGroundClicked(x: number, y: number): void {
    this.target = null;
    this.pickupTarget = null;
    let bestDist = PICKUP_CLICK_RADIUS;
    for (const item of this.groundItems) {
      const d = Math.hypot(item.sprite.x - x, item.sprite.y - y);
      if (d <= bestDist) {
        this.pickupTarget = item;
        bestDist = d;
      }
    }
  }

  private updatePlayerAttack(time: number): void {
    const target = this.target;
    if (!target) return;
    const rt = this.runtimes.get(target);
    if (!rt || target.dead) {
      this.target = null;
      return;
    }
    const player = this.scene.player;
    if (player.distanceTo(target) > PLAYER_ATTACK_RANGE) {
      if (time - this.lastChase >= CHASE_REPATH_MS || !player.isMoving) {
        this.lastChase = time;
        if (!player.moveTo(target.x, target.y)) this.target = null;
      }
      return;
    }
    if (player.isMoving) player.stop();
    player.faceTowards(target.x, target.y);
    if (time < this.nextPlayerAttackAt) return;

    this.nextPlayerAttackAt = time + playerDerived(playerState).attackDelayMs;
    markCombat(playerState, time);

    const reaction = hitReaction({
      mode: rt.mode,
      monsterDistFromHome: target.distanceTo(rt.home),
      playerDistFromHome: player.distanceTo(rt.home),
      leashRange: rt.leash,
    });
    if (reaction === 'immune') {
      floatText(this.scene, target.x, this.topOf(target) - 2, 'Imune', { color: '#b8c2d0', size: 12 });
      // Solta o alvo para o jogador não ficar preso seguindo um monstro imune.
      this.target = null;
      return;
    }
    // O intervalo (ASPD) conta do início do golpe; o dano sai no impacto da animação.
    const plan = this.feel.startSwing(player, target, playerDerived(playerState).attackDelayMs);
    this.swing = { target, impactAt: time + plan.impactMs };
    this.updateSwing(time);
  }

  /** Aplica o golpe pendente quando chega o impacto. Andar, trocar/perder o alvo ou sair do alcance cancela. */
  private updateSwing(time: number): void {
    const swing = this.swing;
    if (!swing || time < swing.impactAt) return;
    this.swing = null;
    const target = swing.target;
    const rt = this.runtimes.get(target);
    const player = this.scene.player;
    if (!rt || target.dead || player.isMoving || this.target !== target) return;
    if (player.distanceTo(target) > PLAYER_ATTACK_RANGE + FEEL.attack.rangeLeewayPx) return;

    rt.provoked = true;
    const result = resolveAttack(playerCombat(playerState), monsterCombatStats(rt.def), Math.random);
    this.showHit(target, result, false);
    if (!result.hit) {
      playSfx('miss');
      return;
    }
    rt.hp -= result.damage;
    const killed = rt.hp <= 0;
    this.feel.onMonsterHit(player, target, { ...result, targetMaxHp: rt.def.hp, killed });
    playSfx(result.crit ? 'crit' : 'hit');
    if (killed) this.killMonster(target, rt.def);
  }

  private killMonster(monster: Monster, def: MonsterDef): void {
    const pos = { x: monster.x, y: monster.y };
    if (this.target === monster) this.target = null;
    monster.die();

    const reward = grantKill(playerState, def, Date.now(), Math.random);
    const player = this.scene.player;
    // Ao lado da cabeça, para não cobrir o número de dano nem o anúncio de nível.
    floatText(this.scene, player.x + 22, this.topOf(player) + 4, `+${reward.exp} EXP`, { color: '#c9a7ff', size: 12 });
    if (reward.levelsGained > 0) {
      player.speed = playerDerived(playerState).moveSpeed;
      gameEvents.emit('levelUp', { level: reward.newLevel, statPoints: reward.statPointsGained });
    }
    if (reward.sealsCompleted > 0) {
      const sealName = hasSeal(reward.sealId) ? getSeal(reward.sealId).name : `Selo de ${def.name}`;
      gameEvents.emit('notify', { text: `${sealName} I obtido! Encaixe no Inventário (${KEYS.inventory} → Selos).`, color: '#ffd76a' });
    }
    playSfx('monsterDeath');
    const screen = this.toScreen({ x: pos.x, y: this.topOf(monster) + monster.sprite.displayHeight / 3 });
    if (reward.currency > 0) gameEvents.emit('lootCollected', { kind: 'currency', amount: reward.currency, screenX: screen.x, screenY: screen.y });
    if (def.fragmentsPerKill > 0) gameEvents.emit('lootCollected', { kind: 'fragment', amount: def.fragmentsPerKill, screenX: screen.x, screenY: screen.y });
    this.spawnDrops(pos, reward.drops);
    gameEvents.emit('monsterKilled', { entity: monster, monsterId: def.id, reward });
  }

  /** Efeito visual e retorno; o estado (Fadiga, caído) já foi aplicado por knockOutPlayer. */
  private onPlayerDefeated(): void {
    this.playerDown = true;
    this.target = null;
    this.pickupTarget = null;
    this.swing = null;
    const player = this.scene.player;
    this.feel.cancelFlash(player);
    player.stop();
    player.speed = 0;
    player.sprite.setTint(0x777777);
    this.scene.tweens.add({ targets: player.sprite, alpha: 0.35, duration: DEATH_DELAY_MS * 0.8 });
    floatText(this.scene, player.x, this.topOf(player) - 10, 'Você desmaiou...', { color: '#ff8080', size: 16, slow: true });
    gameEvents.emit('playerDied', { x: player.x, y: player.y, mapId: this.scene.mapDef.id });
    gameEvents.emit('notify', { text: fatigueNotice(), color: '#ff9f6b' });
    this.scene.time.delayedCall(DEATH_DELAY_MS, () => this.scene.returnToLastSafePoint());
  }

  /** Chegou ao mapa ainda caído (ex.: morreu durante uma transição). */
  private handleDownedArrival(): void {
    if (this.scene.mapDef.id === session.lastSafePoint.mapId) {
      revivePlayer(playerState);
      return;
    }
    this.playerDown = true;
    this.scene.player.speed = 0;
    this.scene.time.delayedCall(DOWNED_ARRIVAL_DELAY_MS, () => this.scene.returnToLastSafePoint());
  }

  // ---------- Monstros ----------

  updateMonster(monster: Monster, time: number, delta: number): void {
    const rt = this.runtimes.get(monster);
    if (!rt || this.halted) return;
    const player = this.scene.player;
    const def = rt.def;
    const mode = decideMonsterMode({
      mode: rt.mode,
      behavior: def.behavior,
      provoked: rt.provoked,
      playerAvailable: !this.playerDown && !player.dead,
      distToPlayer: monster.distanceTo(player),
      aggroRange: def.aggroRange,
      attackRange: def.attackRange,
      distFromHome: monster.distanceTo(rt.home),
      leashRange: rt.leash,
    });

    if (mode !== rt.mode) {
      if (mode === 'return') {
        // Desistiu: esquece o jogador e volta para casa recuperando HP no caminho.
        // Troca o caminho de perseguição pelo de volta já neste frame.
        monster.stop();
        monster.moveTo(rt.home.x, rt.home.y);
        rt.provoked = false;
        rt.returnStartedAt = time;
        rt.returnTimeoutMs = returnTimeoutMs(monster.distanceTo(rt.home), monster.speed);
        rt.lastRepath = time;
        if (this.target === monster) this.target = null;
      } else if (mode === 'attack') {
        rt.nextAttackAt = Math.max(rt.nextAttackAt, time + MONSTER_WINDUP_MS);
      } else if (mode === 'idle') {
        monster.stop();
        if (rt.mode === 'return') rt.hp = def.hp;
      }
      rt.mode = mode;
    }

    switch (mode) {
      case 'idle':
        rt.wander?.update(monster, time, delta);
        break;
      case 'chase':
        if (time - rt.lastRepath >= CHASE_REPATH_MS || !monster.isMoving) {
          rt.lastRepath = time;
          monster.moveTo(player.x, player.y);
        }
        break;
      case 'attack':
        if (monster.isMoving) monster.stop();
        monster.faceTowards(player.x, player.y);
        if (time >= rt.nextAttackAt) {
          rt.nextAttackAt = time + attackDelayMs(def.aspd);
          this.monsterAttack(rt, time);
        }
        break;
      case 'return':
        this.updateReturn(monster, rt, time, delta);
        break;
    }
  }

  private updateReturn(monster: Monster, rt: MonsterRuntime, time: number, delta: number): void {
    rt.hp = Math.min(rt.def.hp, rt.hp + rt.def.hp * RETURN_REGEN_PER_SEC * (delta / 1000));
    const visible = this.scene.cameras.main.worldView.contains(monster.x, monster.y);
    if (shouldTeleportHome({ elapsedMs: time - rt.returnStartedAt, timeoutMs: rt.returnTimeoutMs, visible })) {
      this.teleportHome(monster, rt);
      return;
    }
    // Caminho só com intervalo mínimo. Sem caminho, tenta de novo depois; o prazo acima resolve se continuar preso.
    if (monster.isMoving || time - rt.lastRepath < RETURN_REPATH_MS) return;
    rt.lastRepath = time;
    monster.moveTo(rt.home.x, rt.home.y);
  }

  private teleportHome(monster: Monster, rt: MonsterRuntime): void {
    monster.stop();
    monster.sprite.body?.reset(rt.home.x, rt.home.y);
    rt.hp = rt.def.hp;
    rt.provoked = false;
    rt.mode = 'idle';
  }

  private monsterAttack(rt: MonsterRuntime, time: number): void {
    markCombat(playerState, time);
    const player = this.scene.player;
    const result = resolveAttack(monsterCombatStats(rt.def), playerCombat(playerState), Math.random);
    this.showHit(player, result, true);
    if (!result.hit) {
      playSfx('miss');
      return;
    }
    this.feel.onPlayerHit(player, { ...result, targetMaxHp: playerDerived(playerState).maxHp, killed: false });
    playSfx('hurt');
    if (takeDamage(playerState, result.damage)) {
      // Estado primeiro (síncrono): a Fadiga vale mesmo que a cena acabe antes do efeito.
      knockOutPlayer(playerState, Date.now());
      this.onPlayerDefeated();
    }
  }

  private onEntityRemoved(entity: Entity): void {
    if (!(entity instanceof Monster)) return;
    const rt = this.runtimes.get(entity);
    if (!rt) return;
    rt.hpBar.destroy();
    this.runtimes.delete(entity);
    if (this.target === entity) this.target = null;
  }

  // ---------- Itens no chão ----------

  private spawnDrops(origin: Point, drops: readonly DroppedItem[]): void {
    drops.forEach((drop, i) => {
      const angle = (i / Math.max(1, drops.length)) * Math.PI * 2 + Math.random();
      const dest = { x: origin.x + Math.cos(angle) * 14, y: origin.y + Math.sin(angle) * 10 };
      if (!this.scene.isWalkable(dest.x, dest.y)) Object.assign(dest, origin);
      this.spawnGroundItem(origin, dest, drop);
    });
  }

  private spawnGroundItem(origin: Point, dest: Point, drop: DroppedItem): void {
    const item = getItem(drop.itemId);
    const color = RARITY_COLORS[item.rarity];
    const strong = item.rarity !== 'common';
    const glow = this.scene.add
      .ellipse(dest.x, dest.y + 4, 20, 8, color, strong ? 0.55 : 0.3)
      .setDepth(dest.y - 1);
    this.scene.tweens.add({ targets: glow, alpha: strong ? 0.95 : 0.6, scale: 1.25, yoyo: true, repeat: -1, duration: strong ? 450 : 800 });
    const sprite = this.scene.add.image(origin.x, origin.y, itemIconKey(item.id)).setDepth(dest.y).setOrigin(0.5, 1);
    sprite.setInteractive({ useHandCursor: true });
    const label = this.scene.add
      .text(dest.x, dest.y - 18, drop.quantity > 1 ? `${item.name} x${drop.quantity}` : item.name, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: rarityCss(item.rarity),
        stroke: '#1b2433',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(OVERHEAD_DEPTH)
      .setVisible(strong);
    sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => label.setVisible(true));
    sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => label.setVisible(strong));

    // "Pulinho" do monstro até o chão.
    this.scene.tweens.add({ targets: sprite, x: dest.x, duration: 350 });
    this.scene.tweens.add({ targets: sprite, y: dest.y - 14, duration: 175, ease: 'Quad.easeOut', yoyo: true, onComplete: () => sprite.setY(dest.y + 4) });

    const ground: GroundItem = { itemId: item.id, quantity: drop.quantity, spawnedAt: this.scene.time.now, sprite, glow, label };
    this.groundItems.add(ground);
    this.scene.time.delayedCall(GROUND_ITEM_LIFETIME_MS, () => this.removeGroundItem(ground));
  }

  private updatePickup(): void {
    const item = this.pickupTarget;
    if (!item) return;
    if (!this.groundItems.has(item)) {
      this.pickupTarget = null;
      return;
    }
    if (this.scene.player.distanceTo({ x: item.sprite.x, y: item.sprite.y }) <= PICKUP_RANGE) {
      this.pickupTarget = null;
      if (this.collect(item) === 'full') gameEvents.emit('notify', { text: 'Inventário cheio!', color: '#ff8080' });
    }
  }

  /** Varredura periódica: pega drops próximos (inclusive os que já estavam no chão ao ligar). */
  private updateAutoPickup(time: number): void {
    if (!playerState.autoPickup || time - this.lastAutoPickup < AUTO_PICKUP_INTERVAL_MS) return;
    this.lastAutoPickup = time;
    const player = this.scene.player;
    let blocked = false;
    for (const item of [...this.groundItems]) {
      if (time - item.spawnedAt < AUTO_PICKUP_DELAY_MS) continue;
      if (player.distanceTo({ x: item.sprite.x, y: item.sprite.y }) > AUTO_PICKUP_RADIUS) continue;
      const result = this.collect(item);
      if (result === 'full' || result === 'partial') blocked = true;
    }
    // Avisa uma vez por "enchimento"; volta a avisar depois que algo couber.
    if (blocked && !this.fullWarned) gameEvents.emit('notify', { text: 'Inventário cheio!', color: '#ff8080' });
    this.fullWarned = blocked;
  }

  /** Pega o que couber; o ícone "voa" até a bolsa no HUD (evento lootCollected). */
  private collect(ground: GroundItem): CollectResult {
    if (!this.groundItems.has(ground)) return 'gone';
    const player = this.scene.player;
    const item = getItem(ground.itemId);
    const added = pickUp(playerState, ground.itemId, ground.quantity);
    if (added === 0) return 'full';
    ground.quantity -= added;
    playSfx('pickupItem');
    const screen = this.toScreen({ x: ground.sprite.x, y: ground.sprite.y - ground.sprite.displayHeight / 2 });
    gameEvents.emit('lootCollected', { kind: 'item', itemId: item.id, amount: added, screenX: screen.x, screenY: screen.y });
    floatText(this.scene, player.x, this.topOf(player) - 4, `+${item.name}${added > 1 ? ` x${added}` : ''}`, {
      color: rarityCss(item.rarity),
      size: 11,
    });
    if (ground.quantity > 0) return 'partial';
    this.groundItems.delete(ground);
    ground.glow.destroy();
    ground.label.destroy();
    ground.sprite.destroy();
    return 'ok';
  }

  private removeGroundItem(ground: GroundItem): void {
    if (!this.groundItems.delete(ground)) return;
    ground.sprite.destroy();
    ground.glow.destroy();
    ground.label.destroy();
  }

  // ---------- Visual ----------

  private updateVisuals(): void {
    const target = this.target;
    this.targetRing.setVisible(!!target);
    if (target) this.targetRing.setPosition(target.x, target.y + 1).setDepth(target.y - 1);

    for (const [monster, rt] of this.runtimes) {
      const show = !monster.dead && (rt.hp < rt.def.hp || monster === target);
      rt.hpBar.setVisible(show);
      if (!show) continue;
      const x = monster.x - HP_BAR_WIDTH / 2;
      const y = this.topOf(monster) - 6;
      const ratio = Math.max(0, rt.hp / rt.def.hp);
      rt.hpBar
        .clear()
        .fillStyle(0x1b2433, 0.85)
        .fillRect(x - 1, y - 1, HP_BAR_WIDTH + 2, 5)
        .fillStyle(ratio > 0.3 ? 0x6fdc5a : 0xff5a5a, 1)
        .fillRect(x, y, Math.ceil(HP_BAR_WIDTH * ratio), 3)
        .setDepth(OVERHEAD_DEPTH);
    }
  }

  private showHit(target: Entity, result: AttackResult, onPlayer: boolean): void {
    const y = this.topOf(target) - 2;
    if (!result.hit) {
      floatText(this.scene, target.x, y, 'Miss', { color: '#b8c2d0', size: 12 });
    } else if (result.crit) {
      floatText(this.scene, target.x, y, `${result.damage}!`, { color: '#ffd23f', size: 20 });
    } else {
      floatText(this.scene, target.x, y, `${result.damage}`, { color: onPlayer ? '#ff6b6b' : '#ffffff', size: 14 });
    }
  }

  private toScreen(p: Point): Point {
    const cam = this.scene.cameras.main;
    return worldToScreen(p, { scrollX: cam.worldView.x, scrollY: cam.worldView.y, zoom: cam.zoom, x: cam.x, y: cam.y });
  }

  private topOf(entity: Entity): number {
    return entity.sprite.y - entity.sprite.displayHeight * entity.sprite.originY;
  }
}
