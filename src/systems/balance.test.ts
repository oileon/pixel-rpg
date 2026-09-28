import { describe, expect, it } from 'vitest';
import { getClass, getItem, getMonster } from '../data';
import type { BaseStats } from '../data/types';
import { playerCombatStats } from './combat';
import { createSeededRng } from './loot';
import { computeDerivedStats, defaultBaseStats } from './stats';
import { MONSTER_WINDUP_MS } from '../gameplay/config';
import {
  expectedTimeToDieMs,
  monsterFighter,
  SIM_MONSTER_WINDUP_MS,
  simulateFight,
  summarizeFights,
  type SimFighter,
} from './balance';

const TRIALS = 2000;

/** Aprendiz com Adaga de Treino (e, opcionalmente, Colete de Lona). */
function apprentice(level: number, stats: Partial<BaseStats>, armor = false): SimFighter {
  const equipment = [getItem('adaga_treino').equip!, ...(armor ? [getItem('colete_lona').equip!] : [])];
  const d = computeDerivedStats({
    level,
    stats: { ...defaultBaseStats(), ...stats },
    classDef: getClass('aprendiz'),
    equipment,
  });
  return { stats: playerCombatStats(d), hp: d.maxHp, attackDelayMs: d.attackDelayMs };
}

describe('simulateFight', () => {
  it('usa a mesma espera do 1º golpe que o gameplay', () => {
    expect(SIM_MONSTER_WINDUP_MS).toBe(MONSTER_WINDUP_MS);
  });

  it('é determinística com a mesma semente', () => {
    const p = apprentice(3, { str: 10 });
    const m = monsterFighter(getMonster('cascudo'));
    expect(simulateFight(p, [m], createSeededRng(3))).toEqual(simulateFight(p, [m], createSeededRng(3)));
  });

  it('mais monstros juntos matam mais rápido', () => {
    const p = apprentice(3, { str: 10, vit: 5, dex: 6 });
    const m = monsterFighter(getMonster('cascudo'));
    const one = expectedTimeToDieMs(p, [m], createSeededRng(1));
    const three = expectedTimeToDieMs(p, [m, m, m], createSeededRng(1));
    expect(three).toBeLessThan(one / 2);
  });
});

// Metas do design (docs/design.md, "Referência de balanceamento").
describe('balanceamento do Cascudo', () => {
  const cascudo = getMonster('cascudo');
  const m = monsterFighter(cascudo);

  it('nível 5 bem distribuído vence 1 Cascudo com folga', () => {
    // 43 pontos: STR 11 (20) + VIT 7 (12) + DEX 6 (10).
    const p = apprentice(5, { str: 11, vit: 7, dex: 6 });
    const r = summarizeFights(p, [m], TRIALS, createSeededRng(5));
    expect(r.winRate).toBeGreaterThanOrEqual(0.95);
    expect(r.avgHpLeftOnWin / p.hp).toBeGreaterThanOrEqual(0.35);
  });

  it('nível 3 ainda corre risco contra 1 Cascudo', () => {
    // 36 pontos: STR 10 (18) + VIT 5 (8) + DEX 6 (10).
    const p = apprentice(3, { str: 10, vit: 5, dex: 6 });
    const r = summarizeFights(p, [m], TRIALS, createSeededRng(3));
    expect(r.winRate < 0.95 || r.avgHpLeftOnWin / p.hp < 0.35).toBe(true);
  });

  it('nível 1 sem stats perde', () => {
    const r = summarizeFights(apprentice(1, {}), [m], TRIALS, createSeededRng(1));
    expect(r.winRate).toBeLessThan(0.2);
  });

  it('dá para fugir: o Cascudo leva ≥ 1,5 s do raio de aggro até o alcance e o jogador é 3× mais rápido', () => {
    const reachMs = ((cascudo.aggroRange - cascudo.attackRange) / cascudo.moveSpeed) * 1000;
    expect(reachMs).toBeGreaterThanOrEqual(1500);
    expect(getClass('aprendiz').moveSpeed).toBeGreaterThanOrEqual(cascudo.moveSpeed * 3);
  });

  it('raio de aggro curto (≤ 120 px) para não puxar vários de uma vez', () => {
    expect(cascudo.aggroRange).toBeLessThanOrEqual(120);
  });
});
