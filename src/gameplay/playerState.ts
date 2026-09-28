// Estado persistente do jogador (sobrevive às trocas de cena) e as regras que o alteram.
// Sem Phaser: tudo aqui é testável em Node. A camada de cena só chama estas funções.

import { CURRENCY, EXP_TABLE, getClass, getItem, getSeal, getStarterClass, hasSeal } from '../data';
import type { BaseStats, EquipSlot, ItemDef, MonsterDef, Rng, SealGrade } from '../data/types';
import { markSealObtained, markSeen, recordKill, type Bestiary } from '../systems/bestiary';
import { playerCombatStats, type CombatStats } from '../systems/combat';
import { addExp, applyDeathFatigue, calculateExpGain, type FatigueState } from '../systems/exp';
import { assignToFreeSlot, createHotbar, setSlot, type Hotbar } from '../systems/hotbar';
import { addItem, createInventory, removeFromSlot, type Inventory } from '../systems/inventory';
import {
  addSealFragments,
  rollCurrency,
  rollDrops,
  SEAL_FRAGMENTS_REQUIRED,
  type DroppedItem,
  type SealFragments,
} from '../systems/loot';
import {
  addToStock,
  clearSockets,
  fuseSeals,
  sealBonuses,
  socketSeal,
  unsocketSeal,
  type SealLoadout,
  type SealRef,
  type SealResult,
  type SealStock,
  type SocketMap,
} from '../systems/seals';
import {
  allocateStats,
  computeDerivedStats,
  defaultBaseStats,
  respecStats,
  type CharacterStatsInput,
  type DerivedStats,
} from '../systems/stats';
import {
  REGEN_COMBAT_COOLDOWN_MS,
  REGEN_HP_DIVISOR,
  REGEN_HP_MIN,
  REGEN_HP_VIT_DIVISOR,
  REGEN_INTERVAL_MS,
  REGEN_SP_DIVISOR,
  REGEN_SP_INT_DIVISOR,
  REGEN_SP_MIN,
} from './config';

export interface PlayerState {
  classId: string;
  level: number;
  exp: number;
  stats: BaseStats;
  hp: number;
  sp: number;
  inventory: Inventory;
  /** itemId equipado por slot (fora do inventário). */
  equipment: Partial<Record<EquipSlot, string>>;
  sealFragments: SealFragments;
  /** Selos soltos por sealId e grau ([I, II, III]); os encaixados ficam em `equipmentSeals`. */
  seals: SealStock;
  /** Selos encaixados no equipamento vestido em cada slot. Voltam a `seals` ao tirar o equipamento. */
  equipmentSeals: SocketMap;
  /** Monstros vistos, abates e Selos obtidos (tecla B). */
  bestiary: Bestiary;
  /** Moeda na bolsa (id interno `currency`; nome exibido em currency.json). */
  currency: number;
  /** Atalhos das teclas 1–8. */
  hotbar: Hotbar;
  fatigue: FatigueState | null;
  autoPickup: boolean;
  /** Caiu e ainda não voltou ao ponto seguro (HP 0, Fadiga já aplicada). */
  downed: boolean;
  /** Tempo de jogo (ms, relógio do game loop) do último golpe dado ou recebido. */
  lastCombatAt: number | null;
  /** Tempo de jogo do último tick de regeneração. */
  lastRegenAt: number;
}

export interface ActionResult {
  ok: boolean;
  /** Mensagem para o jogador (em português). */
  message?: string;
}

export interface KillReward {
  exp: number;
  levelsGained: number;
  newLevel: number;
  /** Pontos de status de todos os níveis ganhos neste abate (de `addExp`). */
  statPointsGained: number;
  sealsCompleted: number;
  sealId: string;
  /** Moeda ganha (já somada à bolsa). */
  currency: number;
  drops: DroppedItem[];
}

