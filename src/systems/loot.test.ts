import { describe, expect, it } from 'vitest';
import { getItem, getMonster, ITEMS, MONSTERS } from '../data';
import type { Rng } from '../data/types';
import { addSealFragments, createSeededRng, rollCurrency, rollDrops, SEAL_FRAGMENTS_REQUIRED } from './loot';

function sequence(...values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length] as number;
}

const pomi = getMonster('pomi');

describe('createSeededRng', () => {
  it('é determinístico e fica em [0, 1)', () => {
    const a = createSeededRng(123);
    const b = createSeededRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(createSeededRng(1)()).not.toBe(createSeededRng(2)());
  });
});

describe('rollDrops', () => {
  it('rola cada entrada de forma independente', () => {
    // Pomi: geleia 0.7, maçã 0.15, tônico 0.05
    expect(rollDrops(pomi, sequence(0.5, 0.1, 0.9))).toEqual([
      { itemId: 'geleia_pessego', quantity: 1 },
      { itemId: 'maca_do_ceu', quantity: 1 },
    ]);
    expect(rollDrops(pomi, sequence(0.99))).toEqual([]);
  });

  it('multiplicador de drop é limitado a 100%', () => {
    expect(rollDrops(pomi, sequence(0.999), 100)).toHaveLength(pomi.drops.length);
  });

  it('taxa observada bate com a chance (RNG com seed)', () => {
    const rng = createSeededRng(7);
    const n = 10_000;
    let jelly = 0;
    for (let i = 0; i < n; i++) {
      if (rollDrops(pomi, rng).some((d) => d.itemId === 'geleia_pessego')) jelly++;
    }
    expect(jelly / n).toBeCloseTo(0.7, 1);
  });

  it('todos os drops dos monstros apontam para itens existentes', () => {
    const ids = new Set(ITEMS.map((i) => i.id));
    for (const m of MONSTERS) for (const d of m.drops) expect(ids.has(d.itemId)).toBe(true);
    expect(getItem('geleia_pessego').rarity).toBe('common');
  });
});

describe('fragmentos de Selo', () => {
  it('acumula por sealId', () => {
    const r = addSealFragments({}, pomi);
    expect(r).toEqual({ fragments: { seal_pomi: 2 }, sealsCompleted: 0, sealId: 'seal_pomi' });
  });

  it('garante o Selo ao completar e mantém o excedente', () => {
    const r = addSealFragments({ seal_pomi: SEAL_FRAGMENTS_REQUIRED - 1 }, pomi);
    expect(r.sealsCompleted).toBe(1);
    expect(r.fragments.seal_pomi).toBe(1);
  });
});

describe('rollCurrency', () => {
  const cascudo = getMonster('cascudo');

  it('fica entre min e max quando cai', () => {
    const drop = cascudo.currency!;
    expect(rollCurrency(cascudo, sequence(0, 0))).toBe(drop.min);
    expect(rollCurrency(cascudo, sequence(0, 0.999999))).toBe(drop.max);
  });

  it('não cai se a rolagem passar da chance', () => {
    expect(rollCurrency(cascudo, sequence(0.9999))).toBe(0);
  });

  it('todo monstro tem faixa de moeda válida', () => {
    for (const m of MONSTERS) {
      const c = m.currency;
      if (!c) continue;
      expect(Number.isInteger(c.min) && Number.isInteger(c.max) && c.min >= 0 && c.max >= c.min).toBe(true);
      expect(c.chance).toBeGreaterThan(0);
      expect(c.chance).toBeLessThanOrEqual(1);
    }
  });
});
