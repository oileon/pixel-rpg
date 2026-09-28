import { describe, expect, it } from 'vitest';
import { CLASSES, getSeal, ITEMS, MONSTERS, SEALS, SEALS_DATA } from './index';

describe('classes.json', () => {
  const itemIds = new Set(ITEMS.map((item) => item.id));

  it('todo item do startingKit existe em items.json', () => {
    for (const cls of CLASSES) {
      const kit = cls.startingKit;
      if (!kit) continue;
      for (const itemId of Object.values(kit.equipment)) expect(itemIds, `${cls.id}: ${itemId}`).toContain(itemId);
      for (const { itemId } of kit.items) expect(itemIds, `${cls.id}: ${itemId}`).toContain(itemId);
    }
  });

  it('equipamento inicial vai no slot certo', () => {
    for (const cls of CLASSES) {
      for (const [slot, itemId] of Object.entries(cls.startingKit?.equipment ?? {})) {
        const item = ITEMS.find((i) => i.id === itemId);
        expect(item?.equip?.slot, `${cls.id}: ${itemId}`).toBe(slot);
      }
    }
  });
});

describe('seals.json', () => {
  const sealIds = new Set(SEALS.map((s) => s.id));

  it('todo monstro aponta para um Selo dele', () => {
    for (const monster of MONSTERS) {
      expect(sealIds, monster.id).toContain(monster.sealId);
      expect(getSeal(monster.sealId).monsterId, monster.id).toBe(monster.id);
    }
  });

  it('Selos têm 3 graus, slots, fragmentos, lore e ids únicos', () => {
    expect(sealIds.size).toBe(SEALS.length);
    for (const seal of SEALS) {
      expect(seal.grades.length, seal.id).toBe(3);
      expect(seal.slots.length, seal.id).toBeGreaterThan(0);
      for (const slot of seal.slots) expect(['weapon', 'armor', 'head', 'accessory'], seal.id).toContain(slot);
      expect(seal.fragmentsRequired, seal.id).toBeGreaterThan(0);
      expect(seal.lore.length, seal.id).toBeGreaterThan(0);
      expect(Object.keys(SEALS_DATA.familyNames), seal.id).toContain(seal.family);
    }
  });

  it('Ressonâncias usam grupos que existem', () => {
    const elements = ['fire', 'water', 'earth', 'wind'];
    for (const rule of SEALS_DATA.resonances) {
      const groups = rule.kind === 'element' ? elements : Object.keys(SEALS_DATA.familyNames);
      for (const key of Object.keys(rule.bonuses)) expect(groups, rule.id).toContain(key);
      expect(rule.minCount, rule.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('encaixes de equipamento entre 0 e 3', () => {
    for (const item of ITEMS) {
      const slots = item.equip?.sealSlots ?? 0;
      expect(slots >= 0 && slots <= 3, item.id).toBe(true);
    }
  });
});
