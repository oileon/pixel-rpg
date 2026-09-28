// EXP, level up e Fadiga pós-morte.
// Fórmulas documentadas em docs/design.md (seção Fórmulas).

import type { ExpTable } from '../data/types';
import { statPointsForLevel } from './stats';

export const FATIGUE_DURATION_MS = 5 * 60 * 1000;
/** Multiplicador de EXP enquanto fatigado (−30%). */
export const FATIGUE_EXP_MULTIPLIER = 0.7;
/** Diferença de nível (jogador − monstro) tolerada sem penalidade. */
export const LEVEL_DIFF_GRACE = 5;
export const LEVEL_DIFF_PENALTY_PER_LEVEL = 0.1;
export const LEVEL_DIFF_MIN_MULTIPLIER = 0.1;

export interface ExpProgress {
  level: number;
  /** EXP acumulada dentro do nível atual. */
  exp: number;
}

export interface ExpGainResult extends ExpProgress {
  levelsGained: number;
  statPointsGained: number;
}

/** Fadiga: timestamp (ms) até quando dura. null/undefined = sem fadiga. */
export interface FatigueState {
  until: number;
}

/** EXP necessária para sair de `level`; null no nível máximo. */
export function expToNextLevel(level: number, table: ExpTable): number | null {
  if (level >= table.maxLevel) return null;
  return table.expToNext[level - 1] ?? null;
}

/** Fração 0..1 da barra de EXP (1 no nível máximo). */
export function expProgressRatio(progress: ExpProgress, table: ExpTable): number {
  const need = expToNextLevel(progress.level, table);
  return need === null ? 1 : Math.min(1, progress.exp / need);
}

/** Penalidade por caçar monstros muito abaixo do seu nível. */
export function levelDiffMultiplier(playerLevel: number, monsterLevel: number): number {
  const excess = playerLevel - monsterLevel - LEVEL_DIFF_GRACE;
  if (excess <= 0) return 1;
  return Math.max(LEVEL_DIFF_MIN_MULTIPLIER, 1 - excess * LEVEL_DIFF_PENALTY_PER_LEVEL);
}

/** Morrer (re)inicia a Fadiga; não acumula, só renova o tempo. */
export function applyDeathFatigue(nowMs: number): FatigueState {
  return { until: nowMs + FATIGUE_DURATION_MS };
}

export function isFatigued(fatigue: FatigueState | null | undefined, nowMs: number): boolean {
  return !!fatigue && nowMs < fatigue.until;
}

export function fatigueRemainingMs(fatigue: FatigueState | null | undefined, nowMs: number): number {
  return fatigue ? Math.max(0, fatigue.until - nowMs) : 0;
}

export function fatigueMultiplier(fatigue: FatigueState | null | undefined, nowMs: number): number {
  return isFatigued(fatigue, nowMs) ? FATIGUE_EXP_MULTIPLIER : 1;
}

export interface ExpGainInput {
  baseExp: number;
  playerLevel: number;
  monsterLevel: number;
  fatigue?: FatigueState | null;
  nowMs: number;
}

/** EXP efetiva de um abate: base × diferença de nível × fadiga (mínimo 1). */
export function calculateExpGain(input: ExpGainInput): number {
  if (input.baseExp <= 0) return 0;
  const mult = levelDiffMultiplier(input.playerLevel, input.monsterLevel) * fatigueMultiplier(input.fatigue, input.nowMs);
  return Math.max(1, Math.floor(input.baseExp * mult));
}

/** Soma EXP, processando vários level ups de uma vez. No nível máximo a EXP fica em 0. */
export function addExp(progress: ExpProgress, amount: number, table: ExpTable): ExpGainResult {
  let { level, exp } = progress;
  exp += Math.max(0, amount);
  let levelsGained = 0;
  let statPointsGained = 0;

  let need = expToNextLevel(level, table);
  while (need !== null && exp >= need) {
    exp -= need;
    level++;
    levelsGained++;
    statPointsGained += statPointsForLevel(level);
    need = expToNextLevel(level, table);
  }
  if (need === null) exp = 0;

  return { level, exp, levelsGained, statPointsGained };
}
