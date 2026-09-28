// Traduz a grade lógica `tiles[y][x]` em cenário desenhável: frames Wang (dual grid) e objetos.
// Puro (sem Phaser) — a colisão continua na grade lógica; isto é só visual.

import {
  FLAT_PROPS,
  HOUSE_FOOTPRINTS,
  OVERLAY_ORDER,
  THEMES,
  WALKABLE_DECOR,
  WANG_FRAME,
  type HouseKind,
  type OverlayTerrain,
  type SceneryObjectKind,
  type Terrain,
  type ThemeDef,
} from '../assets/scenery';
import { TILE_SIZE } from '../config';
import { Tile, type MapDef, type TileRect } from './types';

/** Frame vazio (célula sem tile na camada). */
export const EMPTY_FRAME = -1;

/** Ponte que chega na borda do mapa continua além dela (a câmera mostra um pouco de céu fora do mapa). */
export const BRIDGE_OVERHANG_TILES = 4;

export interface PlacedObject {
  kind: SceneryObjectKind;
  /** Área lógica (tiles) que o objeto representa — usada no fallback provisório. */
  rect: TileRect;
  /** Ponto de apoio no mundo (px): base centrada da área, ou canto superior esquerdo se `frame` definido. */
  x: number;
  y: number;
  /** Frame do sprite sheet (só objetos tileáveis, ex. ponte). */
  frame?: number;
  /** Objeto de chão/decoração pisável: fica atrás de quem está na mesma célula. */
  ground: boolean;
  /** Peça de chão desenhada no nível da ponte, abaixo de qualquer entidade (ex.: `bridge-stream`). */
  flat?: boolean;
}

export interface SceneryLayout {
  /** Terreno de cada vértice = cada tile lógico, [y][x]. */
  terrain: Terrain[][];
  /** Células do dual grid: (W+1)x(H+1), desenhadas deslocadas (−TILE/2, −TILE/2). [y][x] */
  base: number[][];
  overlays: { terrain: OverlayTerrain; frames: number[][] }[];
  objects: PlacedObject[];
}

/** Cantos que cada overlay trata como "lower". A praça absorve o caminho para não sobrar faixa de grama entre os dois. */
const OVERLAY_LOWER: Readonly<Record<OverlayTerrain, readonly Terrain[]>> = {
  path: ['path'],
  water: ['water'],
  plaza: ['plaza', 'path'],
};

const HOUSE_TILES: ReadonlySet<Tile> = new Set([Tile.Roof, Tile.Wall]);

/** Hash determinístico por célula (variações de árvore/pedra estáveis entre carregamentos). */
function cellHash(x: number, y: number): number {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) % 100;
}

/** Componentes 4-conexas das células que satisfazem `match`. */
function components(tiles: Tile[][], match: (t: Tile) => boolean): { x: number; y: number }[][] {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  const seen = new Set<number>();
  const result: { x: number; y: number }[][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen.has(y * w + x) || !match(tiles[y]![x]!)) continue;
      const cells: { x: number; y: number }[] = [];
      const stack = [{ x, y }];
      seen.add(y * w + x);
      while (stack.length > 0) {
        const c = stack.pop()!;
        cells.push(c);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(ny * w + nx)) continue;
          if (!match(tiles[ny]![nx]!)) continue;
          seen.add(ny * w + nx);
          stack.push({ x: nx, y: ny });
        }
      }
      result.push(cells);
    }
  }
  return result;
}

function boundsOf(cells: readonly { x: number; y: number }[]): TileRect {
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 };
}

/** Objeto ancorado na base centrada de uma área (pivô do meta.json). */
function anchored(kind: SceneryObjectKind, rect: TileRect, ground = false): PlacedObject {
  return { kind, rect, x: (rect.x + rect.w / 2) * TILE_SIZE, y: (rect.y + rect.h) * TILE_SIZE, ground };
}

/** Água cercada só por praça (a fonte 2x2 do town.ts) vira objeto, não lago. */
function isFountain(tiles: Tile[][], cells: readonly { x: number; y: number }[]): boolean {
  const inside = new Set(cells.map((c) => `${c.x},${c.y}`));
  for (const c of cells) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (inside.has(`${nx},${ny}`)) continue;
      if (tiles[ny]?.[nx] !== Tile.Plaza) return false;
    }
  }
  return true;
}

