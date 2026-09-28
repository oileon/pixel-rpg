import { describe, expect, it } from 'vitest';
import { SEALS_DATA } from '../data';
import {
  activeResonances,
  addToStock,
  clearSockets,
  fuseSeals,
  sealBonuses,
  sealCount,
  socketSeal,
  stockTotal,
  sumBonuses,
  unsocketSeal,
  type SealLoadout,
  type SealRef,
} from './seals';

const pomi1: SealRef = { sealId: 'seal_pomi', grade: 1 };
const empty: SealLoadout = { stock: {}, sockets: {} };

function withStock(...refs: SealRef[]): SealLoadout {
  return { stock: refs.reduce((s, r) => addToStock(s, r, 1), {}), sockets: {} };
}

describe('estoque', () => {
  it('soma e tira por grau sem ficar negativo', () => {
    let stock = addToStock({}, pomi1, 2);
    stock = addToStock(stock, { sealId: 'seal_pomi', grade: 3 }, 1);
    expect(stock.seal_pomi).toEqual([2, 0, 1]);
    expect(stockTotal(stock)).toBe(3);
    expect(sealCount(addToStock(stock, pomi1, -5), pomi1)).toBe(0);
  });
});

describe('fusão', () => {
  it(`${SEALS_DATA.fusionCost} Selos I viram 1 Selo II`, () => {
    const r = fuseSeals(withStock(pomi1, pomi1, pomi1, pomi1), pomi1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.loadout.stock.seal_pomi).toEqual([1, 1, 0]);
  });

  it('recusa sem Selos suficientes ou no grau máximo', () => {
    expect(fuseSeals(withStock(pomi1, pomi1), pomi1).ok).toBe(false);
    const three: SealRef = { sealId: 'seal_pomi', grade: 3 };
    expect(fuseSeals({ stock: addToStock({}, three, 5), sockets: {} }, three).ok).toBe(false);
  });
});

describe('encaixe', () => {
  it('encaixa no primeiro vazio e tira do estoque', () => {
    const r = socketSeal(withStock(pomi1), pomi1, 'armor', 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.loadout.sockets.armor).toEqual([pomi1, null]);
    expect(sealCount(r.loadout.stock, pomi1)).toBe(0);
  });

  it('encaixe ocupado troca: o anterior volta ao estoque', () => {
    const two: SealRef = { sealId: 'seal_pomi', grade: 2 };
    const first = socketSeal(withStock(pomi1, two), pomi1, 'armor', 1);
    if (!first.ok) throw new Error(first.message);
    const r = socketSeal(first.loadout, two, 'armor', 1, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.loadout.sockets.armor).toEqual([two]);
    expect(r.loadout.stock.seal_pomi).toEqual([1, 0, 0]);
  });

  it('recusa slot não permitido, sem encaixes, cheio ou sem o Selo', () => {
    const cascudo: SealRef = { sealId: 'seal_cascudo', grade: 1 };
    expect(socketSeal(withStock(cascudo), cascudo, 'weapon', 1).ok).toBe(false);
    expect(socketSeal(withStock(pomi1), pomi1, 'armor', 0).ok).toBe(false);
    expect(socketSeal(empty, pomi1, 'armor', 1).ok).toBe(false);
    const full = { stock: addToStock({}, pomi1, 1), sockets: { armor: [pomi1] } };
    expect(socketSeal(full, pomi1, 'armor', 1).ok).toBe(false);
    expect(socketSeal(withStock(pomi1), pomi1, 'armor', 1, 3).ok).toBe(false);
  });

  it('remover devolve ao estoque; limpar o slot devolve todos', () => {
    const loadout: SealLoadout = { stock: {}, sockets: { armor: [pomi1, pomi1] } };
    const r = unsocketSeal(loadout, 'armor', 1);
    expect(r.ok && r.loadout.sockets.armor).toEqual([pomi1, null]);
    expect(r.ok && sealCount(r.loadout.stock, pomi1)).toBe(1);
    expect(unsocketSeal(empty, 'armor', 0).ok).toBe(false);
    const cleared = clearSockets(loadout, 'armor');
    expect(cleared.returned).toBe(2);
    expect(cleared.loadout.sockets.armor).toBeUndefined();
    expect(sealCount(cleared.loadout.stock, pomi1)).toBe(2);
  });
});

describe('Ressonância', () => {
  const ids = (refs: SealRef[]) => activeResonances(refs).map((r) => `${r.rule.id}:${r.group}`);

  it('Eco Elemental com 2 Selos do mesmo elemento (mesmo repetidos)', () => {
    expect(ids([pomi1])).toEqual([]);
    expect(ids([pomi1, pomi1])).toEqual(['eco_elemental:water']);
    expect(ids([pomi1, { sealId: 'seal_musgolento', grade: 1 }])).toEqual(['eco_elemental:water']);
  });

  it('Coro Elemental com 3 do mesmo elemento soma com o Eco', () => {
    const earth: SealRef[] = [
      { sealId: 'seal_cascudo', grade: 1 },
      { sealId: 'seal_cogumelim', grade: 1 },
      { sealId: 'seal_tronco_rei', grade: 1 },
    ];
    expect(ids(earth)).toEqual(['eco_elemental:earth', 'coro_elemental:earth', 'laco_familia:flora']);
  });

  it('Laço de Família só conta espécies diferentes', () => {
    const plumito: SealRef = { sealId: 'seal_plumito', grade: 1 };
    const zunzum: SealRef = { sealId: 'seal_zunzum', grade: 1 };
    expect(ids([plumito, plumito])).toEqual(['eco_elemental:wind']);
    expect(ids([plumito, zunzum])).toEqual(['eco_elemental:wind', 'laco_familia:alada']);
  });

  it('bônus totais = Selos encaixados + Ressonâncias', () => {
    const total = sumBonuses(sealBonuses({ weapon: [pomi1], armor: [{ sealId: 'seal_pomi', grade: 3 }] }));
    // Pomi I (HP +15) + Pomi III (HP +60, VIT +2) + Eco água (SP +10, MDEF +3).
    expect(total).toEqual({ maxHp: 75, maxSp: 10, mdef: 3, stats: { vit: 2 } });
  });
});
