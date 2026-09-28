// Cálculo de dano: acerto/esquiva, crítico, defesa e tabela elemental.
// Fórmulas documentadas em docs/design.md (seção Fórmulas).

import type { Element, MonsterDef, Rng } from '../data/types';
import type { DerivedStats } from './stats';

export const MIN_HIT_CHANCE = 5;
export const MAX_HIT_CHANCE = 95;
export const CRIT_MULTIPLIER = 1.4;
/** Constante da redução de defesa: dano × K / (K + DEF). */
export const DEF_CONSTANT = 50;
/** Variação do dano bruto: ATK × [1 − V, 1 + V). */
export const DAMAGE_VARIANCE = 0.1;

/** Quem vence quem: fogo → terra → vento → água → fogo. */
const STRONG_AGAINST: Record<Element, Element | null> = {
  neutral: null,
  fire: 'earth',
  earth: 'wind',
  wind: 'water',
  water: 'fire',
};

export const ELEMENT_STRONG = 1.5;
export const ELEMENT_WEAK = 0.75;

/** Multiplicador de dano de um ataque `attack` contra um alvo `defense`. */
export function elementMultiplier(attack: Element, defense: Element): number {
  if (STRONG_AGAINST[attack] === defense) return ELEMENT_STRONG;
  if (STRONG_AGAINST[defense] === attack) return ELEMENT_WEAK;
  return 1;
}

export interface CombatStats {
  atk: number;
  def: number;
  hit: number;
  flee: number;
  /** Chance de crítico em %. */
  crit: number;
  attackElement: Element;
  defenseElement: Element;
}

export interface AttackResult {
  hit: boolean;
  crit: boolean;
  damage: number;
  elementMultiplier: number;
}

export function playerCombatStats(
  derived: DerivedStats,
  attackElement: Element = 'neutral',
  defenseElement: Element = 'neutral',
): CombatStats {
  return {
    atk: derived.atk,
    def: derived.def,
    hit: derived.hit,
    flee: derived.flee,
    crit: derived.crit,
    attackElement,
    defenseElement,
  };
}

/** Monstros não critam no Marco 1. */
export function monsterCombatStats(monster: MonsterDef): CombatStats {
  return {
    atk: monster.atk,
    def: monster.def,
    hit: monster.hit,
    flee: monster.flee,
    crit: 0,
    attackElement: monster.element,
    defenseElement: monster.element,
  };
}

/** Chance de acerto em %: 80 + HIT − FLEE, limitada a [5, 95]. */
export function hitChance(hit: number, flee: number): number {
  return Math.min(MAX_HIT_CHANCE, Math.max(MIN_HIT_CHANCE, 80 + hit - flee));
}

/** Aplica a defesa ao dano bruto (nunca menos que 1). */
export function applyDefense(rawDamage: number, def: number): number {
  return Math.max(1, Math.floor((rawDamage * DEF_CONSTANT) / (DEF_CONSTANT + Math.max(0, def))));
}

/**
 * Resolve um ataque básico. Ordem: crítico (sempre acerta, ignora DEF) → teste de acerto →
 * variação → defesa → elemento. Consome 2 ou 3 valores do RNG.
 */
export function resolveAttack(attacker: CombatStats, defender: CombatStats, rng: Rng): AttackResult {
  const element = elementMultiplier(attacker.attackElement, defender.defenseElement);
  const crit = rng() * 100 < attacker.crit;
  if (!crit && rng() * 100 >= hitChance(attacker.hit, defender.flee)) {
    return { hit: false, crit: false, damage: 0, elementMultiplier: element };
  }

  const variance = 1 - DAMAGE_VARIANCE + rng() * DAMAGE_VARIANCE * 2;
  const raw = attacker.atk * variance;
  const afterDef = crit ? Math.floor(raw * CRIT_MULTIPLIER) : applyDefense(raw, defender.def);
  const damage = Math.max(1, Math.floor(afterDef * element));
  return { hit: true, crit, damage, elementMultiplier: element };
}
