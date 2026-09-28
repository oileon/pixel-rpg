import { describe, expect, it } from 'vitest';
import { getClass, getItem } from '../data';
import type { EquipInfo } from '../data/types';
import {
  allocateStats,
  attackDelayMs,
  availableStatPoints,
  computeDerivedStats,
  defaultBaseStats,
  previewStats,
  respecStats,
  statCostRange,
  statIncreaseCost,
  totalStatPoints,
} from './stats';

const aprendiz = getClass('aprendiz');
const dagger = getItem('adaga_treino').equip as EquipInfo;

describe('custo de pontos', () => {
  it('segue a faixa de 10 em 10 estilo RO', () => {
    expect(statIncreaseCost(1)).toBe(2);
    expect(statIncreaseCost(10)).toBe(2);
    expect(statIncreaseCost(11)).toBe(3);
    expect(statIncreaseCost(21)).toBe(4);
    expect(statCostRange(1, 11)).toBe(20);
    expect(statCostRange(1, 21)).toBe(50);
  });

  it('acumula pontos por nível', () => {
    expect(totalStatPoints(1)).toBe(30);
    expect(totalStatPoints(5)).toBe(43);
    expect(availableStatPoints(1, defaultBaseStats())).toBe(30);
    expect(availableStatPoints(1, { ...defaultBaseStats(), str: 11 })).toBe(10);
  });
});

describe('atributos derivados', () => {
  it('Aprendiz nível 1 com stats iniciais', () => {
    const d = computeDerivedStats({ level: 1, stats: defaultBaseStats(), classDef: aprendiz });
    expect(d).toMatchObject({ maxHp: 40, maxSp: 10, atk: 1, def: 0, hit: 2, flee: 2, crit: 1, aspd: 150, attackDelayMs: 1000 });
  });

  it('soma arma e escala com STR/VIT', () => {
    const stats = { ...defaultBaseStats(), str: 20, vit: 30 };
    const d = computeDerivedStats({ level: 10, stats, classDef: aprendiz, equipment: [dagger] });
    expect(d.maxHp).toBe(192); // (40 + 9×12) × 1.30
    expect(d.atk).toBe(20 + 4 + 12);
    expect(d.def).toBe(15);
  });

  it('arma de distância usa DEX como stat principal', () => {
    const bow: EquipInfo = { slot: 'weapon', weaponType: 'ranged', atk: 0 };
    const stats = { ...defaultBaseStats(), dex: 30, str: 5 };
    const d = computeDerivedStats({ level: 1, stats, classDef: aprendiz, equipment: [bow] });
    expect(d.atk).toBe(30 + 9 + 1);
  });

  it('ASPD tem teto 190', () => {
    const stats = { ...defaultBaseStats(), agi: 99, dex: 99 };
    const d = computeDerivedStats({ level: 30, stats, classDef: aprendiz });
    expect(d.aspd).toBe(190);
    expect(d.attackDelayMs).toBe(200);
    expect(attackDelayMs(140)).toBe(1200);
  });
});

describe('prévia e distribuição', () => {
  const input = { level: 1, stats: defaultBaseStats(), classDef: aprendiz };

  it('mostra antes/depois sem alterar o original', () => {
    const p = previewStats(input, { str: 10 });
    expect(p.valid).toBe(true);
    expect(p.cost).toBe(20);
    expect(p.remainingPoints).toBe(10);
    expect(p.before.atk).toBe(1);
    expect(p.after.atk).toBe(12);
    expect(input.stats.str).toBe(1);
  });

  it('recusa quando faltam pontos ou valores inválidos', () => {
    expect(previewStats(input, { str: 20 }).valid).toBe(false);
    expect(previewStats(input, { str: -1 }).valid).toBe(false);
    expect(allocateStats(input, { str: 20 })).toBeNull();
    expect(allocateStats(input, { agi: 5, luk: 5 })).toMatchObject({ agi: 6, luk: 6 });
  });

  it('redistribuição grátis só até o nível 20', () => {
    expect(respecStats(20)).toEqual(defaultBaseStats());
    expect(respecStats(21)).toBeNull();
  });
});
