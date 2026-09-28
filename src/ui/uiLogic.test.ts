import { describe, expect, it } from 'vitest';
import { ITEMS, getItem } from '../data';
import { KEYS } from '../gameplay/config';
import { createInitialPlayerState, playerDerived, previewEquip } from '../gameplay/playerState';
import { Tile, TILE_COUNT } from '../maps/types';
import { FREE_RESPEC_MAX_LEVEL } from '../systems/stats';
import {
  equipComparisonText,
  hotbarSignature,
  inventorySignature,
  MINIMAP_TILE_COLORS,
  minimapScale,
  worldToMinimap,
  itemTooltipText,
  placeTooltip,
  respecButtonLabel,
  statsWindowSignature,
  type StatsWindowView,
} from './uiLogic';

describe('teclas', () => {
  it('Status não usa uma tecla do WASD', () => {
    expect(['W', 'A', 'S', 'D']).not.toContain(KEYS.stats);
  });
});

describe('itemTooltipText', () => {
  it('mostra nome, quantidade, descrição e efeito do consumível', () => {
    const item = getItem('maca_do_ceu');
    const text = itemTooltipText(item, 3);
    expect(text.split('\n')[0].startsWith(`${item.name} (3)`)).toBe(true);
    expect(text).toContain(item.description);
    if (item.effect?.hp) expect(text).toContain(`HP +${item.effect.hp}`);
  });

  it('mostra bônus do equipamento', () => {
    const item = getItem('adaga_treino');
    const text = itemTooltipText(item);
    expect(text.split('\n')[0].startsWith(item.name)).toBe(true);
    if (item.equip?.atk) expect(text).toContain(`ATK +${item.equip.atk}`);
  });

  it('itens não comuns mostram a raridade; comuns não', () => {
    for (const item of ITEMS) {
      const first = itemTooltipText(item).split('\n')[0];
      expect(first.includes('['), item.id).toBe(item.rarity !== 'common');
    }
  });
});

describe('placeTooltip', () => {
  const anchor = { x: 100, y: 100, width: 36, height: 36 };

  it('fica à direita do slot quando cabe', () => {
    expect(placeTooltip(anchor, 200, 60, 960, 540)).toEqual({ x: 144, y: 100 });
  });

  it('vai para a esquerda quando estouraria a borda direita', () => {
    const pos = placeTooltip({ ...anchor, x: 850 }, 200, 60, 960, 540);
    expect(pos.x).toBe(850 - 8 - 200);
  });

  it('nunca sai da tela', () => {
    const pos = placeTooltip({ ...anchor, x: 100, y: 520 }, 300, 80, 320, 540);
    expect(pos.x).toBeGreaterThanOrEqual(4);
    expect(pos.x + 300).toBeLessThanOrEqual(320 - 4);
    expect(pos.y + 80).toBeLessThanOrEqual(540 - 4);
  });
});

describe('respecButtonLabel', () => {
  it('cita FREE_RESPEC_MAX_LEVEL e pede confirmação', () => {
    expect(respecButtonLabel(1, false)).toContain(`${FREE_RESPEC_MAX_LEVEL}`);
    expect(respecButtonLabel(1, true)).toBe('Confirmar reset?');
    expect(respecButtonLabel(FREE_RESPEC_MAX_LEVEL + 1, true)).not.toBe('Confirmar reset?');
  });
});

describe('assinaturas', () => {
  const base = (): StatsWindowView => {
    const s = createInitialPlayerState();
    return { classId: s.classId, level: s.level, stats: { ...s.stats }, equipment: { ...s.equipment }, allocation: {}, confirmingRespec: false };
  };

  it('Status: estável sem mudanças e muda com stats, alocação, nível, equipamento e confirmação', () => {
    const sig = statsWindowSignature(base());
    expect(statsWindowSignature(base())).toBe(sig);
    expect(statsWindowSignature({ ...base(), allocation: { str: 1 } })).not.toBe(sig);
    expect(statsWindowSignature({ ...base(), level: 2 })).not.toBe(sig);
    expect(statsWindowSignature({ ...base(), equipment: {} })).not.toBe(sig);
    expect(statsWindowSignature({ ...base(), confirmingRespec: true })).not.toBe(sig);
    const v = base();
    v.stats.vit += 1;
    expect(statsWindowSignature(v)).not.toBe(sig);
  });

  it('Inventário: muda com quantidade e equipamento', () => {
    const s = createInitialPlayerState();
    const sig = inventorySignature(s);
    expect(inventorySignature({ ...s, currency: s.currency + 1 })).not.toBe(sig);
    const slots = s.inventory.slots.map((x) => (x ? { ...x, quantity: x.quantity - 1 } : x));
    expect(inventorySignature({ ...s, inventory: { slots } })).not.toBe(sig);
    expect(inventorySignature({ ...s, equipment: {} })).not.toBe(sig);
  });
});

describe('comparação de equipamento', () => {
  it('lista só o que muda, com sinal', () => {
    const s = createInitialPlayerState();
    const now = playerDerived(s);
    expect(equipComparisonText(now, { ...now, atk: now.atk + 4, def: now.def - 6 }, true)).toBe('vs. equipado: ATK +4, DEF −6');
    expect(equipComparisonText(now, now, false)).toBe('Ao equipar: sem mudança');
  });

  it('Colete de Lona mostra ganho de DEF para o Aprendiz inicial', () => {
    const s = createInitialPlayerState();
    const text = equipComparisonText(playerDerived(s), previewEquip(s, 'colete_lona'), false);
    expect(text).toMatch(/DEF \+\d+/);
  });
});

describe('minimapa', () => {
  it('toda tile tem cor definida (ou null para o céu)', () => {
    for (let t = 0; t < TILE_COUNT; t++) expect(MINIMAP_TILE_COLORS[t as Tile]).not.toBeUndefined();
  });

  it('escala cabe no quadro mantendo a proporção', () => {
    const scale = minimapScale(64, 48, 112, 84);
    expect(64 * scale).toBeLessThanOrEqual(112);
    expect(48 * scale).toBeLessThanOrEqual(84);
    expect(worldToMinimap(32, 64, 32, scale)).toEqual({ x: scale, y: 2 * scale });
  });
});

describe('hotbarSignature', () => {
  it('muda com a quantidade do item do atalho', () => {
    const s = createInitialPlayerState();
    const a = hotbarSignature(s.hotbar, () => 5);
    expect(hotbarSignature(s.hotbar, () => 4)).not.toBe(a);
  });
});
