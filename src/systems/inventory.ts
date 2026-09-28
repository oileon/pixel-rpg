// Inventário por slots com empilhamento. Funções puras: sempre retornam um novo inventário.

import type { ItemDef } from '../data/types';

export const DEFAULT_INVENTORY_SLOTS = 40;

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

export interface Inventory {
  /** Tamanho fixo; null = slot vazio. A posição é preservada para a UI. */
  readonly slots: readonly (InventorySlot | null)[];
}

export interface AddItemResult {
  inventory: Inventory;
  added: number;
  /** Quantidade que não coube (fica no chão). */
  overflow: number;
}

export interface RemoveItemResult {
  inventory: Inventory;
  /** false se não havia quantidade suficiente (inventário inalterado). */
  ok: boolean;
}

export function createInventory(capacity = DEFAULT_INVENTORY_SLOTS): Inventory {
  return { slots: Array.from({ length: capacity }, () => null) };
}

export function countItem(inventory: Inventory, itemId: string): number {
  return inventory.slots.reduce((sum, slot) => sum + (slot?.itemId === itemId ? slot.quantity : 0), 0);
}

export function freeSlotCount(inventory: Inventory): number {
  return inventory.slots.filter((slot) => slot === null).length;
}

/** Quanto de `item` ainda cabe (espaço em pilhas existentes + slots vazios). */
export function spaceFor(inventory: Inventory, item: ItemDef): number {
  let space = 0;
  for (const slot of inventory.slots) {
    if (slot === null) space += item.maxStack;
    else if (slot.itemId === item.id) space += Math.max(0, item.maxStack - slot.quantity);
  }
  return space;
}

/** Adiciona completando pilhas existentes primeiro e depois ocupando slots vazios. Aceita parcial. */
export function addItem(inventory: Inventory, item: ItemDef, quantity = 1): AddItemResult {
  const slots = inventory.slots.map((slot) => (slot ? { ...slot } : null));
  let remaining = Math.max(0, Math.floor(quantity));

  for (const slot of slots) {
    if (remaining === 0) break;
    if (slot && slot.itemId === item.id && slot.quantity < item.maxStack) {
      const put = Math.min(remaining, item.maxStack - slot.quantity);
      slot.quantity += put;
      remaining -= put;
    }
  }
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    if (slots[i] === null) {
      const put = Math.min(remaining, item.maxStack);
      slots[i] = { itemId: item.id, quantity: put };
      remaining -= put;
    }
  }

  const requested = Math.max(0, Math.floor(quantity));
  return { inventory: { slots }, added: requested - remaining, overflow: remaining };
}

/** Remove `quantity` de um item, das últimas pilhas para as primeiras. Tudo ou nada. */
export function removeItem(inventory: Inventory, itemId: string, quantity = 1): RemoveItemResult {
  if (quantity <= 0 || countItem(inventory, itemId) < quantity) return { inventory, ok: false };
  const slots = inventory.slots.map((slot) => (slot ? { ...slot } : null));
  let remaining = quantity;
  for (let i = slots.length - 1; i >= 0 && remaining > 0; i--) {
    const slot = slots[i];
    if (slot?.itemId !== itemId) continue;
    const take = Math.min(remaining, slot.quantity);
    slot.quantity -= take;
    remaining -= take;
    if (slot.quantity === 0) slots[i] = null;
  }
  return { inventory: { slots }, ok: true };
}

/** Remove de um slot específico (ex.: clique no slot para usar/equipar). Tudo ou nada. */
export function removeFromSlot(inventory: Inventory, slotIndex: number, quantity = 1): RemoveItemResult {
  const slot = inventory.slots[slotIndex];
  if (!slot || quantity <= 0 || slot.quantity < quantity) return { inventory, ok: false };
  const slots = [...inventory.slots];
  slots[slotIndex] = slot.quantity === quantity ? null : { ...slot, quantity: slot.quantity - quantity };
  return { inventory: { slots }, ok: true };
}

/** Troca o conteúdo de dois slots (arrastar na UI). */
export function swapSlots(inventory: Inventory, from: number, to: number): Inventory {
  if (from === to || from < 0 || to < 0 || from >= inventory.slots.length || to >= inventory.slots.length) {
    return inventory;
  }
  const slots = [...inventory.slots];
  [slots[from], slots[to]] = [slots[to] ?? null, slots[from] ?? null];
  return { slots };
}
