// Selos: estoque por grau, fusão, encaixe em equipamentos e Ressonância.
// Funções puras (devolvem cópias); a janela de Inventário e a Seladora usam as mesmas.
// Regras documentadas em docs/design.md (seção Selos).

import { getSeal, hasSeal, SEALS_DATA } from '../data';
import type { EquipBonus, EquipSlot, ResonanceRule, SealDef, SealGrade, StatKey } from '../data/types';

export const SEAL_GRADES: readonly SealGrade[] = [1, 2, 3];
export const MAX_SEAL_GRADE: SealGrade = 3;
export const GRADE_NAMES: Record<SealGrade, string> = { 1: 'I', 2: 'II', 3: 'III' };

/** Quantidade de Selos por grau: [I, II, III]. */
export type SealCounts = [number, number, number];

/** Selos soltos (fora dos equipamentos), por sealId. */
export type SealStock = Readonly<Record<string, SealCounts>>;

/** Um Selo específico (tipo + grau). */
export interface SealRef {
  sealId: string;
  grade: SealGrade;
}

/** Encaixes do equipamento vestido em cada slot (tamanho = `sealSlots` do item; null = vazio). */
export type SocketMap = Readonly<Partial<Record<EquipSlot, readonly (SealRef | null)[]>>>;

/** Estoque + encaixes: tudo que as operações de Selo mexem. */
export interface SealLoadout {
  stock: SealStock;
  sockets: SocketMap;
}

export type SealResult = { ok: true; loadout: SealLoadout; message: string } | { ok: false; message: string };

export function isSealGrade(v: unknown): v is SealGrade {
  return v === 1 || v === 2 || v === 3;
}

export function sealCount(stock: SealStock, ref: SealRef): number {
  return stock[ref.sealId]?.[ref.grade - 1] ?? 0;
}

/** Soma (ou tira, com `amount` negativo) Selos do estoque. Nunca deixa contagem negativa. */
export function addToStock(stock: SealStock, ref: SealRef, amount: number): SealStock {
  const counts: SealCounts = [...(stock[ref.sealId] ?? [0, 0, 0])];
  counts[ref.grade - 1] = Math.max(0, counts[ref.grade - 1] + amount);
  return { ...stock, [ref.sealId]: counts };
}

/** Total de Selos soltos de todos os graus. */
export function stockTotal(stock: SealStock): number {
  return Object.values(stock).reduce((sum, c) => sum + c[0] + c[1] + c[2], 0);
}

export function sealName(ref: SealRef): string {
  return `${getSeal(ref.sealId).name} ${GRADE_NAMES[ref.grade]}`;
}

export function sealBonus(ref: SealRef): EquipBonus {
  return getSeal(ref.sealId).grades[ref.grade - 1];
}

export function canSealGoInSlot(seal: SealDef, slot: EquipSlot): boolean {
  return seal.slots.includes(slot);
}

// ---------- Fusão ----------

/** `fusionCost` Selos de um grau viram 1 do grau seguinte (III é o máximo). */
export function fuseSeals(loadout: SealLoadout, ref: SealRef, fusionCost = SEALS_DATA.fusionCost): SealResult {
  if (ref.grade >= MAX_SEAL_GRADE) return { ok: false, message: `${GRADE_NAMES[MAX_SEAL_GRADE]} é o grau máximo.` };
  const have = sealCount(loadout.stock, ref);
  if (have < fusionCost) return { ok: false, message: `Precisa de ${fusionCost} ${sealName(ref)} (tem ${have}).` };
  const next: SealRef = { sealId: ref.sealId, grade: (ref.grade + 1) as SealGrade };
  const stock = addToStock(addToStock(loadout.stock, ref, -fusionCost), next, 1);
  return { ok: true, loadout: { ...loadout, stock }, message: `Fundiu ${fusionCost}× ${GRADE_NAMES[ref.grade]} → ${sealName(next)}!` };
}

// ---------- Encaixe ----------

/** Encaixes de um slot com o tamanho certo (`capacity`), completando com vazios. */
export function socketsOf(sockets: SocketMap, slot: EquipSlot, capacity: number): (SealRef | null)[] {
  const current = sockets[slot] ?? [];
  return Array.from({ length: capacity }, (_, i) => current[i] ?? null);
}

/**
 * Encaixa um Selo do estoque no equipamento do `slot` (que tem `capacity` encaixes).
 * Sem `index`, usa o primeiro encaixe vazio. Encaixe ocupado: o Selo que estava lá volta ao estoque (troca).
 */