/** Personagem novo: classe inicial e kit definidos em classes.json. */
export function createInitialPlayerState(): PlayerState {
  const classDef = getStarterClass();
  const kit = classDef.startingKit ?? { equipment: {}, items: [] };
  let inventory = createInventory();
  let hotbar = createHotbar();
  for (const { itemId, quantity } of kit.items) {
    inventory = addItem(inventory, getItem(itemId), quantity).inventory;
    // Consumíveis do kit já vêm na barra de atalhos.
    if (getItem(itemId).type === 'consumable') hotbar = assignToFreeSlot(hotbar, { kind: 'item', itemId }).hotbar;
  }
  const state: PlayerState = {
    classId: classDef.id,
    level: 1,
    exp: 0,
    stats: defaultBaseStats(),
    hp: 0,
    sp: 0,
    inventory,
    equipment: { ...kit.equipment },
    sealFragments: {},
    seals: {},
    equipmentSeals: {},
    bestiary: {},
    currency: 0,
    hotbar,
    fatigue: null,
    autoPickup: false,
    downed: false,
    lastCombatAt: null,
    lastRegenAt: 0,
  };
  fullHeal(state);
  return state;
}

/** Estado global do jogador na sessão atual. */
export const playerState: PlayerState = createInitialPlayerState();

/** Troca o conteúdo de `target` pelo de `source` (o objeto global é importado por referência). */
export function replacePlayerState(target: PlayerState, source: PlayerState): void {
  for (const key of Object.keys(target) as (keyof PlayerState)[]) delete target[key];
  Object.assign(target, source);
}

export function equippedItems(state: PlayerState): ItemDef[] {
  return Object.values(state.equipment)
    .filter((id): id is string => !!id)
    .map(getItem);
}

export function statsInput(state: PlayerState): CharacterStatsInput {
  return {
    level: state.level,
    stats: state.stats,
    classDef: getClass(state.classId),
    equipment: equippedItems(state).flatMap((item) => (item.equip ? [item.equip] : [])),
    bonuses: sealBonuses(state.equipmentSeals),
  };
}

export function playerDerived(state: PlayerState): DerivedStats {
  return computeDerivedStats(statsInput(state));
}

export function playerCombat(state: PlayerState): CombatStats {
  const weapon = state.equipment.weapon ? getItem(state.equipment.weapon) : null;
  return playerCombatStats(playerDerived(state), weapon?.equip?.element ?? 'neutral');
}

/** Garante HP/SP dentro de [0, máximo] (ex.: depois de trocar equipamento ou stats). */
export function clampVitals(state: PlayerState): void {
  const d = playerDerived(state);
  state.hp = Math.max(0, Math.min(state.hp, d.maxHp));
  state.sp = Math.max(0, Math.min(state.sp, d.maxSp));
}

export function fullHeal(state: PlayerState): void {
  const d = playerDerived(state);
  state.hp = d.maxHp;
  state.sp = d.maxSp;
}

/** Aplica dano; retorna true se o jogador caiu. */
export function takeDamage(state: PlayerState, amount: number): boolean {
  state.hp = Math.max(0, state.hp - amount);
  return state.hp === 0;
}

// ---------- Regeneração ----------

/** Quanto HP/SP um tick de regeneração recupera. */
export function regenAmounts(state: PlayerState): { hp: number; sp: number } {
  const d = playerDerived(state);
  return {
    hp: Math.max(REGEN_HP_MIN, Math.floor(d.maxHp / REGEN_HP_DIVISOR) + Math.floor(state.stats.vit / REGEN_HP_VIT_DIVISOR)),
    sp: Math.max(REGEN_SP_MIN, Math.floor(d.maxSp / REGEN_SP_DIVISOR) + Math.floor(state.stats.int / REGEN_SP_INT_DIVISOR)),
  };
}

export function regenTick(state: PlayerState): void {
  const { hp, sp } = regenAmounts(state);
  state.hp += hp;
  state.sp += sp;
  clampVitals(state);
}

/** Registra um golpe dado ou recebido (interrompe a regeneração). */
export function markCombat(state: PlayerState, gameTimeMs: number): void {
  state.lastCombatAt = gameTimeMs;
}

/**
 * Regeneração fora de combate. Os tempos vivem no estado, então trocar de mapa não
 * reinicia o relógio. Retorna true se aplicou um tick.
 */
export function updateRegen(state: PlayerState, gameTimeMs: number): boolean {
  if (state.downed) return false;
  if (state.lastCombatAt !== null && gameTimeMs - state.lastCombatAt < REGEN_COMBAT_COOLDOWN_MS) {
    state.lastRegenAt = gameTimeMs;
    return false;
  }
  if (gameTimeMs - state.lastRegenAt < REGEN_INTERVAL_MS) return false;
  state.lastRegenAt = gameTimeMs;
  regenTick(state);
  return true;
}

