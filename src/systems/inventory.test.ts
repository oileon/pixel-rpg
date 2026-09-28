import { describe, expect, it } from 'vitest';
import { getItem } from '../data';
import {
  addItem,
  countItem,
  createInventory,
  freeSlotCount,
  removeFromSlot,
  removeItem,
  spaceFor,
  swapSlots,
} from './inventory';

const jelly = getItem('geleia_pessego'); // maxStack 99
const dagger = getItem('adaga_treino'); // maxStack 1

describe('addItem', () => {
  it('empilha até maxStack e usa novos slots', () => {
    const { inventory, added, overflow } = addItem(createInventory(5), jelly, 150);
    expect(added).toBe(150);
    expect(overflow).toBe(0);
    expect(inventory.slots[0]).toEqual({ itemId: 'geleia_pessego', quantity: 99 });
    expect(inventory.slots[1]).toEqual({ itemId: 'geleia_pessego', quantity: 51 });
    expect(freeSlotCount(inventory)).toBe(3);
  });

  it('completa pilhas existentes antes de ocupar slot vazio', () => {
    let inv = addItem(createInventory(5), jelly, 98).inventory;
    inv = addItem(inv, dagger).inventory;
    inv = addItem(inv, jelly, 3).inventory;
    expect(inv.slots[0]?.quantity).toBe(99);
    expect(inv.slots[2]).toEqual({ itemId: 'geleia_pessego', quantity: 2 });
  });

  it('devolve o que não coube e não altera o original', () => {
    const original = createInventory(2);
    const { inventory, added, overflow } = addItem(original, dagger, 3);
    expect(added).toBe(2);
    expect(overflow).toBe(1);
    expect(spaceFor(inventory, dagger)).toBe(0);
    expect(freeSlotCount(original)).toBe(2);
  });
});

describe('removeItem', () => {
  it('remove entre pilhas e libera slots vazios', () => {
    const inv = addItem(createInventory(5), jelly, 150).inventory;
    const r = removeItem(inv, 'geleia_pessego', 60);
    expect(r.ok).toBe(true);
    expect(countItem(r.inventory, 'geleia_pessego')).toBe(90);
    expect(r.inventory.slots[1]).toBeNull();
  });

  it('é tudo ou nada', () => {
    const inv = addItem(createInventory(5), jelly, 10).inventory;
    const r = removeItem(inv, 'geleia_pessego', 11);
    expect(r.ok).toBe(false);
    expect(r.inventory).toBe(inv);
  });

  it('removeFromSlot e swapSlots', () => {
    let inv = addItem(createInventory(3), jelly, 2).inventory;
    inv = removeFromSlot(inv, 0, 1).inventory;
    expect(inv.slots[0]?.quantity).toBe(1);
    expect(removeFromSlot(inv, 0, 2).ok).toBe(false);
    inv = swapSlots(inv, 0, 2);
    expect(inv.slots[0]).toBeNull();
    expect(inv.slots[2]).toEqual({ itemId: 'geleia_pessego', quantity: 1 });
    expect(removeFromSlot(inv, 2, 1).inventory.slots[2]).toBeNull();
  });
});
