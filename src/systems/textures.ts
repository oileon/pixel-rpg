// Texturas geradas em runtime: tileset provisório (colisão + fallback do cenário real) e placeholders
// de personagens/monstros.

import Phaser from 'phaser';
import { allVisuals, textureKey, type VisualDef } from '../assets/manifest';
import { TILE_SIZE } from '../config';
import { seededRng } from '../maps/gen';
import { Tile, TILE_COUNT } from '../maps/types';

export const TILESET_KEY = 'tiles';

type Ctx = CanvasRenderingContext2D;

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Preenche o tile com cor base + pixels de ruído. */
function noiseFill(ctx: Ctx, ox: number, base: number, speck: number, density: number, seed: number): void {
  const rng = seededRng(seed);
  ctx.fillStyle = hex(base);
  ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = hex(speck);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rng() < density) ctx.fillRect(ox + x, y, 1, 1);
    }
  }
}

function circle(ctx: Ctx, x: number, y: number, r: number, color: number): void {
  ctx.fillStyle = hex(color);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawTile(ctx: Ctx, tile: Tile, ox: number): void {
  const T = TILE_SIZE;
  switch (tile) {
    case Tile.Cloud:
      // Transparente: o mar de nuvens animado (systems/sky.ts) aparece por baixo.
      break;
    case Tile.Grass:
      noiseFill(ctx, ox, 0x7cc464, 0x68b052, 0.12, 21);
      break;
    case Tile.Path:
      noiseFill(ctx, ox, 0xd8b57a, 0xc49e62, 0.15, 31);
      break;
    case Tile.Water:
      noiseFill(ctx, ox, 0x4aa3df, 0x3c8fcb, 0.1, 41);
      ctx.fillStyle = '#a6dcff';
      ctx.fillRect(ox + 5, 9, 8, 1);
      ctx.fillRect(ox + 18, 21, 9, 1);
      break;
    case Tile.Tree:
      noiseFill(ctx, ox, 0x7cc464, 0x68b052, 0.12, 21);
      ctx.fillStyle = '#6b4a2b';
      ctx.fillRect(ox + 13, 20, 6, 10);
      circle(ctx, ox + 16, 14, 11, 0x2f7a3a);
      circle(ctx, ox + 13, 11, 5, 0x3f9a4a);
      break;
    case Tile.Wall:
      noiseFill(ctx, ox, 0xe9d7b5, 0xd9c5a0, 0.1, 51);
      ctx.fillStyle = '#b89a6a';
      for (let y = 0; y < T; y += 8) {
        ctx.fillRect(ox, y, T, 1);
        const shift = (y / 8) % 2 === 0 ? 0 : 8;
        for (let x = shift; x < T; x += 16) ctx.fillRect(ox + x, y, 1, 8);
      }
      break;
    case Tile.Rock:
      noiseFill(ctx, ox, 0x7cc464, 0x68b052, 0.12, 21);
      circle(ctx, ox + 16, 18, 10, 0x8c8c96);
      circle(ctx, ox + 13, 15, 4, 0xb0b0ba);
      break;
    case Tile.Flowers: {
      noiseFill(ctx, ox, 0x7cc464, 0x68b052, 0.12, 21);
      const rng = seededRng(71);
      const colors = [0xffe066, 0xff8fb1, 0xffffff];
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = hex(colors[i % colors.length]!);
        ctx.fillRect(ox + 2 + Math.floor(rng() * (T - 4)), 2 + Math.floor(rng() * (T - 4)), 2, 2);
      }
      break;
    }
    case Tile.Bridge:
      noiseFill(ctx, ox, 0xa0703f, 0x8e6034, 0.08, 81);
      ctx.fillStyle = '#6e4724';
      for (let x = 0; x < T; x += 6) ctx.fillRect(ox + x, 0, 1, T);
      break;
    case Tile.Roof:
      noiseFill(ctx, ox, 0xd9573f, 0xc54a34, 0.1, 91);
      ctx.fillStyle = '#a93a28';
      for (let y = 3; y < T; y += 6) ctx.fillRect(ox, y, T, 2);
      break;
    case Tile.Plaza:
      noiseFill(ctx, ox, 0xcfcac2, 0xbdb7ae, 0.1, 101);
      ctx.fillStyle = '#a9a39a';
      ctx.fillRect(ox, 0, T, 1);
      ctx.fillRect(ox, 16, T, 1);
      ctx.fillRect(ox, 0, 1, 16);
      ctx.fillRect(ox + 16, 16, 1, 16);
      break;
    case Tile.Prop:
      // Caixote: só aparece se a arte do objeto faltar.
      noiseFill(ctx, ox, 0x7cc464, 0x68b052, 0.12, 21);
      ctx.fillStyle = '#8a5a34';
      ctx.fillRect(ox + 4, 6, T - 8, T - 10);
      ctx.fillStyle = '#6e4724';
      ctx.fillRect(ox + 4, 6, T - 8, 2);
      ctx.fillRect(ox + 4, 16, T - 8, 1);
      break;
    case Tile.Deck:
      noiseFill(ctx, ox, 0x4aa3df, 0x3c8fcb, 0.1, 41);
      ctx.fillStyle = '#a0703f';
      ctx.fillRect(ox + 4, 0, T - 8, T);
      ctx.fillStyle = '#6e4724';
      for (let y = 0; y < T; y += 6) ctx.fillRect(ox + 4, y, T - 8, 1);
      break;
  }
}

export function generateTileset(scene: Phaser.Scene): void {
  if (scene.textures.exists(TILESET_KEY)) return;
  const canvas = scene.textures.createCanvas(TILESET_KEY, TILE_COUNT * TILE_SIZE, TILE_SIZE);
  if (!canvas) throw new Error('Não foi possível criar o tileset');
  const ctx = canvas.getContext();
  for (let i = 0; i < TILE_COUNT; i++) {
    drawTile(ctx, i as Tile, i * TILE_SIZE);
    // Frame = valor do Tile (usado pelo fallback de objetos de cenário sem arte).
    canvas.add(i, 0, i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
  }
  canvas.refresh();
}

/** Gera a textura placeholder de todo visual (também serve de fallback enquanto nada carregou). */
export function generatePlaceholders(scene: Phaser.Scene, visuals: readonly VisualDef[] = allVisuals()): void {
  for (const visual of visuals) {
    const key = textureKey.placeholder(visual.key);
    if (scene.textures.exists(key)) continue;
    const src = visual.source;
    const w = src.kind === 'placeholder' ? src.width : src.frameWidth;
    const h = src.kind === 'placeholder' ? src.height : src.frameHeight;
    const color = src.kind === 'placeholder' ? src.color : 0xff00ff;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const feet = visual.feetY;
    // Sombra.
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(w / 2, feet, w * 0.7, 6);
    if (src.kind === 'placeholder' && src.shape === 'person') {
      g.fillStyle(color, 1);
      g.fillRoundedRect(w * 0.3, feet - h * 0.55, w * 0.4, h * 0.5, 4);
      g.fillCircle(w / 2, feet - h * 0.7, w * 0.2);
    } else {
      const bh = Math.min(h - 2, feet) * 0.9;
      g.fillStyle(color, 1);
      g.fillEllipse(w / 2, feet - bh / 2, w * 0.9, bh);
      g.lineStyle(1, 0x000000, 0.5);
      g.strokeEllipse(w / 2, feet - bh / 2, w * 0.9, bh);
      g.fillStyle(0x222222, 1);
      g.fillRect(w * 0.35, feet - bh * 0.6, 2, 3);
      g.fillRect(w * 0.6, feet - bh * 0.6, 2, 3);
    }
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
