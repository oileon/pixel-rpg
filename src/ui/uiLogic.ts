// Lógica pura da UI (sem Phaser): textos de tooltip, posicionamento e assinaturas de estado
// usadas para só reconstruir as janelas quando algo relevante mudou.

import type { BaseStats, EquipBonus, EquipSlot, ItemDef, Rarity } from '../data/types';
import { Tile } from '../maps/types';
import type { Hotbar } from '../systems/hotbar';
import { FREE_RESPEC_MAX_LEVEL, STAT_KEYS, canRespecFree, type DerivedStats } from '../systems/stats';

/** Ordem de exibição dos slots de equipamento. */
export const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'armor', 'head', 'accessory'];

export const EQUIP_SLOT_NAMES: Record<EquipSlot, string> = {
  weapon: 'Arma',
  armor: 'Armadura',
  head: 'Cabeça',
  accessory: 'Acessório',
};

export const RARITY_NAMES: Record<Rarity, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
};

/** Texto do tooltip de um item (nome, quantidade, raridade se não for comum, descrição e bônus). */
export function itemTooltipText(item: ItemDef, quantity = 1): string {
  let text = item.name;
  if (quantity > 1) text += ` (${quantity})`;
  if (item.rarity !== 'common') text += ` [${RARITY_NAMES[item.rarity]}]`;
  text += `\n${item.description}`;

  const parts: string[] = [];
  if (item.type === 'equipment' && item.equip) {
    const eq = item.equip;
    if (eq.requiredLevel) parts.push(`Nível ${eq.requiredLevel}`);
    parts.push(...bonusParts(eq));
    if (eq.sealSlots) parts.push(`Encaixes de Selo: ${eq.sealSlots}`);
  } else if (item.type === 'consumable' && item.effect) {
    if (item.effect.hp) parts.push(`HP +${item.effect.hp}`);
    if (item.effect.sp) parts.push(`SP +${item.effect.sp}`);
  }
  if (parts.length > 0) text += `\n${parts.join(', ')}`;
  return text;
}

const BONUS_LABELS: ReadonlyArray<{ key: Exclude<keyof EquipBonus, 'stats'>; label: string }> = [
  { key: 'atk', label: 'ATK' },
  { key: 'matk', label: 'MATK' },
  { key: 'def', label: 'DEF' },
  { key: 'mdef', label: 'MDEF' },
  { key: 'maxHp', label: 'HP' },
  { key: 'maxSp', label: 'SP' },
  { key: 'hit', label: 'HIT' },
  { key: 'flee', label: 'FLEE' },
  { key: 'crit', label: 'CRIT' },
];

