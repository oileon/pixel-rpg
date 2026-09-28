// Bosque Sussurrante (nível 6–12): ilha grande de musgo, bambu e cogumelos. Ponte a oeste para os Campos de Pêssego.
// Um riacho corta a ilha de leste a oeste; duas pontes (`bridge-stream`) levam ao norte, onde ficam a clareira das
// vespas e, no fundo (nordeste), a clareira do chefe. Ao sul da trilha principal: clareira dos cogumelos (perto da
// entrada) e o lago das tartarugas.

import { carveIsland, cloudBridgeRoad, createGrid, fillRect, placeProp, placeReturnStone, scatter, seededRng, setTile } from './gen';
import { Tile, type MapDef, type MapProp, type TileRect } from './types';

const W = 90;
const H = 64;

/** Linha de cima do riacho (2 tiles de altura) em cada coluna. */
const STREAM_Y = 26;
/** Colunas (x da esquerda) das duas pontes; o riacho fica reto em volta delas. */
const BRIDGES = [30, 62] as const;

function streamTop(x: number): number {
  if (BRIDGES.some((bx) => x >= bx - 2 && x <= bx + 3)) return STREAM_Y;
  return STREAM_Y + Math.round(Math.sin(x / 5.5) * 1.2);
}

function build(): MapDef {
  const rng = seededRng(7117);
  const tiles = createGrid(W, H, Tile.Cloud);
  carveIsland(tiles, rng, Tile.Grass, 3);

  // Entrada (ponte vinda dos Campos) e trilha principal leste-oeste.
  const entrance: TileRect = { x: 0, y: 39, w: 16, h: 3 };
  cloudBridgeRoad(tiles, entrance, 'west');
  const mainTrail: TileRect = { x: 16, y: 40, w: 57, h: 2 };

  // Riacho de borda a borda: só dá para ir ao norte pelas pontes.
  for (let x = 0; x < W; x++) {
    const top = streamTop(x);
    for (let y = top; y < top + 2; y++) if (tiles[y]?.[x] !== Tile.Cloud) setTile(tiles, x, y, Tile.Water);
  }

  // Clareiras (livres de árvores; as áreas de spawn ficam dentro delas).
  const mushroomGlade: TileRect = { x: 18, y: 33, w: 14, h: 15 };
  const waspGlade: TileRect = { x: 19, y: 12, w: 24, h: 11 };
  const turtlePond: TileRect = { x: 39, y: 44, w: 22, h: 10 };
  const eastGlade: TileRect = { x: 64, y: 42, w: 9, h: 7 };
  const bossGlade: TileRect = { x: 58, y: 12, w: 15, h: 11 };

  // Trilhas: bifurcações para as pontes, a clareira das vespas liga à do chefe pelo norte (anel).
  const trails: TileRect[] = [
    mainTrail,
    // Ponte oeste: da trilha principal até o meio da clareira das vespas.
    { x: BRIDGES[0], y: 16, w: 2, h: 24 },
    // Ponte leste: da trilha principal até a clareira do chefe.
    { x: BRIDGES[1], y: 18, w: 2, h: 22 },
    // Norte: vespas -> chefe.
    { x: 32, y: 17, w: 30, h: 2 },
    // Sul: trilha principal -> lago.
    { x: 44, y: 42, w: 2, h: 5 },
  ];
  for (const t of trails) {
    for (let y = t.y; y < t.y + t.h; y++) {
      for (let x = t.x; x < t.x + t.w; x++) {
        const tile = tiles[y]?.[x];
        if (tile !== undefined && tile !== Tile.Water && tile !== Tile.Cloud) setTile(tiles, x, y, Tile.Path);
      }
    }
  }

  // Lago das tartarugas (Musgolento).
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (((x - 53) / 4.5) ** 2 + ((y - 49) / 2.2) ** 2 <= 1) setTile(tiles, x, y, Tile.Water);
    }
  }

  const props: MapProp[] = [];
  // Pontes sobre o riacho (o chão sob elas vira Tile.Deck, andável).
  for (const bx of BRIDGES) props.push(placeProp(tiles, 'bridge-stream', bx, STREAM_Y));

  const around = (r: TileRect, pad = 1): TileRect => ({ x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 });
  const keepClear: TileRect[] = [
    around(entrance),
    ...trails.map((t) => around(t)),
    mushroomGlade,
    waspGlade,
    turtlePond,
    eastGlade,
    bossGlade,
  ];
  scatter(tiles, rng, Tile.Tree, 0.14, Tile.Grass, keepClear);
  scatter(tiles, rng, Tile.Flowers, 0.05, Tile.Grass, keepClear);
  scatter(tiles, rng, Tile.Rock, 0.025, Tile.Grass, keepClear);
  // Um pouco de decoração pisável nas clareiras.
  scatter(tiles, rng, Tile.Flowers, 0.03, Tile.Grass, [around(entrance), ...trails.map((t) => around(t))]);

  // Objetos à mão: lanternas nas bifurcações, troncos e cogumelos gigantes nas clareiras.
  const decor: [MapProp['kind'], number, number][] = [
    ['lantern-firefly', 16, 38],
    ['lantern-firefly', 29, 38],
    ['lantern-firefly', 32, 29],
    ['lantern-firefly', 61, 38],
    ['lantern-firefly', 64, 29],
    ['lantern-firefly', 46, 43],
    ['lantern-firefly', 57, 16],
    ['lantern-firefly', 73, 16],
    ['log-moss', 21, 45],
    ['log-moss', 24, 13],
    ['log-moss', 67, 21],
    ['mushroom-red', 19, 34],
    ['mushroom-teal', 30, 46],
    ['mushroom-red', 27, 36],
    ['mushroom-teal', 41, 14],
    ['mushroom-red', 20, 20],
    ['mushroom-teal', 59, 13],
    ['mushroom-red', 68, 14],
    ['mushroom-teal', 59, 21],
    ['mushroom-red', 40, 52],
    ['mushroom-teal', 60, 46],
    ['rock-moss', 72, 44],
    ['rock-moss', 43, 21],
  ];
  for (const [kind, x, y] of decor) props.push(placeProp(tiles, kind, x, y));

  const stone = placeReturnStone(tiles, { id: 'forest', name: 'Bosque Sussurrante', x: 13, y: 36, spawnId: 'returnStone' });

  return {
    id: 'forest',
    name: 'Bosque Sussurrante',
    width: W,
    height: H,
    tiles,
    theme: 'forest',
    spawns: {
      fromField: { x: 12, y: 40 },
      returnStone: { x: 14, y: 37 },
    },
    exits: [{ area: { x: 0, y: 39, w: 2, h: 3 }, toMap: 'field', toSpawn: 'fromForest' }],
    // Ids ainda sem definição em monsters.json são ignorados pelo spawner (aviso no console) até o gameplay criá-los.
    monsterSpawns: [
      { monsterId: 'cogumelim', count: 8, area: { x: 19, y: 34, w: 12, h: 13 }, respawnMs: 9000 },
      { monsterId: 'musgolento', count: 6, area: { x: 40, y: 45, w: 20, h: 8 }, respawnMs: 12000 },
      // Zunzum (agressivo): tocas de 1, bem separadas entre si e do chefe (puxa um por vez).
      { monsterId: 'zunzum', count: 1, area: { x: 20, y: 16, w: 4, h: 3 }, respawnMs: 15000 },
      { monsterId: 'zunzum', count: 1, area: { x: 36, y: 12, w: 4, h: 3 }, respawnMs: 15000 },
      { monsterId: 'zunzum', count: 1, area: { x: 66, y: 44, w: 4, h: 3 }, respawnMs: 15000 },
      // Chefe de campo no fundo do bosque; reaparece a cada ~10 min.
      { monsterId: 'tronco_rei', count: 1, area: { x: 62, y: 14, w: 7, h: 5 }, respawnMs: 600000 },
    ],
    safe: false,
    props,
    returnStones: [stone],
  };
}

export const FOREST_MAP = build();
