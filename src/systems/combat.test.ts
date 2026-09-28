import { describe, expect, it } from 'vitest';
import { getClass, getItem, getMonster } from '../data';
import type { EquipInfo, Rng } from '../data/types';
import {
  applyDefense,
  CRIT_MULTIPLIER,
  elementMultiplier,
  hitChance,
  monsterCombatStats,
  playerCombatStats,
  resolveAttack,
  type CombatStats,
} from './combat';
import { createSeededRng } from './loot';
import { computeDerivedStats, defaultBaseStats } from './stats';

function sequence(...values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length] as number;
}

const base: CombatStats = { atk: 30, def: 20, hit: 10, flee: 10, crit: 0, attackElement: 'neutral', defenseElement: 'neutral' };

describe('tabela elemental', () => {
  it('ciclo fogo → terra → vento → água → fogo', () => {
    expect(elementMultiplier('fire', 'earth')).toBe(1.5);
    expect(elementMultiplier('earth', 'wind')).toBe(1.5);
    expect(elementMultiplier('wind', 'water')).toBe(1.5);
    expect(elementMultiplier('water', 'fire')).toBe(1.5);
    expect(elementMultiplier('earth', 'fire')).toBe(0.75);
    expect(elementMultiplier('fire', 'fire')).toBe(1);
    expect(elementMultiplier('neutral', 'water')).toBe(1);
  });
});

describe('acerto e defesa', () => {
  it('chance de acerto 80 + HIT − FLEE limitada a 5..95', () => {
    expect(hitChance(2, 2)).toBe(80);
    expect(hitChance(100, 0)).toBe(95);
    expect(hitChance(0, 200)).toBe(5);
  });

  it('defesa reduz por K/(K+DEF) e nunca zera', () => {
    expect(applyDefense(100, 0)).toBe(100);
    expect(applyDefense(100, 50)).toBe(50);
    expect(applyDefense(1, 1000)).toBe(1);
  });
});

describe('resolveAttack', () => {
  it('acerto normal aplica defesa', () => {
    // sem crítico, acerta, variação ×1.0
    const r = resolveAttack(base, base, sequence(0.99, 0.1, 0.5));
    expect(r).toEqual({ hit: true, crit: false, damage: 21, elementMultiplier: 1 });
  });

  it('erro quando o teste de acerto falha', () => {
    const r = resolveAttack(base, base, sequence(0.99, 0.9));
    expect(r.hit).toBe(false);
    expect(r.damage).toBe(0);
  });

  it('crítico sempre acerta e ignora defesa', () => {
    const attacker = { ...base, crit: 50 };
    const defender = { ...base, flee: 999, def: 999 };
    const r = resolveAttack(attacker, defender, sequence(0.1, 0.5));
    expect(r.crit).toBe(true);
    expect(r.damage).toBe(Math.floor(30 * (0.9 + 0.5 * 0.2) * CRIT_MULTIPLIER));
  });

  it('elemento multiplica o dano final', () => {
    const r = resolveAttack({ ...base, attackElement: 'fire' }, { ...base, defenseElement: 'earth' }, sequence(0.99, 0.1, 0.5));
    expect(r.damage).toBe(Math.floor(21 * 1.5));
  });
});

describe('balanceamento do campo inicial', () => {
  const dagger = getItem('adaga_treino').equip as EquipInfo;

  function averageHitsToKill(monsterId: string, str: number, dex: number, level: number): number {
    const derived = computeDerivedStats({
      level,
      stats: { ...defaultBaseStats(), str, dex },
      classDef: getClass('aprendiz'),
      equipment: [dagger],
    });
    const monster = getMonster(monsterId);
    const player = playerCombatStats(derived);
    const target = monsterCombatStats(monster);
    const rng = createSeededRng(42);
    let attacks = 0;
    const trials = 500;
    for (let t = 0; t < trials; t++) {
      let hp = monster.hp;
      while (hp > 0) {
        hp -= resolveAttack(player, target, rng).damage;
        attacks++;
      }
    }
    return attacks / trials;
  }

  it('Aprendiz nível 1 com adaga derruba um Pomi em ~3–6 ataques', () => {
    const avg = averageHitsToKill('pomi', 1, 1, 1);
    expect(avg).toBeGreaterThan(3);
    expect(avg).toBeLessThan(6);
  });

  it('Cascudo é mais resistente (nível 5, STR 10)', () => {
    const avg = averageHitsToKill('cascudo', 10, 5, 5);
    expect(avg).toBeGreaterThan(5);
    expect(avg).toBeLessThan(10);
  });
});