export function socketSeal(
  loadout: SealLoadout,
  ref: SealRef,
  slot: EquipSlot,
  capacity: number,
  index?: number,
): SealResult {
  if (!hasSeal(ref.sealId)) return { ok: false, message: 'Selo desconhecido.' };
  const seal = getSeal(ref.sealId);
  if (capacity <= 0) return { ok: false, message: 'Este equipamento não tem encaixes.' };
  if (!canSealGoInSlot(seal, slot)) return { ok: false, message: `${seal.name} não encaixa neste tipo de equipamento.` };
  if (sealCount(loadout.stock, ref) <= 0) return { ok: false, message: `Você não tem ${sealName(ref)}.` };

  const slots = socketsOf(loadout.sockets, slot, capacity);
  const target = index ?? slots.indexOf(null);
  if (target < 0) return { ok: false, message: 'Todos os encaixes estão ocupados.' };
  if (!Number.isInteger(target) || target >= capacity) return { ok: false, message: 'Encaixe inválido.' };

  let stock = addToStock(loadout.stock, ref, -1);
  const previous = slots[target];
  if (previous) stock = addToStock(stock, previous, 1);
  slots[target] = { sealId: ref.sealId, grade: ref.grade };
  return {
    ok: true,
    loadout: { stock, sockets: { ...loadout.sockets, [slot]: slots } },
    message: previous ? `Trocou ${sealName(previous)} por ${sealName(ref)}.` : `Encaixou ${sealName(ref)}.`,
  };
}

/** Tira o Selo de um encaixe e devolve ao estoque (sem custo). */
export function unsocketSeal(loadout: SealLoadout, slot: EquipSlot, index: number): SealResult {
  const current = loadout.sockets[slot] ?? [];
  const ref = current[index];
  if (!ref) return { ok: false, message: 'Encaixe vazio.' };
  const slots = current.map((s, i) => (i === index ? null : s));
  return {
    ok: true,
    loadout: { stock: addToStock(loadout.stock, ref, 1), sockets: { ...loadout.sockets, [slot]: slots } },
    message: `Removeu ${sealName(ref)}.`,
  };
}

/** Devolve ao estoque todos os Selos do slot (ao trocar ou tirar o equipamento). */
export function clearSockets(loadout: SealLoadout, slot: EquipSlot): { loadout: SealLoadout; returned: number } {
  let stock = loadout.stock;
  let returned = 0;
  for (const ref of loadout.sockets[slot] ?? []) {
    if (!ref) continue;
    stock = addToStock(stock, ref, 1);
    returned++;
  }
  const sockets = { ...loadout.sockets };
  delete sockets[slot];
  return { loadout: { stock, sockets }, returned };
}

/** Todos os Selos encaixados. */
export function socketedSeals(sockets: SocketMap): SealRef[] {
  return Object.values(sockets).flatMap((list) => (list ?? []).filter((s): s is SealRef => s !== null));
}

// ---------- Ressonância ----------

export interface ActiveResonance {
  rule: ResonanceRule;
  /** Elemento ou família que ressoou. */
  group: string;
  count: number;
  bonus: EquipBonus;
}

/**
 * Ressonâncias ativas para os Selos encaixados: cada regra agrupa por elemento ou família e ativa
 * quando um grupo com bônus definido chega a `minCount` (com `distinct`, conta só espécies diferentes).
 */
export function activeResonances(
  seals: readonly SealRef[],
  rules: readonly ResonanceRule[] = SEALS_DATA.resonances,
): ActiveResonance[] {
  const active: ActiveResonance[] = [];
  for (const rule of rules) {
    const groups = new Map<string, string[]>();
    for (const ref of seals) {
      const def = getSeal(ref.sealId);
      const group = rule.kind === 'element' ? def.element : def.family;
      groups.set(group, [...(groups.get(group) ?? []), def.id]);
    }
    for (const [group, ids] of groups) {
      const bonus = rule.bonuses[group];
      const count = rule.distinct ? new Set(ids).size : ids.length;
      if (bonus && count >= rule.minCount) active.push({ rule, group, count, bonus });
    }
  }
  return active;
}

/** Bônus de todos os Selos encaixados + Ressonâncias, prontos para `computeDerivedStats`. */
export function sealBonuses(sockets: SocketMap, rules?: readonly ResonanceRule[]): EquipBonus[] {
  const seals = socketedSeals(sockets);
  return [...seals.map(sealBonus), ...activeResonances(seals, rules).map((r) => r.bonus)];
}

const NUMERIC_BONUS_KEYS = ['maxHp', 'maxSp', 'atk', 'def', 'matk', 'mdef', 'hit', 'flee', 'crit'] as const;

/** Soma vários bônus num só (para mostrar "total dos Selos"). */
export function sumBonuses(bonuses: readonly EquipBonus[]): EquipBonus {
  const total: EquipBonus = {};
  for (const b of bonuses) {
    for (const key of NUMERIC_BONUS_KEYS) if (b[key]) total[key] = (total[key] ?? 0) + (b[key] ?? 0);
    for (const [stat, v] of Object.entries(b.stats ?? {}) as [StatKey, number][]) {
      if (!v) continue;
      total.stats = { ...total.stats, [stat]: (total.stats?.[stat] ?? 0) + v };
    }
  }
  return total;
}
