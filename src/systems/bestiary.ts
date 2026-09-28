// Bestiário progressivo: o que o jogador já viu, quantos abates e se já obteve o Selo de cada monstro.
// Funções puras (devolvem cópias). Regras em docs/design.md (seção Bestiário).

import { BESTIARY } from '../data';
import type { BestiaryConfig } from '../data/types';

export interface BestiaryEntry {
  /** Abates (o monstro já foi visto se existe entrada). */
  kills: number;
  /** Já completou ao menos um Selo deste monstro (fica true mesmo se fundir/encaixar). */
  sealObtained: boolean;
}

/** Por monsterId; sem entrada = nunca visto. */
export type Bestiary = Readonly<Record<string, BestiaryEntry>>;

/** O que a entrada de um monstro mostra. */
export interface BestiaryReveal {
  /** Nome e sprite (sem isso: silhueta e "???"). */
  seen: boolean;
  /** Nível, HP, ATK, DEF, FLEE, EXP, elemento e comportamento. */
  stats: boolean;
  /** Drops e moeda. */
  drops: boolean;
  /** Lore curta e efeitos do Selo. */
  lore: boolean;
}

export function markSeen(bestiary: Bestiary, monsterId: string): Bestiary {
  if (bestiary[monsterId]) return bestiary;
  return { ...bestiary, [monsterId]: { kills: 0, sealObtained: false } };
}

export function recordKill(bestiary: Bestiary, monsterId: string): Bestiary {
  const entry = bestiary[monsterId] ?? { kills: 0, sealObtained: false };
  return { ...bestiary, [monsterId]: { ...entry, kills: entry.kills + 1 } };
}

export function markSealObtained(bestiary: Bestiary, monsterId: string): Bestiary {
  const entry = bestiary[monsterId] ?? { kills: 0, sealObtained: false };
  if (entry.sealObtained) return bestiary;
  return { ...bestiary, [monsterId]: { ...entry, sealObtained: true } };
}

/** Visto → 1 abate revela stats → 10 abates revela drops → Selo obtido revela a lore. */
export function bestiaryReveal(entry: BestiaryEntry | undefined, config: BestiaryConfig = BESTIARY): BestiaryReveal {
  if (!entry) return { seen: false, stats: false, drops: false, lore: false };
  return {
    seen: true,
    stats: entry.kills >= config.statsKills,
    drops: entry.kills >= config.dropsKills,
    lore: entry.sealObtained,
  };
}

/** Quantos monstros da lista já foram vistos (para "Vistos 2/3"). */
export function seenCount(bestiary: Bestiary, monsterIds: readonly string[]): number {
  return monsterIds.filter((id) => bestiary[id]).length;
}
