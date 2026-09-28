// Stats do personagem (estilo RO): custo de pontos, atributos derivados, prévia e redistribuição.
// Fórmulas documentadas em docs/design.md (seção Fórmulas).

import type { BaseStats, ClassDef, EquipBonus, EquipInfo, StatKey } from '../data/types';

export const STAT_KEYS: readonly StatKey[] = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
export const MIN_STAT = 1;
export const MAX_STAT = 99;
export const STARTING_STAT_POINTS = 30;
export const FREE_RESPEC_MAX_LEVEL = 20;
export const MAX_ASPD = 190;

export interface DerivedStats {
  maxHp: number;
  maxSp: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  hit: number;
  flee: number;
  /** Chance de crítico em %. */
  crit: number;
  aspd: number;
  attackDelayMs: number;
  /** Pixels por segundo. */
  moveSpeed: number;
}

export interface CharacterStatsInput {
  level: number;
  /** Stats distribuídos pelo jogador (sem bônus de classe/equipamento). */
  stats: BaseStats;
  classDef: ClassDef;
  /** Equipamentos atualmente vestidos. */
  equipment?: readonly EquipInfo[];
  /** Bônus extras que somam como equipamento (Selos encaixados e Ressonâncias). */
  bonuses?: readonly EquipBonus[];
}

export interface StatPreview {
  valid: boolean;
  /** Motivo quando inválido. */
  reason?: string;
  /** Stats resultantes (iguais aos atuais se inválido). */
  stats: BaseStats;
  /** Pontos que a distribuição custa. */
  cost: number;
  /** Pontos livres depois de aplicar. */
  remainingPoints: number;
  before: DerivedStats;
  after: DerivedStats;
}

export function defaultBaseStats(): BaseStats {
  return { str: MIN_STAT, agi: MIN_STAT, vit: MIN_STAT, int: MIN_STAT, dex: MIN_STAT, luk: MIN_STAT };
}

/** Custo para subir um stat de `currentValue` para `currentValue + 1`. */
export function statIncreaseCost(currentValue: number): number {
  return Math.floor((currentValue - 1) / 10) + 2;
}

/** Custo total para subir um stat de `from` até `to`. */
export function statCostRange(from: number, to: number): number {
  let cost = 0;
  for (let v = from; v < to; v++) cost += statIncreaseCost(v);
  return cost;
}

/** Pontos já gastos em um conjunto de stats (a partir do mínimo 1). */
export function spentStatPoints(stats: BaseStats): number {
  return STAT_KEYS.reduce((sum, key) => sum + statCostRange(MIN_STAT, stats[key]), 0);
}

/** Pontos ganhos ao alcançar `level` (level >= 2). */
export function statPointsForLevel(level: number): number {
  return Math.floor(level / 5) + 3;
}

/** Total de pontos acumulados até `level`, incluindo os iniciais. */
export function totalStatPoints(level: number): number {
  let total = STARTING_STAT_POINTS;
  for (let l = 2; l <= level; l++) total += statPointsForLevel(l);
  return total;
}

/** Pontos livres: derivados de nível + stats, então não precisam ser salvos separadamente. */
export function availableStatPoints(level: number, stats: BaseStats): number {
  return totalStatPoints(level) - spentStatPoints(stats);
}

export function attackDelayMs(aspd: number): number {
  const clamped = Math.min(MAX_ASPD, Math.max(0, aspd));
  return (200 - clamped) * 20;
}

/** Equipamentos + bônus extras (Selos), tudo que soma como equipamento. */
function allBonuses(input: CharacterStatsInput): readonly EquipBonus[] {
  return [...(input.equipment ?? []), ...(input.bonuses ?? [])];
}

/** Stats efetivos: distribuídos + bônus de classe + bônus de equipamento e Selos. */
export function effectiveStats(input: CharacterStatsInput): BaseStats {
  const result = { ...input.stats };
  const bonuses = allBonuses(input);
  for (const key of STAT_KEYS) {
    result[key] += input.classDef.statBonus[key] ?? 0;
    for (const eq of bonuses) result[key] += eq.stats?.[key] ?? 0;
  }
  return result;
}