/**
 * Ponte tileável: cada bloco de Tile.Bridge vira um retângulo reto (a borda da ilha é irregular, então
 * cada linha da estrada começa a ponte num x diferente), +1 coluna de cada lado para cobrir a emenda
 * com o caminho — lá o overlay não é desenhado por ter canto de nuvem. Na borda do mapa, segue para fora.
 */
function bridgePieces(tiles: Tile[][]): PlacedObject[] {
  const width = tiles[0]?.length ?? 0;
  const pieces: PlacedObject[] = [];
  for (const cells of components(tiles, (t) => t === Tile.Bridge)) {
    const r = boundsOf(cells);
    const x0 = r.x === 0 ? -BRIDGE_OVERHANG_TILES : r.x - 1;
    const x1 = r.x + r.w === width ? width - 1 + BRIDGE_OVERHANG_TILES : r.x + r.w;
    for (let y = r.y; y < r.y + r.h; y++) {
      // Frames: 0 = borda norte, 1 = deck, 2 = borda sul.
      const frame = y === r.y && r.h > 1 ? 0 : y === r.y + r.h - 1 && r.h > 1 ? 2 : 1;
      for (let x = x0; x <= x1; x++) {
        pieces.push({ kind: 'bridge-h', rect: { x, y, w: 1, h: 1 }, x: x * TILE_SIZE, y: y * TILE_SIZE, frame, ground: true });
      }
    }
  }
  return pieces;
}

const HOUSE_KINDS = Object.keys(HOUSE_FOOTPRINTS) as HouseKind[];

/** Sprite de casa cujo footprint bate com o bloco; sem par exato, o de largura mais próxima. */
function houseKindFor(rect: TileRect, seen: Map<string, number>): HouseKind {
  let options = HOUSE_KINDS.filter((k) => HOUSE_FOOTPRINTS[k].w === rect.w && HOUSE_FOOTPRINTS[k].h === rect.h);
  if (options.length === 0) {
    const dist = (k: HouseKind) => Math.abs(HOUSE_FOOTPRINTS[k].w - rect.w);
    const best = Math.min(...HOUSE_KINDS.map(dist));
    options = HOUSE_KINDS.filter((k) => dist(k) === best);
  }
  const sizeKey = `${rect.w}x${rect.h}`;
  const n = seen.get(sizeKey) ?? 0;
  seen.set(sizeKey, n + 1);
  return options[n % options.length]!;
}

/** Variação estável por célula: `hash` (0..99) escolhe um item da lista (repetir um item = mais peso). */
function pick<T>(list: readonly T[], x: number, y: number): T {
  return list[Math.floor((cellHash(x, y) * list.length) / 100)]!;
}

function buildObjects(map: MapDef, theme: ThemeDef, fountains: TileRect[]): PlacedObject[] {
  const tiles = map.tiles;
  const objects: PlacedObject[] = [];

  // Casas: cada bloco Roof/Wall é a colisão (footprint) de uma casa; o tamanho diz qual sprite.
  // Casas de mesmo footprint (vermelha/laranja) alternam na ordem de leitura.
  const seen = new Map<string, number>();
  for (const cells of components(tiles, (t) => HOUSE_TILES.has(t))) {
    const rect = boundsOf(cells);
    const kind = houseKindFor(rect, seen);
    objects.push(anchored(kind, rect));
  }

  for (const rect of fountains) objects.push(anchored('fountain', rect));

  tiles.forEach((row, y) => {
    row.forEach((t, x) => {
      const cell = { x, y, w: 1, h: 1 };
      const kind = t === Tile.Tree ? theme.trees : t === Tile.Rock ? theme.rocks : t === Tile.Flowers ? theme.flowers : null;
      if (!kind) return;
      const chosen = pick(kind, x, y);
      objects.push(anchored(chosen, cell, WALKABLE_DECOR.has(chosen)));
    });
  });

  for (const prop of map.props ?? []) {
    const obj = anchored(prop.kind, prop.rect);
    if (FLAT_PROPS.has(prop.kind)) obj.flat = true;
    objects.push(obj);
  }

  objects.push(...bridgePieces(tiles));
  return objects;
}