// ---------- Morte e abates ----------

/**
 * Golpe fatal: aplica a Fadiga na hora (independe da cena/efeitos) e marca o jogador como caído.
 * Não perde EXP nem itens. O HP volta em `revivePlayer`, ao chegar no ponto seguro.
 */
export function knockOutPlayer(state: PlayerState, nowMs: number): void {
  state.fatigue = applyDeathFatigue(nowMs);
  state.hp = 0;
  state.downed = true;
}

/** Jogador caído (ou com HP 0 por qualquer motivo) precisa ir ao ponto seguro. */
export function needsRevive(state: PlayerState): boolean {
  return state.downed || state.hp <= 0;
}

/** Volta ao ponto seguro: HP/SP cheios. */
export function revivePlayer(state: PlayerState): void {
  state.downed = false;
  state.lastCombatAt = null;
  fullHeal(state);
}

export function setAutoPickup(state: PlayerState, enabled: boolean): void {
  state.autoPickup = enabled;
}

/** Recompensas de um abate: EXP (com Fadiga), level up, fragmentos de Selo e drops rolados. */
export function grantKill(state: PlayerState, monster: MonsterDef, nowMs: number, rng: Rng): KillReward {
  const exp = calculateExpGain({
    baseExp: monster.exp,
    playerLevel: state.level,
    monsterLevel: monster.level,
    fatigue: state.fatigue,
    nowMs,
  });
  const gain = addExp({ level: state.level, exp: state.exp }, exp, EXP_TABLE);
  state.level = gain.level;
  state.exp = gain.exp;
  if (gain.levelsGained > 0) fullHeal(state);

  const currency = addCurrency(state, rollCurrency(monster, rng));

  const required = hasSeal(monster.sealId) ? getSeal(monster.sealId).fragmentsRequired : SEAL_FRAGMENTS_REQUIRED;
  const seal = addSealFragments(state.sealFragments, monster, required);
  state.sealFragments = seal.fragments;
  state.bestiary = recordKill(state.bestiary, monster.id);
  if (seal.sealsCompleted > 0) {
    // Selo completo vira um Selo de grau I no estojo.
    state.seals = addToStock(state.seals, { sealId: seal.sealId, grade: 1 }, seal.sealsCompleted);
    state.bestiary = markSealObtained(state.bestiary, monster.id);
  }

  return {
    exp,
    levelsGained: gain.levelsGained,
    newLevel: gain.level,
    statPointsGained: gain.statPointsGained,
    sealsCompleted: seal.sealsCompleted,
    sealId: seal.sealId,
    currency,
    drops: rollDrops(monster, rng),
  };
}

// ---------- Moeda ----------

/** Soma à bolsa respeitando o limite; retorna quanto entrou. */
export function addCurrency(state: PlayerState, amount: number): number {
  const added = Math.max(0, Math.min(Math.floor(amount), CURRENCY.max - state.currency));
  state.currency += added;
  return added;
}

/** Gasta se houver saldo (para o Mercador, entrega futura). */
export function spendCurrency(state: PlayerState, amount: number): boolean {
  if (amount < 0 || !Number.isInteger(amount) || state.currency < amount) return false;
  state.currency -= amount;
  return true;
}

// ---------- Inventário e equipamento ----------

/** Guarda um item pego do chão; retorna quanto coube. */
export function pickUp(state: PlayerState, itemId: string, quantity: number): number {
  const result = addItem(state.inventory, getItem(itemId), quantity);
  state.inventory = result.inventory;
  return result.added;
}

