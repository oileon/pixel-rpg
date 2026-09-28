import { describe, expect, it } from 'vitest';
import { EXP_TABLE } from '../data';
import {
  addExp,
  applyDeathFatigue,
  calculateExpGain,
  expProgressRatio,
  expToNextLevel,
  FATIGUE_DURATION_MS,
  fatigueRemainingMs,
  isFatigued,
  levelDiffMultiplier,
} from './exp';

describe('tabela de EXP', () => {
  it('cobre do nível 1 ao 30 e é crescente', () => {
    expect(EXP_TABLE.expToNext).toHaveLength(EXP_TABLE.maxLevel - 1);
    for (let i = 1; i < EXP_TABLE.expToNext.length; i++) {
      expect(EXP_TABLE.expToNext[i]).toBeGreaterThan(EXP_TABLE.expToNext[i - 1] as number);
    }
    expect(expToNextLevel(1, EXP_TABLE)).toBe(20);
    expect(expToNextLevel(29, EXP_TABLE)).toBe(18488);
    expect(expToNextLevel(30, EXP_TABLE)).toBeNull();
  });
});

describe('addExp', () => {
  it('sobe de nível e guarda o excedente', () => {
    expect(addExp({ level: 1, exp: 0 }, 25, EXP_TABLE)).toEqual({ level: 2, exp: 5, levelsGained: 1, statPointsGained: 3 });
  });

  it('processa vários níveis de uma vez', () => {
    const r = addExp({ level: 1, exp: 0 }, 20 + 51 + 10, EXP_TABLE);
    expect(r).toEqual({ level: 3, exp: 10, levelsGained: 2, statPointsGained: 6 });
  });

  it('para no nível máximo com EXP zerada', () => {
    const r = addExp({ level: 29, exp: 0 }, 1_000_000, EXP_TABLE);
    expect(r.level).toBe(30);
    expect(r.exp).toBe(0);
    expect(expProgressRatio(r, EXP_TABLE)).toBe(1);
  });

  it('barra de progresso', () => {
    expect(expProgressRatio({ level: 1, exp: 10 }, EXP_TABLE)).toBe(0.5);
  });
});

describe('penalidade por diferença de nível', () => {
  it('sem penalidade até 5 níveis acima, −10% por nível depois, mínimo 10%', () => {
    expect(levelDiffMultiplier(1, 5)).toBe(1);
    expect(levelDiffMultiplier(10, 5)).toBe(1);
    expect(levelDiffMultiplier(11, 5)).toBeCloseTo(0.9);
    expect(levelDiffMultiplier(30, 1)).toBe(0.1);
  });
});

describe('Fadiga', () => {
  const fatigue = applyDeathFatigue(1000);

  it('dura FATIGUE_DURATION_MS a partir da morte', () => {
    expect(fatigue.until).toBe(1000 + FATIGUE_DURATION_MS);
    expect(isFatigued(fatigue, 2000)).toBe(true);
    expect(isFatigued(fatigue, fatigue.until)).toBe(false);
    expect(fatigueRemainingMs(fatigue, 2000)).toBe(FATIGUE_DURATION_MS - 1000);
    expect(isFatigued(null, 0)).toBe(false);
  });

  it('reduz a EXP em 30% enquanto ativa (mínimo 1)', () => {
    const input = { baseExp: 10, playerLevel: 1, monsterLevel: 1 };
    expect(calculateExpGain({ ...input, fatigue, nowMs: 2000 })).toBe(7);
    expect(calculateExpGain({ ...input, fatigue, nowMs: fatigue.until })).toBe(10);
    expect(calculateExpGain({ ...input, baseExp: 1, fatigue, nowMs: 2000 })).toBe(1);
    expect(calculateExpGain({ ...input, baseExp: 0, nowMs: 0 })).toBe(0);
  });
});
