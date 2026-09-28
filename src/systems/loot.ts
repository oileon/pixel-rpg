// Rolagem de drops (RNG injetável) e fragmentos de Selo.
// Fórmulas documentadas em docs/design.md (seção Fórmulas).

import type { MonsterDef, Rng } from '../data/types';

/** Fragmentos padrão para completar um Selo (cada Selo define o seu em seals.json: `fragmentsRequired`). */
export const SEAL_FRAGMENTS_REQUIRED = 100;

export interface DroppedItem {
  itemId: string;
  quantity: number;
}

/** RNG determinístico (mulberry32) para testes e replays. */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cada entrada de drop é rolada de forma independente: cai se rng() < chance × dropRateMultiplier.
 * Consome exatamente um valor do RNG por entrada.
 */
export function rollDrops(monster: MonsterDef, rng: Rng, dropRateMultiplier = 1): DroppedItem[] {
  const result: DroppedItem[] = [];
  for (const drop of monster.drops) {
    const chance = Math.min(1, drop.chance * dropRateMultiplier);
    if (rng() < chance) result.push({ itemId: drop.itemId, quantity: drop.quantity ?? 1 });
  }
  return result;
}

/** Moeda do abate: rola `chance`; se cair, valor uniforme em [min, max]. Consome 1 ou 2 valores do RNG. */
export function rollCurrency(monster: MonsterDef, rng: Rng): number {
  const drop = monster.currency;
  if (!drop || rng() >= drop.chance) return 0;
  return drop.min + Math.floor(rng() * (drop.max - drop.min + 1));
}

/** Progresso de fragmentos por sealId. */
export type SealFragments = Readonly<Record<string, number>>;

export interface SealFragmentResult {
  fragments: SealFragments;
  /** Quantos Selos foram completados neste abate (normalmente 0 ou 1). */
  sealsCompleted: number;
  sealId: string;
}

/**
 * Adiciona os fragmentos de um abate. Ao atingir SEAL_FRAGMENTS_REQUIRED o Selo é garantido
 * e o excedente continua acumulando para o próximo.
 */
export function addSealFragments(
  fragments: SealFragments,
  monster: MonsterDef,
  required = SEAL_FRAGMENTS_REQUIRED,
): SealFragmentResult {
  const total = (fragments[monster.sealId] ?? 0) + monster.fragmentsPerKill;
  const sealsCompleted = Math.floor(total / required);
  return {
    fragments: { ...fragments, [monster.sealId]: total % required },
    sealsCompleted,
    sealId: monster.sealId,
  };
}
