// Minimapa no canto superior direito. O terreno e as saídas são desenhados uma vez por mapa
// (textura em cache, a partir da grade lógica); só os pontos de jogador e monstros são redesenhados,
// e no máximo a cada MINIMAP_DOTS_MS.

import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import type { MapDef } from '../maps/types';
import type { WorldScene } from '../scenes/WorldScene';
import { gameEvents } from '../systems/events';
import { MINIMAP_TILE_COLORS, minimapScale, worldToMinimap } from './uiLogic';

const BOX_W = 112;
const BOX_H = 84;
const MARGIN = 8;
const PAD = 3;
const MINIMAP_DOTS_MS = 100;
const EXIT_COLOR = 0xffd23f;
const PLAYER_COLOR = 0xffffff;
const MONSTER_COLOR = 0xff5a5a;

function textureKey(mapId: string): string {
  return `minimap-${mapId}`;
}

export class Minimap {
  private readonly image: Phaser.GameObjects.Image;
  private readonly dots: Phaser.GameObjects.Graphics;
  private readonly boxX: number;
  private readonly boxY = MARGIN;
  private world: WorldScene | null = null;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private lastDots = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.boxX = scene.scale.width - MARGIN - BOX_W;
    scene.add
      .rectangle(this.boxX, this.boxY, BOX_W, BOX_H, 0x10151f, 0.6)
      .setOrigin(0)
      .setStrokeStyle(1, 0x8fb3ff, 0.8)
      .setInteractive();
    this.image = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setVisible(false);
    this.dots = scene.add.graphics();

    gameEvents.onScene(scene, 'mapEntered', ({ scene: world }) => this.setWorld(world));
  }

  /** Para a cena que já estava ativa antes da UIScene existir. */
  setWorld(world: WorldScene): void {
    this.world = world;
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.world === world) this.world = null;
    });
    const map = world.mapDef;
    this.scale = minimapScale(map.width, map.height, BOX_W - PAD * 2, BOX_H - PAD * 2);
    const w = Math.max(1, Math.round(map.width * this.scale));
    const h = Math.max(1, Math.round(map.height * this.scale));
    this.offsetX = this.boxX + Math.round((BOX_W - w) / 2);
    this.offsetY = this.boxY + Math.round((BOX_H - h) / 2);
    this.ensureTexture(map, w, h);
    this.image.setTexture(textureKey(map.id)).setPosition(this.offsetX, this.offsetY).setVisible(true);
    this.lastDots = 0;
  }

  private ensureTexture(map: MapDef, w: number, h: number): void {
    const key = textureKey(map.id);
    if (this.scene.textures.exists(key)) return;
    const canvas = this.scene.textures.createCanvas(key, w, h);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const s = this.scale;
    const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const color = MINIMAP_TILE_COLORS[map.tiles[y][x]];
        if (color === null) continue;
        ctx.fillStyle = css(color);
        // Arredonda as bordas para não sobrar fresta entre tiles com escala fracionária.
        const x0 = Math.floor(x * s);
        const y0 = Math.floor(y * s);
        ctx.fillRect(x0, y0, Math.ceil((x + 1) * s) - x0, Math.ceil((y + 1) * s) - y0);
      }
    }
    ctx.fillStyle = css(EXIT_COLOR);
    for (const exit of map.exits) {
      const a = exit.area;
      ctx.fillRect(Math.floor(a.x * s), Math.floor(a.y * s), Math.max(2, Math.ceil(a.w * s)), Math.max(2, Math.ceil(a.h * s)));
    }
    canvas.refresh();
  }

  update(time: number): void {
    if (time - this.lastDots < MINIMAP_DOTS_MS) return;
    this.lastDots = time;
    this.dots.clear();
    const world = this.world;
    if (!world || !world.player) return;
    for (const entity of world.entities) {
      if (entity.kind !== 'monster' || entity.dead) continue;
      this.dot(entity.x, entity.y, MONSTER_COLOR, 1.5);
    }
    this.dot(world.player.x, world.player.y, PLAYER_COLOR, 2.5);
  }

  private dot(wx: number, wy: number, color: number, radius: number): void {
    const p = worldToMinimap(wx, wy, TILE_SIZE, this.scale);
    this.dots.fillStyle(0x10151f, 1).fillCircle(this.offsetX + p.x, this.offsetY + p.y, radius + 1);
    this.dots.fillStyle(color, 1).fillCircle(this.offsetX + p.x, this.offsetY + p.y, radius);
  }
}