function terrainOf(t: Tile): Terrain {
  switch (t) {
    case Tile.Cloud:
    case Tile.Bridge:
      return 'cloud';
    case Tile.Path:
      return 'path';
    case Tile.Plaza:
      return 'plaza';
    case Tile.Water:
    case Tile.Deck:
      return 'water';
    default:
      // Grass, Tree, Rock, Flowers, Roof, Wall: grama + objeto. Prop: resolvido por propGround.
      return 'grass';
  }
}

/**
 * Chão sob objetos colocados à mão: o terreno mais comum entre os vizinhos (4 direções) que não são Prop
 * nem nuvem — a barraca na praça fica sobre praça, sem um "buraco" de grama. Empate: ordem N, S, O, L.
 */
function propGround(tiles: Tile[][], terrain: Terrain[][]): void {
  tiles.forEach((row, y) =>
    row.forEach((t, x) => {
      if (t !== Tile.Prop) return;
      const counts = new Map<Terrain, number>();
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const n = tiles[y + dy]?.[x + dx];
        if (n === undefined || n === Tile.Prop || n === Tile.Cloud) continue;
        const nt = terrainOf(n);
        counts.set(nt, (counts.get(nt) ?? 0) + 1);
      }
      let best: Terrain = 'grass';
      let bestCount = 0;
      for (const [nt, c] of counts) {
        if (c > bestCount) {
          best = nt;
          bestCount = c;
        }
      }
      terrain[y]![x] = best;
    }),
  );
}

/**
 * Frames do dual grid: a célula (x,y) usa os vértices (x-1,y-1) (x,y-1) (x-1,y) (x,y).
 * `draw` decide se a célula entra na camada; `isLower` diz quais cantos são o terreno "baixo".
 */
function wangFrames(
  terrain: Terrain[][],
  draw: (corners: readonly Terrain[]) => boolean,
  isLower: (t: Terrain) => boolean,
): number[][] {
  const h = terrain.length;
  const w = terrain[0]?.length ?? 0;
  const at = (x: number, y: number) =>
    terrain[Math.min(Math.max(y, 0), h - 1)]![Math.min(Math.max(x, 0), w - 1)]!;
  const frames: number[][] = [];
  for (let y = 0; y <= h; y++) {
    const row: number[] = [];
    for (let x = 0; x <= w; x++) {
      const corners = [at(x - 1, y - 1), at(x, y - 1), at(x - 1, y), at(x, y)] as const;
      if (!draw(corners)) {
        row.push(EMPTY_FRAME);
        continue;
      }
      const [nw, ne, sw, se] = corners.map((c) => (isLower(c) ? 0 : 1)) as [number, number, number, number];
      row.push(WANG_FRAME[nw * 8 + ne * 4 + sw * 2 + se]!);
    }
    frames.push(row);
  }
  return frames;
}

export function buildSceneryLayout(map: MapDef): SceneryLayout {
  const tiles = map.tiles;
  const fountains = components(tiles, (t) => t === Tile.Water)
    .filter((cells) => isFountain(tiles, cells))
    .map(boundsOf);
  const terrain = tiles.map((row) => row.map(terrainOf));
  propGround(tiles, terrain);
  for (const r of fountains) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) terrain[y]![x] = 'plaza';
  }

  const base = wangFrames(terrain, () => true, (t) => t === 'cloud');
  // Overlays são opacos: em célula com canto de nuvem apagariam a borda da ilha, então ficam de fora.
  const overlays = OVERLAY_ORDER.map((overlay) => {
    const lower = OVERLAY_LOWER[overlay];
    return {
      terrain: overlay,
      frames: wangFrames(
        terrain,
        (corners) => corners.includes(overlay) && !corners.includes('cloud'),
        (t) => lower.includes(t),
      ),
    };
  });

  const theme = THEMES[map.theme ?? 'meadow'];
  return { terrain, base, overlays, objects: buildObjects(map, theme, fountains) };
}
