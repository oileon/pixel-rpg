import { describe, expect, it } from 'vitest';
import { getMonster } from '../data';
import { HOTBAR_KEYS, KEYS } from '../gameplay/config';
import { bestiaryDetail, chanceText, resonanceText, sealsSignature, sealTooltipText, stockRows } from './sealView';
import { activeResonances } from '../systems/seals';

describe('tecla do Bestiário', () => {
  it('B não colide com outras teclas, atalhos nem WASD/setas', () => {
    const others = [...Object.entries(KEYS).filter(([k]) => k !== 'bestiary').map(([, v]) => v), ...HOTBAR_KEYS, 'W', 'A', 'S', 'D'];
    expect(KEYS.bestiary).toBe('B');
    expect(others).not.toContain(KEYS.bestiary);
  });
});

describe('textos de Selo', () => {
  it('tooltip mostra grau, elemento, efeito e slots', () => {
    const text = sealTooltipText({ sealId: 'seal_pomi', grade: 2 }, 1);
    expect(text).toContain('Selo de Pomi II (1)');
    expect(text).toContain('Água');
    expect(text).toContain('HP +35, VIT +1');
    expect(text).toContain('Arma, Armadura, Acessório');
  });

  it('estojo lista só Selos que o jogador tem', () => {
    expect(stockRows({ seal_pomi: [0, 0, 0], seal_cascudo: [1, 0, 2] })).toEqual([
      { sealId: 'seal_cascudo', counts: { 1: 1, 2: 0, 3: 2 } },
    ]);
  });

  it('Ressonância com nome do grupo', () => {
    const [eco] = activeResonances([
      { sealId: 'seal_pomi', grade: 1 },
      { sealId: 'seal_pomi', grade: 1 },
    ]);
    expect(resonanceText(eco)).toBe('Eco Elemental (Água): MDEF +3, SP +10');
  });

  it('assinatura muda com estoque e encaixes', () => {
    const a = sealsSignature({ seal_pomi: [1, 0, 0] }, {});
    expect(sealsSignature({ seal_pomi: [0, 0, 0] }, { weapon: [{ sealId: 'seal_pomi', grade: 1 }] })).not.toBe(a);
  });
});

describe('entrada do bestiário', () => {
  const pomi = getMonster('pomi');
  const config = { statsKills: 1, dropsKills: 10 };
  const all = (d: ReturnType<typeof bestiaryDetail>) => d.lines.map((l) => l.text).join('\n');

  it('não visto: silhueta e ???', () => {
    const d = bestiaryDetail(pomi, undefined, 0, config);
    expect(d).toMatchObject({ title: '???', silhouette: true });
    expect(all(d)).not.toContain('Pomi');
  });

  it('visto: nome e progresso do Selo, stats e drops escondidos', () => {
    const d = bestiaryDetail(pomi, { kills: 0, sealObtained: false }, 12, config);
    expect(d.title).toBe('Pomi');
    expect(all(d)).toContain('12/100 fragmentos');
    expect(all(d)).not.toContain('HP 40');
    expect(all(d)).toContain('Drops: derrote 10×');
  });

  it('1 abate revela stats; 10 revelam drops; Selo revela lore', () => {
    expect(all(bestiaryDetail(pomi, { kills: 1, sealObtained: false }, 2, config))).toContain('HP 40');
    const ten = all(bestiaryDetail(pomi, { kills: 10, sealObtained: false }, 20, config));
    expect(ten).toContain('Geleia de Pêssego 70%');
    expect(ten).toContain('Lore: obtenha o Selo');
    const lore = all(bestiaryDetail(pomi, { kills: 50, sealObtained: true }, 0, config));
    expect(lore).toContain('orvalho');
    expect(lore).toContain('III: HP +60, VIT +2');
  });

  it('chance legível', () => {
    expect(chanceText(0.7)).toBe('70%');
    expect(chanceText(0.005)).toBe('0,5%');
  });
});
