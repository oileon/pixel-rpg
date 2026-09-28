// Mar de nuvens animado: camadas tileáveis com parallax e vento, nuvens avulsas por baixo (e poucas por
// cima) da ilha e a sombra da ilha nas nuvens. Só visual — mapa lógico, colisão e pathfinding não mudam.
// Texturas são carregadas/geradas uma vez no boot; por frame só mudam posições.

import Phaser from 'phaser';
import {
  ISLAND_SHADOW,
  PUFFS_ABOVE,
  PUFFS_BELOW,
  PURE_CLOUD_FRAME,
  SKY_LAYERS,
  SKY_PUFFS,
  type PuffGroupDef,
} from '../assets/sky';
import { THEMES, type TilesetDef } from '../assets/scenery';
import { SKY_COLOR, TILE_SIZE } from '../config';
import { seededRng } from '../maps/gen';
import type { MapDef } from '../maps/types';
import type { SceneryResult } from './scenery';
import { cutoutCloudPixels, inRange, puffExit, skyLayerOffset } from './skyMath';

const SKY_DEPTH = -100;
const PUFF_BELOW_DEPTH = -40;
const SHADOW_DEPTH = -20;
/** Acima dos personagens (depth = y), abaixo das barras/textos flutuantes do gameplay. */
const PUFF_ABOVE_DEPTH = 30000;

type Ctx = CanvasRenderingContext2D;

interface CloudPalette {
  shadow: string;
  base: string;
  light: string;
}

const NEAR_PALETTE: CloudPalette = { shadow: '#b7c6ec', base: '#eef4ff', light: '#ffffff' };
const MID_PALETTE: CloudPalette = { shadow: '#a9bde6', base: '#d6e4fa', light: '#eaf2ff' };

/** Disco "pixelado" (sem antialias), repetido nas bordas quando `wrap` para a textura ser tileável. */
function pixelDisc(ctx: Ctx, cx: number, cy: number, r: number, color: string, wrap: { w: number; h: number } | null): void {
  ctx.fillStyle = color;
  const offsets = wrap ? [-1, 0, 1] : [0];
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    for (const ox of offsets) {
      for (const oy of offsets) {
        const x = Math.round(cx - half) + ox * (wrap?.w ?? 0);
        const y = Math.round(cy + dy) + oy * (wrap?.h ?? 0);
        ctx.fillRect(x, y, half * 2 + 1, 1);
      }
    }
  }
}

/** Nuvem fofa: discos em fila com sombra embaixo e brilho em cima. */
function cloudCluster(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  rng: () => number,
  palette: CloudPalette,
  wrap: { w: number; h: number } | null,
): void {
  const n = 4 + Math.floor(rng() * 3);
  const discs = Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const center = 1 - Math.abs(t - 0.5) * 2;
    return {
      x: x + (t - 0.5) * size * 2,
      y: y - center * size * 0.25 + (rng() - 0.5) * size * 0.15,
      r: Math.max(3, Math.round(size * (0.3 + 0.3 * center + rng() * 0.1))),
    };
  });
  for (const d of discs) pixelDisc(ctx, d.x, d.y + d.r * 0.2, d.r, palette.shadow, wrap);
  for (const d of discs) pixelDisc(ctx, d.x, d.y, d.r * 0.92, palette.base, wrap);
  for (const d of discs) pixelDisc(ctx, d.x - d.r * 0.15, d.y - d.r * 0.3, d.r * 0.5, palette.light, wrap);
}

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext());
  tex.refresh();
}

