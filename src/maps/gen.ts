// Utilitários para desenhar mapas provisórios em código.

import { FLAT_PROPS, PROP_FOOTPRINTS, type PropKind } from '../assets/scenery';
import { Tile, type MapProp, type ReturnStonePlacement, type TileRect } from './types';

/** RNG determinístico (mulberry32) — o mapa sai igual a cada carregamento. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGrid(width: number, height: number, fill: Tile): Tile[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

export function fillRect(tiles: Tile[][], rect: TileRect, tile: Tile): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (x >= 0 && x < row.length) row[x] = tile;
    }
  }
}

export function setTile(tiles: Tile[][], x: number, y: number, tile: Tile): void {
  const row = tiles[y];
  if (row && x >= 0 && x < row.length) row[x] = tile;
}

export function getTile(tiles: Tile[][], x: number, y: number): Tile | undefined {
  return tiles[y]?.[x];
}

/**
 * Ilha irregular: tudo fora de uma elipse com borda "ondulada" vira nuvem.
 * `margin` = tiles de nuvem garantidos na borda do mapa.
 */
export function carveIsland(tiles: Tile[][], rng: () => number, ground: Tile, margin = 3): void {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rx = w / 2 - margin;
  const ry = h / 2 - margin;
  // Ondulação suave: soma de senos com fases aleatórias.
  const phases = [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const angle = Math.atan2(dy, dx);
      const wobble =
        0.06 * Math.sin(angle * 3 + phases[0]!) +
        0.04 * Math.sin(angle * 5 + phases[1]!) +
        0.03 * Math.sin(angle * 9 + phases[2]!);
      const dist = Math.hypot(dx, dy);
      setTile(tiles, x, y, dist <= 1 + wobble - 0.08 ? ground : Tile.Cloud);
    }
  }
}

/** Espalha `tile` sobre `onlyOn` com probabilidade `chance`, fora das áreas protegidas. */
export function scatter(
  tiles: Tile[][],
  rng: () => number,
  tile: Tile,
  chance: number,
  onlyOn: Tile,
  keepClear: readonly TileRect[] = [],
): void {
  for (let y = 0; y < tiles.length; y++) {
    const row = tiles[y]!;
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== onlyOn) continue;
      if (keepClear.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) continue;
      if (rng() < chance) row[x] = tile;
    }
  }
}

/**
 * Estrada que sai da ilha por uma ponte sobre as nuvens até a borda `side` do mapa: o que for nuvem em `road`
 * vira Tile.Bridge e o resto vira Tile.Path. A borda da ilha ali sai reta e, no tileset, borda vertical não tem
 * penhasco (só face virada para o sul): recorta degraus acima e abaixo do tabuleiro para a ilha mostrar o penhasco.
 */
export function cloudBridgeRoad(tiles: Tile[][], road: TileRect, side: 'west' | 'east'): void {
  const steps: [number, number][] = [
    [road.y - 2, 1],
    [road.y - 1, 2],
    [road.y + road.h, 2],
    [road.y + road.h + 1, 1],
  ];
  for (const [y, depth] of steps) {
    const row = tiles[y];
    if (!row) continue;
    if (side === 'west') {
      const edge = row.findIndex((t) => t !== Tile.Cloud);
      if (edge >= 0) fillRect(tiles, { x: edge, y, w: depth, h: 1 }, Tile.Cloud);
    } else {
      let edge = row.length - 1;
      while (edge >= 0 && row[edge] === Tile.Cloud) edge--;
      if (edge >= 0) fillRect(tiles, { x: edge - depth + 1, y, w: depth, h: 1 }, Tile.Cloud);
    }
  }
  for (let y = road.y; y < road.y + road.h; y++) {
    for (let x = road.x; x < road.x + road.w; x++) {
      setTile(tiles, x, y, getTile(tiles, x, y) === Tile.Cloud ? Tile.Bridge : Tile.Path);
    }
  }
}

/**
 * Objeto colocado à mão com footprint `PROP_FOOTPRINTS[kind]` a partir do canto (x, y): marca a grade (Tile.Prop,
 * ou Tile.Deck para props de chão como a ponte do riacho) e devolve o `MapProp` para `MapDef.props`.
 */
export function placeProp(tiles: Tile[][], kind: PropKind, x: number, y: number): MapProp {
  const { w, h } = PROP_FOOTPRINTS[kind];
  const rect = { x, y, w, h };
  fillRect(tiles, rect, FLAT_PROPS.has(kind) ? Tile.Deck : Tile.Prop);
  return { kind, rect };
}

/** Pedra de Retorno (2x1, bloqueia) com o canto em (x, y). */
export function placeReturnStone(
  tiles: Tile[][],
  stone: Omit<ReturnStonePlacement, 'rect'> & { x: number; y: number },
): ReturnStonePlacement {
  const { x, y, ...rest } = stone;
  const { w, h } = PROP_FOOTPRINTS['return-stone'];
  const rect = { x, y, w, h };
  fillRect(tiles, rect, Tile.Prop);
  return { ...rest, rect };
}