/** Usa o item de um slot: consumível cura, equipamento é equipado. */
export function useSlot(state: PlayerState, slotIndex: number): ActionResult {
  const slot = state.inventory.slots[slotIndex];
  if (!slot) return { ok: false };
  if (state.downed) return { ok: false, message: 'Você está desmaiado.' };
  const item = getItem(slot.itemId);
  if (item.type === 'equipment') return equipFromSlot(state, slotIndex);
  if (item.type !== 'consumable' || !item.effect) return { ok: false, message: `${item.name} não pode ser usado.` };

  const d = playerDerived(state);
  const healsHp = (item.effect.hp ?? 0) > 0 && state.hp < d.maxHp;
  const healsSp = (item.effect.sp ?? 0) > 0 && state.sp < d.maxSp;
  if (!healsHp && !healsSp) return { ok: false, message: 'Já está cheio.' };

  state.inventory = removeFromSlot(state.inventory, slotIndex, 1).inventory;
  state.hp += item.effect.hp ?? 0;
  state.sp += item.effect.sp ?? 0;
  clampVitals(state);
  return { ok: true, message: `Usou ${item.name}.` };
}

export function equipFromSlot(state: PlayerState, slotIndex: number): ActionResult {
  const slot = state.inventory.slots[slotIndex];
  if (!slot) return { ok: false };
  const item = getItem(slot.itemId);
  if (!item.equip) return { ok: false, message: `${item.name} não é um equipamento.` };
  const required = item.equip.requiredLevel ?? 1;
  if (state.level < required) return { ok: false, message: `Requer nível ${required}.` };

  let inventory = removeFromSlot(state.inventory, slotIndex, 1).inventory;
  const previous = state.equipment[item.equip.slot];
  if (previous) {
    const back = addItem(inventory, getItem(previous), 1);
    if (back.overflow > 0) return { ok: false, message: 'Inventário cheio.' };
    inventory = back.inventory;
  }
  state.inventory = inventory;
  const returned = previous ? returnSocketedSeals(state, item.equip.slot) : 0;
  state.equipment[item.equip.slot] = item.id;
  clampVitals(state);
  return { ok: true, message: `Equipou ${item.name}.${sealsReturnedNote(returned)}` };
}

export function unequip(state: PlayerState, slot: EquipSlot): ActionResult {
  const itemId = state.equipment[slot];
  if (!itemId) return { ok: false };
  const result = addItem(state.inventory, getItem(itemId), 1);
  if (result.overflow > 0) return { ok: false, message: 'Inventário cheio.' };
  state.inventory = result.inventory;
  const returned = returnSocketedSeals(state, slot);
  delete state.equipment[slot];
  clampVitals(state);
  return { ok: true, message: `Removeu ${getItem(itemId).name}.${sealsReturnedNote(returned)}` };
}

/** Selos do equipamento que sai do slot voltam ao estojo; retorna quantos. */
function returnSocketedSeals(state: PlayerState, slot: EquipSlot): number {
  const { loadout, returned } = clearSockets(sealLoadout(state), slot);
  applyLoadout(state, loadout);
  return returned;
}

function sealsReturnedNote(returned: number): string {
  if (returned === 0) return '';
  return returned === 1 ? ' O Selo voltou ao estojo.' : ` ${returned} Selos voltaram ao estojo.`;
}

/** Atributos derivados se `itemId` fosse equipado no lugar do que ocupa o mesmo slot. */
export function previewEquip(state: PlayerState, itemId: string): DerivedStats {
  const item = getItem(itemId);
  if (!item.equip) return playerDerived(state);
  const equipment = { ...state.equipment, [item.equip.slot]: itemId };
  // O item que sai leva os Selos dele de volta ao estojo; o novo entra sem Selos.
  const equipmentSeals = clearSockets(sealLoadout(state), item.equip.slot).loadout.sockets;
  return playerDerived({ ...state, equipment, equipmentSeals });
}

// ---------- Selos ----------

export function sealLoadout(state: PlayerState): SealLoadout {
  return { stock: state.seals, sockets: state.equipmentSeals };
}

function applyLoadout(state: PlayerState, loadout: SealLoadout): void {
  state.seals = loadout.stock;
  state.equipmentSeals = loadout.sockets;
}

/** Encaixes do equipamento vestido no slot (0 se vazio). */
export function sealCapacity(state: PlayerState, slot: EquipSlot): number {
  const itemId = state.equipment[slot];
  return itemId ? (getItem(itemId).equip?.sealSlots ?? 0) : 0;
}

function applySealResult(state: PlayerState, result: SealResult): ActionResult {
  if (!result.ok) return { ok: false, message: result.message };
  applyLoadout(state, result.loadout);
  clampVitals(state);
  return { ok: true, message: result.message };
}