/** Placeholders procedurais das camadas: longe (céu com faixas), meio e perto (nuvens tileáveis). */
function generateLayerPlaceholder(scene: Phaser.Scene, index: number, key: string): void {
  const rng = seededRng(900 + index);
  if (index === 0) {
    canvasTexture(scene, key, 256, 256, (ctx) => {
      ctx.fillStyle = SKY_COLOR;
      ctx.fillRect(0, 0, 256, 256);
      const wrap = { w: 256, h: 256 };
      for (let i = 0; i < 7; i++) {
        const y = rng() * 256;
        const x = rng() * 256;
        ctx.globalAlpha = 0.35;
        for (let k = 0; k < 5; k++) pixelDisc(ctx, x + k * 14, y + (rng() - 0.5) * 4, 6 + rng() * 5, '#c4e6fa', wrap);
      }
      ctx.globalAlpha = 1;
    });
    return;
  }
  const near = index >= 2;
  const w = 512;
  const h = near ? 320 : 256;
  canvasTexture(scene, key, w, h, (ctx) => {
    const wrap = { w, h };
    const count = near ? 6 : 9;
    for (let i = 0; i < count; i++) {
      const size = near ? 34 + rng() * 26 : 18 + rng() * 16;
      cloudCluster(ctx, rng() * w, rng() * h, size, rng, near ? NEAR_PALETTE : MID_PALETTE, wrap);
    }
  });
}

function generatePuffPlaceholder(scene: Phaser.Scene, index: number, key: string): void {
  const sizes = [
    [112, 52],
    [144, 60],
    [176, 70],
    [88, 44],
  ] as const;
  const [w, h] = sizes[index % sizes.length]!;
  const rng = seededRng(1300 + index);
  canvasTexture(scene, key, w, h, (ctx) => cloudCluster(ctx, w / 2, h * 0.58, w * 0.3, rng, NEAR_PALETTE, null));
}

/** Tileset base com a nuvem recortada, gerado a partir do original (só se o arquivo recortado faltar). */
function generateCloudCutout(scene: Phaser.Scene, base: TilesetDef, cutout: TilesetDef): void {
  if (scene.textures.exists(cutout.key) || !scene.textures.exists(base.key)) return;
  const source = scene.textures.get(base.key).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const tex = scene.textures.createCanvas(cutout.key, source.width, source.height);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, source.width, source.height);
  const columns = Math.floor(source.width / TILE_SIZE);
  const cloudRect = {
    x: (PURE_CLOUD_FRAME % columns) * TILE_SIZE,
    y: Math.floor(PURE_CLOUD_FRAME / columns) * TILE_SIZE,
    w: TILE_SIZE,
    h: TILE_SIZE,
  };
  image.data.set(cutoutCloudPixels(image.data, source.width, cloudRect));
  ctx.putImageData(image, 0, 0);
  tex.refresh();
}

/** Carrega a arte do céu (chamar no preload do boot). */
export function preloadSky(load: Phaser.Loader.LoaderPlugin): void {
  for (const layer of SKY_LAYERS) load.image(layer.key, layer.url);
  for (const puff of SKY_PUFFS) load.image(puff.key, puff.url);
  for (const theme of Object.values(THEMES)) load.image(theme.cutout.key, theme.cutout.url);
}

/** Completa com placeholders o que não carregou e gera o recorte da nuvem (chamar no create do boot). */
export function generateSkyTextures(scene: Phaser.Scene): void {
  SKY_LAYERS.forEach((layer, i) => {
    if (!scene.textures.exists(layer.key)) generateLayerPlaceholder(scene, i, layer.key);
  });
  SKY_PUFFS.forEach((puff, i) => {
    if (!scene.textures.exists(puff.key)) generatePuffPlaceholder(scene, i, puff.key);
  });
  for (const theme of Object.values(THEMES)) generateCloudCutout(scene, theme.base, theme.cutout);
}

interface Puff {
  image: Phaser.GameObjects.Image;
  group: PuffGroupDef;
  parallax: number;
  speed: number;
}

