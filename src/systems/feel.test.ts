import { describe, expect, it } from 'vitest';
import { FEEL, SFX } from '../data';
import type { AttackFeel } from '../data/types';
import {
  animationMs,
  coinParticleCount,
  flightPoint,
  hitStopMs,
  knockbackPx,
  PendingCounter,
  planSwing,
  pulseCurve,
  pushOffset,
  shakeFor,
  splitAmount,
  worldToScreen,
  type HitInfo,
} from './feel';

const attack: AttackFeel = {
  animation: 'attack',
  impactFraction: 0.5,
  maxSwingFraction: 0.85,
  minSwingMs: 120,
  maxSwingMs: 420,
  rangeLeewayPx: 16,
  lungePx: 5,
  lungeOutMs: 70,
  lungeBackMs: 110,
};

const hit = (over: Partial<HitInfo> = {}): HitInfo => ({ hit: true, crit: false, damage: 10, targetMaxHp: 100, killed: false, ...over });

describe('planSwing', () => {
  it('usa a duração natural da animação e acerta no meio', () => {
    expect(planSwing(1000, attack, animationMs(6, 20))).toEqual({ swingMs: 300, impactMs: 150 });
  });

  it('nunca passa do intervalo de ataque (ASPD alto acelera o golpe)', () => {
    for (const delay of [200, 300, 500, 1000, 2000]) {
      const p = planSwing(delay, attack, 600);
      expect(p.swingMs).toBeLessThanOrEqual(delay * attack.maxSwingFraction);
      expect(p.impactMs).toBeLessThan(delay);
      expect(p.impactMs).toBeLessThanOrEqual(p.swingMs);
    }
    expect(planSwing(200, attack, 600).swingMs).toBe(170);
  });

  it('respeita os limites mínimo e máximo', () => {
    expect(planSwing(1000, attack, 50).swingMs).toBe(attack.minSwingMs);
    expect(planSwing(5000, attack, 2000).swingMs).toBe(attack.maxSwingMs);
  });

  it('sem animação usa o avanço procedural: impacto no fim da ida', () => {
    expect(planSwing(1000, attack, null)).toEqual({ swingMs: 180, impactMs: 70 });
  });

  it('feel.json também respeita o ASPD máximo (190 → 200 ms)', () => {
    expect(planSwing(200, FEEL.attack, 1000).impactMs).toBeLessThan(200);
    expect(planSwing(200, FEEL.attack, null).impactMs).toBeLessThan(200);
  });
});

describe('hit-stop e tremida', () => {
  const cfg = { normalMs: 55, critMs: 85, killBonusMs: 20, maxMs: 100 };

  it('erro não para; crítico para mais; golpe fatal ganha bônus limitado', () => {
    expect(hitStopMs(hit({ hit: false }), cfg)).toBe(0);
    expect(hitStopMs(hit(), cfg)).toBe(55);
    expect(hitStopMs(hit({ crit: true }), cfg)).toBe(85);
    expect(hitStopMs(hit({ killed: true }), cfg)).toBe(75);
    expect(hitStopMs(hit({ crit: true, killed: true }), cfg)).toBe(100);
  });

  it('hit-stop de feel.json fica curto', () => {
    expect(hitStopMs(hit({ crit: true, killed: true }), FEEL.hitStop)).toBeLessThanOrEqual(120);
    expect(hitStopMs(hit(), FEEL.hitStop)).toBeGreaterThanOrEqual(40);
  });

  it('câmera treme só em crítico ou golpe forte', () => {
    const shake = FEEL.shake;
    expect(shakeFor(hit(), shake)).toBeNull();
    expect(shakeFor(hit({ hit: false, crit: true }), shake)).toBeNull();
    expect(shakeFor(hit({ crit: true }), shake)).toEqual({ ms: shake.critMs, intensity: shake.critIntensity });
    expect(shakeFor(hit({ damage: 100 * shake.heavyHitFraction }), shake)).toEqual({ ms: shake.heavyMs, intensity: shake.heavyIntensity });
  });
});

