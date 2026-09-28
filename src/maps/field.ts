// Campo: ilha maior com árvores, pedras, lago e monstros; ponte a oeste para a cidade e a leste para o Bosque.
// A estrada atravessa uma clareira com um círculo de pedras e flores; Pedra de Retorno perto da entrada oeste.

import { carveIsland, cloudBridgeRoad, createGrid, fillRect, placeReturnStone, scatter, seededRng, setTile } from './gen';
import { Tile, type MapDef, type TileRect } from './types';

const W = 64;
const H = 48;

function build(): MapDef {
  const rng = seededRng(4242);
  const tiles = createGrid(W, H, Tile.Cloud);
  carveIsland(tiles, rng, Tile.Grass, 3);

  // Estrada de terra vinda da ponte (oeste) até a clareira, e da clareira até a ponte leste (Bosque).
  const road: TileRect = { x: 0, y: 22, w: 30, h: 3 };
  const eastRoad: TileRect = { x: 33, y: 22, w: W - 33, h: 3 };
  cloudBridgeRoad(tiles, road, 'west');
  cloudBridgeRoad(tiles, eastRoad, 'east');

  // Lago.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (((x - 44) / 5) ** 2 + ((y - 33) / 3.5) ** 2 <= 1) setTile(tiles, x, y, Tile.Water);
    }
  }

  const clearing: TileRect = { x: 26, y: 18, w: 11, h: 11 };
  const keepClear: TileRect[] = [
    { ...road, y: road.y - 1, h: road.h + 2 },
    { ...eastRoad, y: eastRoad.y - 1, h: eastRoad.h + 2 },
    { x: 4, y: 18, w: 8, h: 10 },
  ];
  scatter(tiles, rng, Tile.Flowers, 0.05, Tile.Grass, keepClear);
  scatter(tiles, rng, Tile.Tree, 0.06, Tile.Grass, keepClear);
  scatter(tiles, rng, Tile.Rock, 0.02, Tile.Grass, keepClear);
  // Clareira no fim da estrada: círculo de pedras (aberto a oeste, onde a estrada chega) com flores no meio.
  fillRect(tiles, clearing, Tile.Grass);
  fillRect(tiles, { x: 26, y: 22, w: 4, h: 3 }, Tile.Path);
  fillRect(tiles, { x: 33, y: 22, w: 4, h: 3 }, Tile.Path);
  const cx = clearing.x + clearing.w / 2;
  const cy = clearing.y + clearing.h / 2;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    // Aberturas de ~90° viradas para a estrada (oeste e leste).
    if (Math.abs(Math.cos(angle)) > 0.7) continue;
    setTile(tiles, Math.floor(cx + Math.cos(angle) * 4), Math.floor(cy + Math.sin(angle) * 4), Tile.Rock);
  }
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1]] as const) {
    setTile(tiles, Math.floor(cx) + dx, Math.floor(cy) + dy, Tile.Flowers);
  }

  // Pedra de Retorno ao lado da chegada da Vila (na clareira da entrada, fora da estrada).
  const stone = placeReturnStone(tiles, { id: 'field', name: 'Campos de Pêssego', x: 7, y: 19, spawnId: 'returnStone' });

  return {
    id: 'field',
    name: 'Campos de Pêssego',
    width: W,
    height: H,
    tiles,
    spawns: {
      fromTown: { x: 8, y: 23 },
      fromForest: { x: 54, y: 23 },
      returnStone: { x: 8, y: 20 },
    },
    exits: [
      { area: { x: 0, y: 22, w: 2, h: 3 }, toMap: 'town', toSpawn: 'fromField' },
      { area: { x: W - 2, y: 22, w: 2, h: 3 }, toMap: 'forest', toSpawn: 'fromField' },
    ],
    monsterSpawns: [
      { monsterId: 'pomi', count: 8, area: { x: 14, y: 12, w: 24, h: 24 }, respawnMs: 8000 },
      { monsterId: 'plumito', count: 4, area: { x: 38, y: 8, w: 16, h: 12 }, respawnMs: 12000 },
      // Cascudos (agressivos) em tocas separadas por bem mais que 2x o alcance de aggro: puxa um por vez.
      { monsterId: 'cascudo', count: 1, area: { x: 13, y: 32, w: 5, h: 4 }, respawnMs: 20000 },
      { monsterId: 'cascudo', count: 1, area: { x: 28, y: 39, w: 5, h: 3 }, respawnMs: 20000 },
      // Fora da estrada do Bosque (a toca antiga, em 49,24, ficava em cima dela).
      { monsterId: 'cascudo', count: 1, area: { x: 44, y: 12, w: 5, h: 4 }, respawnMs: 20000 },
    ],
    safe: false,
    returnStones: [stone],
  };
}

export const FIELD_MAP = build();