export class SkyBackground {
  private readonly layers: { sprite: Phaser.GameObjects.TileSprite; def: (typeof SKY_LAYERS)[number] }[] = [];
  private readonly puffs: Puff[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    map: MapDef,
    scenery: SceneryResult | null,
    private readonly rng: () => number = Math.random,
  ) {
    const cam = scene.cameras.main;
    SKY_LAYERS.forEach((def, i) => {
      const sprite = scene.add
        .tileSprite(0, 0, cam.width, cam.height, def.key)
        .setOrigin(0)
        .setScrollFactor(0)
        .setAlpha(def.alpha)
        .setDepth(SKY_DEPTH + i);
      this.layers.push({ sprite, def });
    });
    if (scenery) this.createShadow(map, scenery);
    for (let i = 0; i < PUFFS_BELOW.count; i++) this.addPuff(PUFFS_BELOW, PUFF_BELOW_DEPTH, true);
    for (let i = 0; i < PUFFS_ABOVE.count; i++) this.addPuff(PUFFS_ABOVE, PUFF_ABOVE_DEPTH, true);

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this));
  }

  /**
   * Silhueta da ilha (chão base + pontes) numa RenderTexture estática, deslocada para baixo: aparece
   * nas nuvens logo abaixo das bordas. Só em WebGL (tintFill não existe no Canvas).
   */
  private createShadow(map: MapDef, scenery: SceneryResult): void {
    if (this.scene.game.renderer.type !== Phaser.WEBGL) return;
    const pad = TILE_SIZE * 4;
    const { dx, dy, color, alpha } = ISLAND_SHADOW;
    const rt = this.scene.add.renderTexture(-pad, -pad, map.width * TILE_SIZE + pad * 2, map.height * TILE_SIZE + pad * 2);
    rt.setOrigin(0);
    // A câmera interna da RenderTexture não tem worldView montado: sem skipCull a camada culla todos os tiles.
    const skipCull = scenery.base.skipCull;
    scenery.base.skipCull = true;
    for (const obj of [scenery.base, ...scenery.groundObjects]) rt.draw(obj, obj.x + pad + dx, obj.y + pad + dy);
    scenery.base.skipCull = skipCull;
    rt.setTintFill(color).setAlpha(alpha).setDepth(SHADOW_DEPTH);
  }

  private addPuff(group: PuffGroupDef, depth: number, anywhere: boolean): void {
    const puff = SKY_PUFFS[Math.floor(this.rng() * SKY_PUFFS.length)]!;
    const image = this.scene.add.image(0, 0, puff.key).setOrigin(0).setAlpha(group.alpha).setDepth(depth);
    const p: Puff = { image, group, parallax: 0, speed: 0 };
    this.respawn(p, anywhere ? 'anywhere' : 'left');
    this.puffs.push(p);
  }

  /** Sorteia textura/escala/velocidade e reposiciona (em coordenadas de tela, convertidas para mundo). */
  private respawn(p: Puff, side: 'anywhere' | 'left' | 'right'): void {
    const cam = this.scene.cameras.main;
    const puff = SKY_PUFFS[Math.floor(this.rng() * SKY_PUFFS.length)]!;
    p.image.setTexture(puff.key).setScale(Math.round(inRange(p.group.scale, this.rng) * 2) / 2);
    p.parallax = inRange(p.group.parallax, this.rng);
    p.speed = inRange(p.group.speed, this.rng);
    p.image.setScrollFactor(p.parallax);
    const w = p.image.displayWidth;
    const screenX =
      side === 'left' ? -w - this.rng() * 160 : side === 'right' ? cam.width + this.rng() * 80 : this.rng() * (cam.width + w) - w;
    const screenY = this.rng() * cam.height - p.image.displayHeight / 2;
    p.image.setPosition(screenX + cam.scrollX * p.parallax, screenY + cam.scrollY * p.parallax);
  }

  private update(time: number, delta: number): void {
    const cam = this.scene.cameras.main;
    for (const { sprite, def } of this.layers) {
      const off = skyLayerOffset(def, cam.scrollX, cam.scrollY, time);
      sprite.setTilePosition(off.x, off.y);
    }
    const dt = delta / 1000;
    for (const p of this.puffs) {
      p.image.x += p.speed * dt;
      const sx = p.image.x - cam.scrollX * p.parallax;
      const sy = p.image.y - cam.scrollY * p.parallax;
      const exit = puffExit(sx, sy, p.image.displayWidth, p.image.displayHeight, cam.width, cam.height);
      if (exit === 'right') this.respawn(p, 'left');
      else if (exit === 'left') this.respawn(p, 'right');
      // Saiu por cima/baixo (câmera andou em y): volta pela esquerda, fora da tela, sem "piscar" no meio.
      else if (exit === 'vertical') this.respawn(p, 'left');
    }
  }
}
