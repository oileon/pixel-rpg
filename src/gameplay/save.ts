// Save do jogo: montagem, serialização, migração e validação. Sem Phaser nem localStorage
// (isso fica em saveGame.ts), então tudo aqui é testável em Node.
//
// Regra: um save corrompido, de versão desconhecida ou sem migração nunca quebra o jogo —
// `parseSave` devolve `ok: false` e quem chama começa um personagem novo com aviso.
// Problemas pequenos (item removido do jogo, mapa inexistente) são corrigidos com `warnings`.

import { CLASSES, CURRENCY, EXP_TABLE, getItem, getSeal, hasSeal, ITEMS, MONSTERS } from '../data';
import type { BaseStats, EquipSlot } from '../data/types';
import type { BestiaryEntry } from '../systems/bestiary';
import { addToStock, canSealGoInSlot, isSealGrade, type SealCounts, type SealRef, type SealStock } from '../systems/seals';
import { createHotbar, HOTBAR_SIZE, type HotbarEntry } from '../systems/hotbar';
import { DEFAULT_INVENTORY_SLOTS, type InventorySlot } from '../systems/inventory';
import { defaultBaseStats, MAX_STAT, MIN_STAT, spentStatPoints, STAT_KEYS, totalStatPoints } from '../systems/stats';
import { readAudioSettings } from '../systems/audio';
import { expToNextLevel } from '../systems/exp';
import { clampVitals, createInitialPlayerState, fullHeal, type PlayerState } from './playerState';
import { defaultSettings, type GameSettings } from './settings';

/** v2: preferências (`settings`, volume/mudo). v3: Selos por grau, encaixes e bestiário. */
export const SAVE_VERSION = 3;

export interface SaveLocation {
  mapId: string;
  spawnId: string;
}

/** Parte do PlayerState que vai para o disco (tempos de jogo não entram: recomeçam no load). */
export interface SavedPlayer {
  classId: string;
  level: number;
  exp: number;
  stats: BaseStats;
  hp: number;
  sp: number;
  inventory: (InventorySlot | null)[];
  equipment: Partial<Record<EquipSlot, string>>;
  sealFragments: Record<string, number>;
  /** Selos soltos por grau [I, II, III] (v3; na v2 era só a contagem de Selos completos). */
  seals: Record<string, SealCounts>;
  /** Selos encaixados por slot de equipamento (v3). */
  equipmentSeals: Partial<Record<EquipSlot, (SealRef | null)[]>>;
  /** Bestiário por monsterId (v3). */
  bestiary: Record<string, BestiaryEntry>;
  currency: number;
  hotbar: (HotbarEntry | null)[];
  /** `until` em ms de relógio real (Date.now), então a Fadiga continua valendo entre sessões. */
  fatigue: { until: number } | null;
  autoPickup: boolean;
  downed: boolean;
}

export interface SaveData {
  version: number;
  savedAt: number;
  player: SavedPlayer;
  /** Mapa e ponto de chegada em que o jogador estava. */
  location: SaveLocation;
  lastSafePoint: SaveLocation;
  /** Preferências do jogador (desde a v2). */
  settings: GameSettings;
}

/** mapId → ids dos pontos de chegada válidos. */
export type KnownMaps = Readonly<Record<string, readonly string[]>>;

/** Converte um save da versão `v` para a `v + 1`. */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Migrações por versão de origem. Ao subir SAVE_VERSION, registre aqui a conversão da versão anterior. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // v1 → v2: preferências com os valores padrão.
  1: (d) => ({ ...d, version: 2, settings: defaultSettings() }),
  // v2 → v3: Selos viram grau I, sem encaixes; bestiário deduzido do progresso de Selos.
  2: (d) => ({ ...d, version: 3, player: migratePlayerV2(d.player) }),
};

/**
 * v2 guardava `seals` como contagem de Selos completos. Viram Selos de grau I e o bestiário é deduzido:
 * todo monstro com fragmentos ou Selos foi visto, com abates = fragmentos totais / fragmentos por abate
 * (mínimo garantido; os abates reais podem ter sido mais).
 */
