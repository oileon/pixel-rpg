import { describe, expect, it } from 'vitest';
import { assignToFreeSlot, createHotbar, HOTBAR_SIZE, setSlot, swapSlots, type HotbarEntry } from './hotbar';

const apple: HotbarEntry = { kind: 'item', itemId: 'maca_do_ceu' };
const tonic: HotbarEntry = { kind: 'item', itemId: 'tonico_frutas' };
const skill: HotbarEntry = { kind: 'skill', skillId: 'golpe_forte' };

describe('hotbar', () => {
  it('começa com 8 slots vazios', () => {
    expect(createHotbar()).toEqual(Array(HOTBAR_SIZE).fill(null));
  });

  it('atribui ao primeiro livre e não duplica', () => {
    let r = assignToFreeSlot(createHotbar(), apple);
    expect(r.index).toBe(0);
    r = assignToFreeSlot(r.hotbar, tonic);
    expect(r.index).toBe(1);
    const again = assignToFreeSlot(r.hotbar, apple);
    expect(again).toMatchObject({ index: 0, already: true });
    expect(again.hotbar).toBe(r.hotbar);
  });

  it('barra cheia devolve -1', () => {
    let bar = createHotbar();
    for (let i = 0; i < HOTBAR_SIZE; i++) bar = setSlot(bar, i, { kind: 'item', itemId: `x${i}` });
    expect(assignToFreeSlot(bar, apple).index).toBe(-1);
  });

  it('setSlot move a entrada em vez de duplicar; aceita skills', () => {
    let bar = setSlot(createHotbar(), 0, apple);
    bar = setSlot(bar, 5, apple);
    expect(bar[0]).toBeNull();
    expect(bar[5]).toEqual(apple);
    bar = setSlot(bar, 2, skill);
    expect(bar[2]).toEqual(skill);
    expect(setSlot(bar, 99, tonic)).toBe(bar);
  });

  it('troca slots', () => {
    const bar = swapSlots(setSlot(createHotbar(), 0, apple), 0, 3);
    expect(bar[0]).toBeNull();
    expect(bar[3]).toEqual(apple);
  });
});
