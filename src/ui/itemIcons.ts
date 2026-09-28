// Ícones provisórios de itens gerados em runtime (forma pelo tipo, cor de items.json) e cores de raridade.

import Phaser from 'phaser';
import { ITEMS } from '../data';
import type { ItemDef, Rarity } from '../data/types';

export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0xffffff,
  uncommon: 0x5ee06a,
  rare: 0x4aa8ff,
  epic: 0xc77dff,
  legendary: 0xffb84a,
};

export function rarityCss(rarity: Rarity): string {
  return `#${RARITY_COLORS[rarity].toString(16).padStart(6, '0')}`;
}


export const ICON_SIZE = 16;

export function itemIconKey(itemId: string): string {
  return `item-icon-${itemId}`;
}

function drawIcon(g: Phaser.GameObjects.Graphics, item: ItemDef, color: number): void {
  const s = ICON_SIZE;
  g.lineStyle(1, 0x1b2433, 1);
  g.fillStyle(color, 1);
  if (item.type === 'consumable') {
    g.fillCircle(s / 2, s / 2 + 1, 6);
    g.strokeCircle(s / 2, s / 2 + 1, 6);
    g.fillStyle(0x3f7a2c, 1).fillRect(s / 2 - 1, 1, 2, 3);
  } else if (item.type === 'material') {
    const pts = [new Phaser.Math.Vector2(s / 2, 1), new Phaser.Math.Vector2(s - 2, s / 2), new Phaser.Math.Vector2(s / 2, s - 1), new Phaser.Math.Vector2(2, s / 2)];
    g.fillPoints(pts, true);
    g.strokePoints(pts, true);
  } else if (item.equip?.slot === 'weapon') {
    g.fillRect(7, 1, 3, 10);
    g.strokeRect(7, 1, 3, 10);
    g.fillStyle(0x7a5230, 1).fillRect(4, 11, 9, 2).fillRect(7, 13, 3, 3);
  } else {
    g.fillRoundedRect(2, 2, s - 4, s - 3, 3);
    g.strokeRoundedRect(2, 2, s - 4, s - 3, 3);
  }
  g.fillStyle(0xffffff, 0.5).fillRect(5, 4, 2, 2);
}

/** Gera as texturas dos ícones uma vez (o TextureManager é global ao jogo). */
export function ensureItemIcons(scene: Phaser.Scene): void {
  for (const item of ITEMS) {
    const key = itemIconKey(item.id);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    drawIcon(g, item, Phaser.Display.Color.HexStringToColor(item.iconColor).color);
    g.generateTexture(key, ICON_SIZE, ICON_SIZE);
    g.destroy();
  }
}

/** Chave de textura do ícone (sem tint: a cor já vem de items.json; a raridade aparece na borda do slot). */
export function getItemIcon(scene: Phaser.Scene, item: ItemDef): string {
  ensureItemIcons(scene);
  return itemIconKey(item.id);
}