function migratePlayerV2(player: unknown): unknown {
  if (!isRecord(player)) return player;
  const oldSeals = isRecord(player.seals) ? player.seals : {};
  const fragments = isRecord(player.sealFragments) ? player.sealFragments : {};
  const seals: Record<string, unknown> = {};
  for (const [id, count] of Object.entries(oldSeals)) seals[id] = typeof count === 'number' ? [count, 0, 0] : count;

  const bestiary: Record<string, BestiaryEntry> = {};
  for (const monster of MONSTERS) {
    const done = typeof oldSeals[monster.sealId] === 'number' ? (oldSeals[monster.sealId] as number) : 0;
    const partial = typeof fragments[monster.sealId] === 'number' ? (fragments[monster.sealId] as number) : 0;
    if (done <= 0 && partial <= 0) continue;
    const required = hasSeal(monster.sealId) ? getSeal(monster.sealId).fragmentsRequired : 100;
    const kills = monster.fragmentsPerKill > 0 ? Math.floor((done * required + partial) / monster.fragmentsPerKill) : 0;
    bestiary[monster.id] = { kills: Math.max(0, kills), sealObtained: done > 0 };
  }
  return { ...player, seals, equipmentSeals: {}, bestiary };
}

export interface LoadedGame {
  state: PlayerState;
  location: SaveLocation;
  lastSafePoint: SaveLocation;
  settings: GameSettings;
  savedAt: number;
  /** Correções feitas ao carregar (para avisar o jogador/console). */
  warnings: string[];
}

/**
 * `newerVersion`: o save é de uma versão do jogo mais nova que esta. Não é corrompido — quem chama não deve
 * sobrescrevê-lo (o autosave fica suspenso).
 */
export type LoadResult = { ok: true; game: LoadedGame } | { ok: false; reason: string; newerVersion?: number };

export interface ParseOptions {
  knownMaps: KnownMaps;
  /** Para onde ir se o mapa salvo não existir mais. */
  fallback: SaveLocation;
  migrations?: Readonly<Record<number, Migration>>;
}

// ---------- Salvar ----------

export function createSave(
  state: PlayerState,
  location: SaveLocation,
  lastSafePoint: SaveLocation,
  now: number,
  settings: GameSettings = defaultSettings(),
): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: now,
    player: {
      classId: state.classId,
      level: state.level,
      exp: state.exp,
      stats: { ...state.stats },
      hp: state.hp,
      sp: state.sp,
      inventory: state.inventory.slots.map((s) => (s ? { itemId: s.itemId, quantity: s.quantity } : null)),
      equipment: { ...state.equipment },
      sealFragments: { ...state.sealFragments },
      seals: Object.fromEntries(Object.entries(state.seals).map(([id, c]) => [id, [...c] as SealCounts])),
      equipmentSeals: Object.fromEntries(
        Object.entries(state.equipmentSeals).map(([slot, list]) => [slot, (list ?? []).map((r) => (r ? { ...r } : null))]),
      ),
      bestiary: Object.fromEntries(Object.entries(state.bestiary).map(([id, e]) => [id, { ...e }])),
      currency: state.currency,
      hotbar: state.hotbar.map((e) => (e ? { ...e } : null)),
      fatigue: state.fatigue ? { until: state.fatigue.until } : null,
      autoPickup: state.autoPickup,
      downed: state.downed,
    },
    location: { ...location },
    lastSafePoint: { ...lastSafePoint },
    settings: { audio: { ...settings.audio } },
  };
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}

// ---------- Carregar ----------

class SaveError extends Error {}

/** Save de versão mais nova que o jogo: não é lido, mas também não pode ser apagado. */
class NewerSaveError extends SaveError {
  constructor(readonly version: number) {
    super(`save da versão ${version}, mais nova que o jogo (${SAVE_VERSION})`);
  }
}

function fail(reason: string): never {
  throw new SaveError(reason);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function int(v: unknown, what: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) fail(`${what} inválido`);
  return v;
}