describe('recuo e avanço', () => {
  it('pushOffset aponta de quem bate para quem apanha', () => {
    expect(pushOffset({ x: 0, y: 0 }, { x: 10, y: 0 }, 3)).toEqual({ x: 3, y: 0 });
    const d = pushOffset({ x: 0, y: 0 }, { x: 3, y: 4 }, 5);
    expect(d.x).toBeCloseTo(3);
    expect(d.y).toBeCloseTo(4);
    expect(pushOffset({ x: 1, y: 1 }, { x: 1, y: 1 }, 5)).toEqual({ x: 0, y: 0 });
  });

  it('crítico empurra mais', () => {
    expect(knockbackPx(true, FEEL.knockback)).toBeGreaterThan(knockbackPx(false, FEEL.knockback));
  });

  it('pulseCurve vai a 1 e volta a 0', () => {
    expect(pulseCurve(0, 60, 100)).toBe(0);
    expect(pulseCurve(30, 60, 100)).toBeCloseTo(0.5);
    expect(pulseCurve(60, 60, 100)).toBe(1);
    expect(pulseCurve(110, 60, 100)).toBeCloseTo(0.5);
    expect(pulseCurve(160, 60, 100)).toBe(0);
    expect(pulseCurve(999, 60, 100)).toBe(0);
  });
});

describe('loot voando', () => {
  const cfg = FEEL.lootFly;

  it('quantidade de moedas desenhadas cresce com o valor, com teto', () => {
    expect(coinParticleCount(0, cfg)).toBe(0);
    expect(coinParticleCount(1, cfg)).toBe(1);
    expect(coinParticleCount(10_000, cfg)).toBe(cfg.maxCoinParticles);
  });

  it('splitAmount soma exatamente', () => {
    expect(splitAmount(10, 3)).toEqual([4, 3, 3]);
    expect(splitAmount(2, 4)).toEqual([1, 1, 0, 0]);
    expect(splitAmount(5, 0)).toEqual([]);
  });

  it('trajetória começa e termina nos pontos e faz arco para cima', () => {
    const a = { x: 100, y: 300 };
    const b = { x: 250, y: 120 };
    expect(flightPoint(a, b, 60, 0)).toEqual(a);
    expect(flightPoint(a, b, 60, 1)).toEqual(b);
    expect(flightPoint(a, b, 60, 0.5).y).toBeLessThan((a.y + b.y) / 2);
  });

  it('converte mundo → tela pela câmera', () => {
    expect(worldToScreen({ x: 500, y: 400 }, { scrollX: 300, scrollY: 200, zoom: 1, x: 0, y: 0 })).toEqual({ x: 200, y: 200 });
    expect(worldToScreen({ x: 500, y: 400 }, { scrollX: 300, scrollY: 200, zoom: 2, x: 10, y: 0 })).toEqual({ x: 410, y: 400 });
  });

  it('contador mostra só a moeda que já chegou', () => {
    const c = new PendingCounter();
    c.add(10);
    expect(c.display(110)).toBe(100);
    c.settle(4);
    expect(c.display(110)).toBe(104);
    c.settle(99);
    expect(c.display(110)).toBe(110);
  });

  it('destinos ficam dentro da tela 960×540', () => {
    for (const p of [cfg.coinTarget, cfg.fragmentTarget, cfg.bagTarget]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(960);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(540);
    }
  });
});

describe('sfx.json', () => {
  const ids = ['hit', 'crit', 'miss', 'hurt', 'monsterDeath', 'pickupItem', 'coin', 'levelUp'] as const;

  it('tem todos os efeitos com camadas válidas', () => {
    for (const id of ids) {
      const layers = SFX[id];
      expect(layers.length, id).toBeGreaterThan(0);
      for (const l of layers) {
        expect(l.ms, id).toBeGreaterThan(0);
        expect(l.gain, id).toBeGreaterThan(0);
        expect(l.gain, id).toBeLessThanOrEqual(1);
        if (l.wave !== 'noise') {
          expect(l.freq, id).toHaveLength(2);
          for (const f of l.freq ?? []) expect(f, id).toBeGreaterThan(0);
        }
      }
    }
  });
});
