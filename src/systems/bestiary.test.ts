import { describe, expect, it } from 'vitest';
import { bestiaryReveal, markSealObtained, markSeen, recordKill, seenCount, type Bestiary } from './bestiary';

const config = { statsKills: 1, dropsKills: 10 };

describe('bestiário', () => {
  it('ver cria a entrada uma vez só', () => {
    const b = markSeen({}, 'pomi');
    expect(b).toEqual({ pomi: { kills: 0, sealObtained: false } });
    expect(markSeen(b, 'pomi')).toBe(b);
  });

  it('abate conta (e marca visto) e Selo obtido fica marcado', () => {
    let b: Bestiary = recordKill({}, 'pomi');
    b = recordKill(b, 'pomi');
    b = markSealObtained(b, 'pomi');
    expect(b.pomi).toEqual({ kills: 2, sealObtained: true });
    expect(markSealObtained(b, 'pomi')).toBe(b);
  });

  it('revela aos poucos: visto → 1 abate → 10 abates → Selo', () => {
    expect(bestiaryReveal(undefined, config)).toEqual({ seen: false, stats: false, drops: false, lore: false });
    expect(bestiaryReveal({ kills: 0, sealObtained: false }, config)).toEqual({ seen: true, stats: false, drops: false, lore: false });
    expect(bestiaryReveal({ kills: 1, sealObtained: false }, config)).toEqual({ seen: true, stats: true, drops: false, lore: false });
    expect(bestiaryReveal({ kills: 10, sealObtained: false }, config)).toEqual({ seen: true, stats: true, drops: true, lore: false });
    expect(bestiaryReveal({ kills: 50, sealObtained: true }, config).lore).toBe(true);
  });

  it('conta vistos entre os monstros listados', () => {
    expect(seenCount({ pomi: { kills: 0, sealObtained: false } }, ['pomi', 'plumito'])).toBe(1);
  });
});