function num(v: unknown, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${what} inválido`);
  return v;
}

function bool(v: unknown, what: string): boolean {
  if (typeof v !== 'boolean') fail(`${what} inválido`);
  return v;
}

function intRecord(v: unknown, what: string): Record<string, number> {
  if (!isRecord(v)) fail(`${what} inválido`);
  const out: Record<string, number> = {};
  for (const [k, value] of Object.entries(v)) out[k] = int(value, `${what}.${k}`);
  return out;
}

const itemIds = new Set(ITEMS.map((i) => i.id));
/** Skills conhecidas: as listadas nas classes (nenhuma ainda no Marco 2). */
const skillIds = new Set(CLASSES.flatMap((c) => c.skills));

/** Roda as migrações até a versão atual. */
export function migrateSave(data: Record<string, unknown>, migrations: Readonly<Record<number, Migration>> = MIGRATIONS): Record<string, unknown> {
  let current = data;
  const start = current.version;
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 0) fail('save sem versão');
  if (start > SAVE_VERSION) throw new NewerSaveError(start);
  for (let version = start; version < SAVE_VERSION; version++) {
    const migrate = migrations[version];
    if (!migrate) fail(`save da versão ${version} não tem migração`);
    current = migrate(current);
    if (current.version !== version + 1) fail(`migração da versão ${version} não subiu a versão`);
  }
  return current;
}

function readLocation(v: unknown, known: KnownMaps): SaveLocation | null {
  if (!isRecord(v) || typeof v.mapId !== 'string' || typeof v.spawnId !== 'string') return null;
  const spawns = known[v.mapId];
  if (!spawns || !spawns.includes(v.spawnId)) return null;
  return { mapId: v.mapId, spawnId: v.spawnId };
}

function readPlayer(p: unknown, warnings: string[]): PlayerState {
  if (!isRecord(p)) fail('jogador ausente');
  const state = createInitialPlayerState();

  if (typeof p.classId !== 'string' || !CLASSES.some((c) => c.id === p.classId)) fail('classe inválida');
  state.classId = p.classId;
  state.level = int(p.level, 'nível', 1, EXP_TABLE.maxLevel);
  state.exp = int(p.exp, 'EXP');
  // EXP é por nível: nunca chega ao necessário para subir (e fica em 0 no nível máximo).
  const need = expToNextLevel(state.level, EXP_TABLE);
  const maxExp = need === null ? 0 : need - 1;
  if (state.exp > maxExp) {
    warnings.push(`EXP acima do máximo do nível ${state.level}: limitada a ${maxExp}.`);
    state.exp = maxExp;
  }

  if (!isRecord(p.stats)) fail('stats ausentes');
  const stats = defaultBaseStats();
  for (const key of STAT_KEYS) stats[key] = int(p.stats[key], `stat ${key}`, MIN_STAT, MAX_STAT);
  if (spentStatPoints(stats) > totalStatPoints(state.level)) {
    warnings.push('Stats acima dos pontos do nível: pontos devolvidos.');
    state.stats = defaultBaseStats();
  } else {
    state.stats = stats;
  }

  if (!Array.isArray(p.inventory)) fail('inventário inválido');
  const slots: (InventorySlot | null)[] = Array.from({ length: DEFAULT_INVENTORY_SLOTS }, () => null);
  p.inventory.forEach((raw, i) => {
    if (raw === null) return;
    if (!isRecord(raw) || typeof raw.itemId !== 'string') fail('slot do inventário inválido');
    const quantity = int(raw.quantity, 'quantidade', 1);
    if (!itemIds.has(raw.itemId)) {
      warnings.push(`Item removido do jogo descartado: ${raw.itemId}.`);
      return;
    }
    if (i >= DEFAULT_INVENTORY_SLOTS) {
      warnings.push(`Inventário maior que ${DEFAULT_INVENTORY_SLOTS} slots: excedente descartado.`);
      return;
    }
    const { maxStack, name } = getItem(raw.itemId);
    if (quantity > maxStack) warnings.push(`${name}: ${quantity} numa pilha (máximo ${maxStack}); excedente descartado.`);
    slots[i] = { itemId: raw.itemId, quantity: Math.min(quantity, maxStack) };
  });
  state.inventory = { slots };

  if (!isRecord(p.equipment)) fail('equipamento inválido');
  state.equipment = {};
  for (const [slot, itemId] of Object.entries(p.equipment)) {
    if (typeof itemId !== 'string') fail('equipamento inválido');
    const item = itemIds.has(itemId) ? getItem(itemId) : null;
    if (!item?.equip || item.equip.slot !== slot) {
      warnings.push(`Equipamento inválido descartado: ${itemId}.`);
      continue;
    }
    state.equipment[slot as EquipSlot] = itemId;
  }

  state.sealFragments = intRecord(p.sealFragments, 'fragmentos');
  state.seals = readSealStock(p.seals, warnings);
  readEquipmentSeals(p.equipmentSeals, state, warnings);
  state.bestiary = readBestiary(p.bestiary, warnings);
  state.currency = Math.min(int(p.currency, 'moeda'), CURRENCY.max);

  if (!Array.isArray(p.hotbar)) fail('barra de atalhos inválida');
  const hotbar = [...createHotbar()];
  // Cada item/skill aparece uma vez só na barra; o primeiro atalho fica.
  const used = new Set<string>();
  p.hotbar.slice(0, HOTBAR_SIZE).forEach((raw, i) => {
    if (raw === null) return;
    let entry: HotbarEntry;
    if (isRecord(raw) && raw.kind === 'item' && typeof raw.itemId === 'string') {
      if (!itemIds.has(raw.itemId)) {
        warnings.push(`Atalho de item removido: ${raw.itemId}.`);
        return;
      }
      entry = { kind: 'item', itemId: raw.itemId };
    } else if (isRecord(raw) && raw.kind === 'skill' && typeof raw.skillId === 'string') {
      if (!skillIds.has(raw.skillId)) {
        warnings.push(`Atalho de skill desconhecida removido: ${raw.skillId}.`);
        return;
      }
      entry = { kind: 'skill', skillId: raw.skillId };
    } else {
      fail('atalho inválido');
    }
    const key = entry.kind === 'item' ? `i:${entry.itemId}` : `s:${entry.skillId}`;
    if (used.has(key)) {
      warnings.push(`Atalho repetido removido (tecla ${i + 1}).`);
      return;
    }
    used.add(key);
    hotbar[i] = entry;
  });
  state.hotbar = hotbar;

  if (p.fatigue === null) state.fatigue = null;
  else if (isRecord(p.fatigue)) state.fatigue = { until: num(p.fatigue.until, 'Fadiga') };
  else fail('Fadiga inválida');

  state.autoPickup = bool(p.autoPickup, 'auto-pegar');
  state.downed = bool(p.downed, 'caído');
  state.hp = num(p.hp, 'HP');
  state.sp = num(p.sp, 'SP');
  state.lastCombatAt = null;
  state.lastRegenAt = 0;
  clampVitals(state);
  return state;
}

function readSealStock(v: unknown, warnings: string[]): SealStock {
  if (!isRecord(v)) fail('Selos inválidos');
  let stock: SealStock = {};
  for (const [id, raw] of Object.entries(v)) {
    if (!Array.isArray(raw) || raw.length !== 3) fail(`Selos ${id} inválidos`);
    const counts = raw.map((n, i) => int(n, `Selos ${id} grau ${i + 1}`)) as SealCounts;
    if (!hasSeal(id)) {
      warnings.push(`Selo removido do jogo descartado: ${id}.`);
      continue;
    }
    stock = { ...stock, [id]: counts };
  }
  return stock;
}

/**
 * Encaixes precisam de equipamento vestido com encaixe livre e de Selo que aceite o slot.
 * Selo que não cabe mais volta ao estojo (com aviso); Selo inexistente é descartado.
 */
function readEquipmentSeals(v: unknown, state: PlayerState, warnings: string[]): void {
  if (!isRecord(v)) fail('encaixes de Selo inválidos');
  let stock = state.seals;
  const sockets: Partial<Record<EquipSlot, (SealRef | null)[]>> = {};
  for (const [slot, list] of Object.entries(v)) {
    if (!Array.isArray(list)) fail('encaixes de Selo inválidos');
    const itemId = state.equipment[slot as EquipSlot];
    const capacity = itemId ? (getItem(itemId).equip?.sealSlots ?? 0) : 0;
    const kept: (SealRef | null)[] = Array.from({ length: capacity }, () => null);
    list.forEach((raw, i) => {
      if (raw === null) return;
      if (!isRecord(raw) || typeof raw.sealId !== 'string' || !isSealGrade(raw.grade)) fail('Selo encaixado inválido');
      const ref: SealRef = { sealId: raw.sealId, grade: raw.grade };
      if (!hasSeal(ref.sealId)) {
        warnings.push(`Selo removido do jogo descartado: ${ref.sealId}.`);
        return;
      }
      if (i < capacity && canSealGoInSlot(getSeal(ref.sealId), slot as EquipSlot)) {
        kept[i] = ref;
      } else {
        warnings.push(`Selo sem encaixe válido voltou ao estojo: ${ref.sealId}.`);
        stock = addToStock(stock, ref, 1);
      }
    });
    if (capacity > 0) sockets[slot as EquipSlot] = kept;
  }
  state.seals = stock;
  state.equipmentSeals = sockets;
}

function readBestiary(v: unknown, warnings: string[]): Record<string, BestiaryEntry> {
  if (!isRecord(v)) fail('bestiário inválido');
  const known = new Set(MONSTERS.map((m) => m.id));
  const out: Record<string, BestiaryEntry> = {};
  for (const [id, raw] of Object.entries(v)) {
    if (!isRecord(raw)) fail(`bestiário ${id} inválido`);
    const entry = { kills: int(raw.kills, `abates de ${id}`), sealObtained: bool(raw.sealObtained, `Selo de ${id}`) };
    if (!known.has(id)) {
      warnings.push(`Monstro removido do jogo saiu do bestiário: ${id}.`);
      continue;
    }
    out[id] = entry;
  }
  return out;
}

/** Preferências inválidas não invalidam o save: voltam ao padrão com aviso. */
function readSettings(v: unknown, warnings: string[]): GameSettings {
  const fallback = defaultSettings();
  const audio = readAudioSettings(isRecord(v) ? v.audio : undefined, fallback.audio);
  if (!audio.valid) warnings.push('Preferências de som inválidas: usando o padrão.');
  return { audio: audio.settings };
}

/** Lê o texto do localStorage. Nunca lança. */
export function parseSave(raw: string, options: ParseOptions): LoadResult {
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      fail('JSON corrompido');
    }
    if (!isRecord(parsed)) fail('formato inválido');
    const data = migrateSave(parsed, options.migrations ?? MIGRATIONS);
    const warnings: string[] = [];
    const state = readPlayer(data.player, warnings);

    let lastSafePoint = readLocation(data.lastSafePoint, options.knownMaps);
    if (!lastSafePoint) {
      warnings.push('Ponto seguro salvo não existe mais.');
      lastSafePoint = { ...options.fallback };
    }
    let location = readLocation(data.location, options.knownMaps);
    if (!location) {
      warnings.push('Mapa salvo não existe mais: voltando ao ponto seguro.');
      location = { ...lastSafePoint };
    }
    // Salvou caído: acorda no ponto seguro (a Fadiga já foi aplicada ao cair).
    if (state.downed) {
      state.downed = false;
      fullHeal(state);
      location = { ...lastSafePoint };
    }
    const settings = readSettings(data.settings, warnings);
    const savedAt = typeof data.savedAt === 'number' ? data.savedAt : 0;
    return { ok: true, game: { state, location, lastSafePoint, settings, savedAt, warnings } };
  } catch (e) {
    if (e instanceof NewerSaveError) return { ok: false, reason: e.message, newerVersion: e.version };
    if (e instanceof SaveError) return { ok: false, reason: e.message };
    return { ok: false, reason: `erro inesperado: ${String(e)}` };
  }
}