/** Encaixa um Selo do estojo no equipamento vestido em `slot` (sem `index`: primeiro encaixe vazio). */
export function socketSealInto(state: PlayerState, ref: SealRef, slot: EquipSlot, index?: number): ActionResult {
  if (!state.equipment[slot]) return { ok: false, message: 'Nada equipado neste slot.' };
  return applySealResult(state, socketSeal(sealLoadout(state), ref, slot, sealCapacity(state, slot), index));
}

/** Tira o Selo do encaixe e devolve ao estojo. */
export function removeSealFrom(state: PlayerState, slot: EquipSlot, index: number): ActionResult {
  return applySealResult(state, unsocketSeal(sealLoadout(state), slot, index));
}

/** Funde Selos soltos do mesmo tipo e grau no grau seguinte. */
export function fuseSealStock(state: PlayerState, sealId: string, grade: SealGrade): ActionResult {
  return applySealResult(state, fuseSeals(sealLoadout(state), { sealId, grade }));
}

/** Atributos se `ref` fosse encaixado no slot (no encaixe `index` ou no primeiro vazio); null se não der. */
export function previewSocket(state: PlayerState, ref: SealRef, slot: EquipSlot, index?: number): DerivedStats | null {
  const result = socketSeal(sealLoadout(state), ref, slot, sealCapacity(state, slot), index);
  return result.ok ? playerDerived({ ...state, equipmentSeals: result.loadout.sockets }) : null;
}

// ---------- Bestiário ----------

/** Registra que o jogador viu o monstro; retorna true se é a primeira vez. */
export function seeMonster(state: PlayerState, monsterId: string): boolean {
  const next = markSeen(state.bestiary, monsterId);
  if (next === state.bestiary) return false;
  state.bestiary = next;
  return true;
}

// ---------- Barra de atalhos ----------

/** Clique direito num item do inventário: vai para o primeiro atalho livre (só consumíveis). */
export function assignSlotToHotbar(state: PlayerState, slotIndex: number): ActionResult {
  const slot = state.inventory.slots[slotIndex];
  if (!slot) return { ok: false };
  const item = getItem(slot.itemId);
  if (item.type !== 'consumable') return { ok: false, message: 'Só consumíveis vão para a barra de atalhos.' };
  const r = assignToFreeSlot(state.hotbar, { kind: 'item', itemId: item.id });
  if (r.already) return { ok: true, message: `${item.name} já está no atalho ${r.index + 1}.` };
  if (r.index < 0) return { ok: false, message: 'Barra de atalhos cheia.' };
  state.hotbar = r.hotbar;
  return { ok: true, message: `${item.name} → atalho ${r.index + 1}.` };
}

export function clearHotbarSlot(state: PlayerState, index: number): void {
  state.hotbar = setSlot(state.hotbar, index, null);
}

/** Tecla 1–8: usa o item (primeira pilha no inventário) ou, no futuro, a skill. */
export function useHotbarSlot(state: PlayerState, index: number): ActionResult {
  const entry = state.hotbar[index];
  if (!entry) return { ok: false };
  if (entry.kind === 'skill') return { ok: false, message: 'Skills ainda não existem.' };
  const slotIndex = state.inventory.slots.findIndex((s) => s?.itemId === entry.itemId);
  if (slotIndex < 0) return { ok: false, message: `Sem ${getItem(entry.itemId).name}.` };
  return useSlot(state, slotIndex);
}

// ---------- Stats ----------

export function applyAllocation(state: PlayerState, allocation: Partial<BaseStats>): boolean {
  const next = allocateStats(statsInput(state), allocation);
  if (!next) return false;
  const before = playerDerived(state);
  state.stats = next;
  const after = playerDerived(state);
  // Aumentos de HP/SP máximos entram cheios, como no RO.
  state.hp += Math.max(0, after.maxHp - before.maxHp);
  state.sp += Math.max(0, after.maxSp - before.maxSp);
  clampVitals(state);
  return true;
}

export function respecPlayer(state: PlayerState): boolean {
  const next = respecStats(state.level);
  if (!next) return false;
  state.stats = next;
  clampVitals(state);
  return true;
}
