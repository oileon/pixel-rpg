// Efeitos de "peso" do combate numa cena de mapa: golpe do jogador (animação ou avanço), hit-stop,
// flash, recuo e tremida de câmera. Só visual: nenhum timer de gameplay depende destes efeitos.
// Tempos e intensidades em data/feel.json; cálculos em systems/feel.ts.

import Phaser from 'phaser';
import { FEEL } from '../data';
import { animKey, type AnimState } from '../assets/manifest';
import type { Entity, Point } from '../entities/Entity';
import type { WorldScene } from '../scenes/WorldScene';
import {
  animationMs,
  hitStopMs,
  knockbackPx,
  planSwing,
  pulseCurve,
  pushOffset,
  shakeFor,
  type HitInfo,
  type SwingPlan,
} from '../systems/feel';

function colorOf(css: string): number {
  return Phaser.Display.Color.HexStringToColor(css).color;
}

export class CombatFeel {
  /** Pulso de deslocamento (avanço/recuo) em curso por entidade. */
  private readonly pulses = new Map<Entity, Phaser.Tweens.Tween>();
  private readonly flashes = new Map<Entity, Phaser.Time.TimerEvent>();

  constructor(private readonly scene: WorldScene) {}

  /**
   * Começa o golpe do jogador em direção ao alvo e devolve quando o impacto acontece.
   * Toca a animação de ataque se existir no manifesto; senão, um avanço curto na direção do alvo.
   */
  startSwing(attacker: Entity, target: Point, attackDelayMs: number): SwingPlan {
    attacker.faceTowards(target.x, target.y);
    const cfg = FEEL.attack;
    const anim = this.scene.anims.get(animKey(attacker.visual.key, cfg.animation as AnimState, attacker.facing));
    const plan = planSwing(attackDelayMs, cfg, anim ? animationMs(anim.frames.length, anim.frameRate) : null);
    if (!attacker.playAction(cfg.animation, plan.swingMs)) {
      this.pulse(attacker, pushOffset(attacker, target, cfg.lungePx), plan.impactMs, plan.swingMs - plan.impactMs);
    }
    return plan;
  }

  /** Impacto de um golpe do jogador num monstro. */
  onMonsterHit(attacker: Entity, target: Entity, hit: HitInfo): void {
    if (!hit.hit) return;
    const stop = hitStopMs(hit, FEEL.hitStop);
    attacker.freezeAnimation(stop);
    target.freezeAnimation(stop);
    this.holdPulse(attacker, stop);
    this.flash(target, colorOf(FEEL.flash.monsterColor), FEEL.flash.monsterMs + stop, true);
    // O recuo começa depois do hit-stop, que "segura" o quadro do impacto.
    const kb = FEEL.knockback;
    const offset = pushOffset(attacker, target, knockbackPx(hit.crit, kb));
    this.scene.time.delayedCall(stop, () => {
      if (!target.removed) this.pulse(target, offset, kb.outMs, kb.backMs);
    });
    const shake = shakeFor(hit, FEEL.shake);
    if (shake) this.scene.cameras.main.shake(shake.ms, shake.intensity);
  }

  /** Jogador levou dano: flash vermelho leve (tint, não preenchimento) e tremida só em golpe forte. */
  onPlayerHit(player: Entity, hit: HitInfo): void {
    if (!hit.hit) return;
    this.flash(player, colorOf(FEEL.flash.playerColor), FEEL.flash.playerMs, false);
    const shake = shakeFor({ ...hit, crit: false }, FEEL.shake);
    if (shake) this.scene.cameras.main.shake(shake.ms, shake.intensity);
  }

  /** Tira o flash de uma entidade sem mexer em outros tints (ex.: cinza de "desmaiado"). */
  cancelFlash(entity: Entity): void {
    this.flashes.get(entity)?.remove(false);
    this.flashes.delete(entity);
  }

  private flash(entity: Entity, color: number, ms: number, fill: boolean): void {
    this.cancelFlash(entity);
    if (fill) entity.sprite.setTintFill(color);
    else entity.sprite.setTint(color);
    this.flashes.set(
      entity,
      this.scene.time.delayedCall(ms, () => {
        this.flashes.delete(entity);
        if (entity.sprite.scene) entity.sprite.clearTint();
      }),
    );
  }

  /** Segura o avanço em curso (no ponto do impacto) durante o hit-stop. */
  private holdPulse(entity: Entity, ms: number): void {
    const tween = this.pulses.get(entity);
    if (!tween || ms <= 0) return;
    tween.pause();
    this.scene.time.delayedCall(ms, () => {
      if (this.pulses.get(entity) === tween) tween.resume();
    });
  }

  /** Desloca o desenho até `offset` em `outMs` e volta em `backMs`. */
  private pulse(entity: Entity, offset: Point, outMs: number, backMs: number): void {
    this.pulses.get(entity)?.stop();
    const clock = { t: 0 };
    const total = outMs + backMs;
    const tween = this.scene.tweens.add({
      targets: clock,
      t: total,
      duration: total,
      onUpdate: () => {
        if (entity.removed) return;
        const k = pulseCurve(clock.t, outMs, backMs);
        entity.setVisualOffset(offset.x * k, offset.y * k);
      },
      onComplete: () => this.endPulse(entity, tween),
      onStop: () => this.endPulse(entity, tween),
    });
    this.pulses.set(entity, tween);
  }

  private endPulse(entity: Entity, tween: Phaser.Tweens.Tween): void {
    if (this.pulses.get(entity) !== tween) return;
    this.pulses.delete(entity);
    if (!entity.removed) entity.setVisualOffset(0, 0);
  }
}
