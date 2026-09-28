// Desenha o cenário real (tilesets Wang em dual grid + objetos do PixelLab) a partir da grade lógica.
// Só visual: colisão e pathfinding continuam na camada lógica do WorldScene.

import Phaser from 'phaser';
import {
  allTilesets,
  RETURN_STONE_ACTIVE,
  SCENERY_OBJECTS,
  sceneryMetaKey,
  THEMES,
  type SceneryObjectKind,
  type TilesetDef,
} from '../assets/scenery';
import { PURE_CLOUD_FRAME } from '../assets/sky';
import { TILE_SIZE } from '../config';
import { buildSceneryLayout, EMPTY_FRAME, type PlacedObject } from '../maps/scenery';
import type { MapDef } from '../maps/types';
import { TILESET_KEY } from './textures';

/** Chão fica abaixo de tudo; entidades e objetos usam depth = y dos pés/pivô. */
const GROUND_DEPTH = -10;
/** Ponte e decoração do fallback: acima do chão, abaixo de qualquer entidade. */
const GROUND_OBJECT_DEPTH = -5;

/** Carrega tilesets, objetos e meta.json do cenário (chamar no preload do boot). */
export function preloadScenery(load: Phaser.Loader.LoaderPlugin): void {
  for (const ts of allTilesets()) load.image(ts.key, ts.url);
  for (const [kind, def] of Object.entries(SCENERY_OBJECTS) as [SceneryObjectKind, (typeof SCENERY_OBJECTS)[SceneryObjectKind]][]) {
    if (def.frameSize) load.spritesheet(def.key, def.url, { frameWidth: def.frameSize, frameHeight: def.frameSize });
    else load.image(def.key, def.url);
    if (def.metaUrl) load.json(sceneryMetaKey(kind), def.metaUrl);
  }
  load.image(RETURN_STONE_ACTIVE.key, RETURN_STONE_ACTIVE.url);
}

/** Origem normalizada (pivô) do meta.json; sem meta, base centrada. */
export function objectOrigin(scene: Phaser.Scene, kind: SceneryObjectKind): { x: number; y: number } {
  const meta: unknown = scene.cache.json.get(sceneryMetaKey(kind));
  const origin = (meta as { origin?: { x?: unknown; y?: unknown } } | undefined)?.origin;
  const x = typeof origin?.x === 'number' ? origin.x : 0.5;
  const y = typeof origin?.y === 'number' ? origin.y : 1;
  return { x, y };
}

function groundLayer(scene: Phaser.Scene, def: TilesetDef, frames: number[][], depth: number): Phaser.Tilemaps.TilemapLayer {
  const height = frames.length;
  const width = frames[0]?.length ?? 0;
  const tilemap = scene.make.tilemap({ width, height, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
  const tileset = tilemap.addTilesetImage(def.key, def.key, TILE_SIZE, TILE_SIZE, 0, 0);
  if (!tileset) throw new Error(`Tileset ${def.key} não carregado`);
  // Dual grid: cada célula fica entre 4 tiles lógicos, deslocada meio tile.
  const layer = tilemap.createBlankLayer(def.key, tileset, -TILE_SIZE / 2, -TILE_SIZE / 2);
  if (!layer) throw new Error(`Falha ao criar camada ${def.key}`);
  frames.forEach((row, y) =>
    row.forEach((frame, x) => {
      if (frame !== EMPTY_FRAME) layer.putTileAt(frame, x, y);
    }),
  );
  return layer.setDepth(depth);
}

/** Objeto sem arte carregada: desenha os tiles provisórios da área que ele representa. */
function drawFallback(scene: Phaser.Scene, map: MapDef, obj: PlacedObject): void {
  const { x, y, w, h } = obj.rect;
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      const tile = map.tiles[ty]?.[tx];
      if (tile === undefined) continue;
      scene.add.image(tx * TILE_SIZE, ty * TILE_SIZE, TILESET_KEY, tile).setOrigin(0).setDepth(GROUND_OBJECT_DEPTH);
    }
  }
}

/** Desenha o objeto; devolve a imagem se for peça de chão (ponte), que também projeta sombra no céu. */
function drawObject(scene: Phaser.Scene, map: MapDef, obj: PlacedObject): Phaser.GameObjects.Image | null {
  const def = SCENERY_OBJECTS[obj.kind];
  if (!scene.textures.exists(def.key)) {
    drawFallback(scene, map, obj);
    return null;
  }
  if (obj.frame !== undefined) {
    return scene.add.image(obj.x, obj.y, def.key, obj.frame).setOrigin(0).setDepth(GROUND_OBJECT_DEPTH);
  }
  const origin = objectOrigin(scene, obj.kind);
  if (obj.flat) {
    scene.add.image(obj.x, obj.y, def.key).setOrigin(origin.x, origin.y).setDepth(GROUND_OBJECT_DEPTH);
    return null;
  }
  // Mesma regra dos personagens (depth = y do pivô); decoração pisável fica atrás de quem está na célula.
  const depth = obj.ground ? obj.y - TILE_SIZE : obj.y;
  scene.add.image(obj.x, obj.y, def.key).setOrigin(origin.x, origin.y).setDepth(depth);
  return null;
}

export interface SceneryResult {
  /** Camada base (borda da ilha); com o tileset recortado, a nuvem é transparente e revela o céu. */
  base: Phaser.Tilemaps.TilemapLayer;
  /** Peças de chão sobre o céu (pontes). */
  groundObjects: Phaser.GameObjects.Image[];
}

/**
 * Monta chão e objetos do mapa com a arte real. Retorna null (sem desenhar nada) se faltar
 * algum tileset — aí o WorldScene mantém o tileset provisório visível.
 */
export function renderScenery(scene: Phaser.Scene, map: MapDef): SceneryResult | null {
  const theme = THEMES[map.theme ?? 'meadow'];
  const tilesets = [theme.base, ...Object.values(theme.overlays)];
  const missing = tilesets.filter((ts) => !scene.textures.exists(ts.key));
  if (missing.length > 0) {
    console.warn(`[scenery] tilesets ausentes (${missing.map((m) => m.key).join(', ')}) — usando tileset provisório`);
    return null;
  }

  const layout = buildSceneryLayout(map);
  // Com o recorte (arquivo ou gerado no boot) a nuvem é transparente: células só de nuvem nem entram.
  const cutout = scene.textures.exists(theme.cutout.key);
  const baseDef = cutout ? theme.cutout : theme.base;
  const baseFrames = cutout ? layout.base.map((row) => row.map((f) => (f === PURE_CLOUD_FRAME ? EMPTY_FRAME : f))) : layout.base;
  const base = groundLayer(scene, baseDef, baseFrames, GROUND_DEPTH);
  layout.overlays.forEach((o, i) => {
    const def = theme.overlays[o.terrain];
    if (def) groundLayer(scene, def, o.frames, GROUND_DEPTH + 1 + i);
  });
  const groundObjects: Phaser.GameObjects.Image[] = [];
  for (const obj of layout.objects) {
    const image = drawObject(scene, map, obj);
    if (image) groundObjects.push(image);
  }
  return { base, groundObjects };
}