/** "ATK +12", "VIT +1"... de um bônus de equipamento ou Selo. */
export function bonusParts(bonus: EquipBonus): string[] {
  const parts: string[] = [];
  for (const { key, label } of BONUS_LABELS) {
    const v = bonus[key];
    if (v) parts.push(`${label} ${v > 0 ? '+' : '−'}${Math.abs(v)}`);
  }
  for (const [k, v] of Object.entries(bonus.stats ?? {})) if (v) parts.push(`${k.toUpperCase()} +${v}`);
  return parts;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Posição (canto superior esquerdo) de um tooltip de `width`×`height` ao lado de `anchor`:
 * à direita se couber, senão à esquerda; sempre dentro da tela com `margin` de folga.
 */
export function placeTooltip(
  anchor: Rect,
  width: number,
  height: number,
  screenW: number,
  screenH: number,
  gap = 8,
  margin = 4,
): { x: number; y: number } {
  let x = anchor.x + anchor.width + gap;
  if (x + width > screenW - margin) x = anchor.x - gap - width;
  x = Math.max(margin, Math.min(x, screenW - margin - width));
  const y = Math.max(margin, Math.min(anchor.y, screenH - margin - height));
  return { x, y };
}

/** Rótulo do botão de reset: pede confirmação no segundo estágio e cita o nível limite. */
export function respecButtonLabel(level: number, confirming: boolean): string {
  if (!canRespecFree(level)) return `Resetar (só até nv ${FREE_RESPEC_MAX_LEVEL})`;
  return confirming ? 'Confirmar reset?' : `Resetar (grátis até nv ${FREE_RESPEC_MAX_LEVEL})`;
}

export interface StatsWindowView {
  classId: string;
  level: number;
  stats: BaseStats;
  equipment: Partial<Record<EquipSlot, string>>;
  allocation: Partial<BaseStats>;
  confirmingRespec: boolean;
  /** Selos encaixados (mudam os atributos); ver `sealsSignature`. */
  seals?: string;
}

/** Muda sempre que algo mostrado na janela de Status muda. */
export function statsWindowSignature(view: StatsWindowView): string {
  const stats = STAT_KEYS.map((k) => view.stats[k]).join(',');
  const alloc = STAT_KEYS.map((k) => view.allocation[k] ?? 0).join(',');
  const equip = EQUIP_SLOTS.map((s) => view.equipment[s] ?? '').join(',');
  return `${view.classId}|${view.level}|${stats}|${alloc}|${equip}|${view.confirmingRespec ? 1 : 0}|${view.seals ?? ''}`;
}

export interface InventoryView {
  inventory: { slots: ReadonlyArray<{ itemId: string; quantity: number } | null> };
  equipment: Partial<Record<EquipSlot, string>>;
  currency: number;
  /** Os tooltips de equipamento comparam com os atributos atuais, que dependem de nível e stats. */
  level: number;
  stats: BaseStats;
}

/** Muda sempre que algo mostrado no Inventário (slots, equipamento, moeda, comparação) muda. */
export function inventorySignature(view: InventoryView): string {
  const slots = view.inventory.slots.map((s) => (s ? `${s.itemId}:${s.quantity}` : '')).join(',');
  const equip = EQUIP_SLOTS.map((s) => view.equipment[s] ?? '').join(',');
  const stats = STAT_KEYS.map((k) => view.stats[k]).join(',');
  return `${slots}|${equip}|${view.currency}|${view.level}|${stats}`;
}

/** Muda quando um atalho ou a quantidade de um item da barra muda. */
export function hotbarSignature(hotbar: Hotbar, countOf: (itemId: string) => number): string {
  return hotbar
    .map((e) => (!e ? '' : e.kind === 'item' ? `i:${e.itemId}:${countOf(e.itemId)}` : `s:${e.skillId}`))
    .join(',');
}

const COMPARE_ROWS: ReadonlyArray<{ key: keyof DerivedStats; label: string }> = [
  { key: 'atk', label: 'ATK' },
  { key: 'matk', label: 'MATK' },
  { key: 'def', label: 'DEF' },
  { key: 'mdef', label: 'MDEF' },
  { key: 'maxHp', label: 'HP' },
  { key: 'maxSp', label: 'SP' },
  { key: 'hit', label: 'HIT' },
  { key: 'flee', label: 'FLEE' },
  { key: 'crit', label: 'CRIT' },
  { key: 'aspd', label: 'ASPD' },
];

/** "vs. equipado: ATK +4, DEF −6" (atributos finais do personagem trocando o item). */
export function equipComparisonText(
  current: DerivedStats,
  withItem: DerivedStats,
  hasEquipped: boolean,
  prefixOverride?: string,
): string {
  const parts: string[] = [];
  for (const { key, label } of COMPARE_ROWS) {
    const diff = withItem[key] - current[key];
    if (diff !== 0) parts.push(`${label} ${diff > 0 ? '+' : '−'}${Math.abs(diff)}`);
  }
  const prefix = prefixOverride ?? (hasEquipped ? 'vs. equipado' : 'Ao equipar');
  return parts.length > 0 ? `${prefix}: ${parts.join(', ')}` : `${prefix}: sem mudança`;
}

// ---------- Minimapa ----------

/** Cor de cada tile no minimapa; null = não desenha (nuvem/céu, fica o fundo do quadro). */
export const MINIMAP_TILE_COLORS: Record<Tile, number | null> = {
  [Tile.Cloud]: null,
  [Tile.Grass]: 0x6fb85a,
  [Tile.Path]: 0xd8b57a,
  [Tile.Water]: 0x4aa3df,
  [Tile.Tree]: 0x2f7a3a,
  [Tile.Wall]: 0xe9d7b5,
  [Tile.Rock]: 0x8c8c96,
  [Tile.Flowers]: 0x8ccf6a,
  [Tile.Bridge]: 0xb08a5a,
  [Tile.Roof]: 0xc0503a,
  [Tile.Plaza]: 0xc9c3b5,
  [Tile.Prop]: 0x8a6a4a,
  [Tile.Deck]: 0xb08a5a,
};

/** Escala (px de minimapa por tile) para caber em `boxW`×`boxH` mantendo a proporção. */
export function minimapScale(mapW: number, mapH: number, boxW: number, boxH: number): number {
  return Math.min(boxW / mapW, boxH / mapH);
}

/** Posição no minimapa de um ponto do mundo em px (`tileSize` px por tile). */
export function worldToMinimap(x: number, y: number, tileSize: number, scale: number): { x: number; y: number } {
  return { x: (x / tileSize) * scale, y: (y / tileSize) * scale };
}