type BonusKey = 'maxHp' | 'maxSp' | 'atk' | 'def' | 'matk' | 'mdef' | 'hit' | 'flee' | 'crit';

function sumEquip(bonuses: readonly EquipBonus[], key: BonusKey): number {
  return bonuses.reduce((sum, eq) => sum + (eq[key] ?? 0), 0);
}

export function computeDerivedStats(input: CharacterStatsInput): DerivedStats {
  const { level, classDef } = input;
  const equipment = allBonuses(input);
  const s = effectiveStats(input);
  const weapon = input.equipment?.find((eq) => eq.slot === 'weapon');
  const ranged = weapon?.weaponType === 'ranged';
  const main = ranged ? s.dex : s.str;
  const secondary = ranged ? s.str : s.dex;

  const aspd = Math.min(MAX_ASPD, Math.floor(classDef.baseAspd + (s.agi * 4 + s.dex) / 10));

  return {
    maxHp:
      Math.floor((classDef.baseHp + (level - 1) * classDef.hpPerLevel) * (1 + s.vit / 100)) + sumEquip(equipment, 'maxHp'),
    maxSp:
      Math.floor((classDef.baseSp + (level - 1) * classDef.spPerLevel) * (1 + s.int / 100)) + sumEquip(equipment, 'maxSp'),
    atk: main + Math.floor(main / 10) ** 2 + Math.floor(secondary / 5) + Math.floor(s.luk / 5) + sumEquip(equipment, 'atk'),
    matk: s.int + Math.floor(s.int / 5) ** 2 + sumEquip(equipment, 'matk'),
    def: Math.floor(s.vit / 2) + sumEquip(equipment, 'def'),
    mdef: Math.floor(s.int / 2) + Math.floor(s.vit / 5) + sumEquip(equipment, 'mdef'),
    hit: level + s.dex + sumEquip(equipment, 'hit'),
    flee: level + s.agi + sumEquip(equipment, 'flee'),
    crit: 1 + Math.floor(s.luk * 0.3) + sumEquip(equipment, 'crit'),
    aspd,
    attackDelayMs: attackDelayMs(aspd),
    moveSpeed: classDef.moveSpeed,
  };
}

/**
 * Prévia de uma distribuição de pontos (`allocation` = quanto somar em cada stat).
 * Não altera nada; a UI mostra `before` x `after` e só confirma se `valid`.
 */
export function previewStats(input: CharacterStatsInput, allocation: Partial<BaseStats>): StatPreview {
  const before = computeDerivedStats(input);
  const available = availableStatPoints(input.level, input.stats);
  const next = { ...input.stats };
  let cost = 0;
  let reason: string | undefined;

  for (const key of STAT_KEYS) {
    const add = allocation[key] ?? 0;
    if (!Number.isInteger(add) || add < 0) {
      reason = `Valor inválido para ${key}`;
      break;
    }
    const target = input.stats[key] + add;
    if (target > MAX_STAT) {
      reason = `${key} não pode passar de ${MAX_STAT}`;
      break;
    }
    cost += statCostRange(input.stats[key], target);
    next[key] = target;
  }
  if (!reason && cost > available) reason = 'Pontos insuficientes';

  if (reason) {
    return { valid: false, reason, stats: { ...input.stats }, cost, remainingPoints: available, before, after: before };
  }
  return {
    valid: true,
    stats: next,
    cost,
    remainingPoints: available - cost,
    before,
    after: computeDerivedStats({ ...input, stats: next }),
  };
}

/** Aplica a distribuição; retorna null se inválida. */
export function allocateStats(input: CharacterStatsInput, allocation: Partial<BaseStats>): BaseStats | null {
  const preview = previewStats(input, allocation);
  return preview.valid ? preview.stats : null;
}

export function canRespecFree(level: number): boolean {
  return level <= FREE_RESPEC_MAX_LEVEL;
}

/**
 * Redistribuição: volta todos os stats ao mínimo, devolvendo os pontos.
 * Grátis até FREE_RESPEC_MAX_LEVEL; depois retorna null (exigirá item/NPC em marcos futuros).
 */
export function respecStats(level: number): BaseStats | null {
  return canRespecFree(level) ? defaultBaseStats() : null;
}
