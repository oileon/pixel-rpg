// Ilha-cidade: praça central com fonte, ruas até as portas das casas, mirante ao norte (Santuário), largo ao sul
// e ponte a leste para o campo. Vila Brisa viva: barraca do Mercador na praça, mesa da Seladora ao pé do Santuário,
// Guardiã no mirante e Pedra de Retorno na praça.

import { HOUSE_FOOTPRINTS, HOUSE_ROOF_OVERHANG, type HouseKind } from '../assets/scenery';
import { carveIsland, createGrid, fillRect, getTile, placeProp, placeReturnStone, scatter, seededRng, setTile } from './gen';
import { Tile, type MapDef, type TileRect } from './types';

const W = 44;
const H = 32;

/**
 * Casa com a colisão do sprite (`footprintTiles`): ocupa as linhas logo acima de `baseY` (linha da porta),
 * a partir da coluna `x`. Só a última linha é Wall; o telhado que sobra acima fica andável e cobre o jogador.
 */
function house(tiles: Tile[][], kind: HouseKind, x: number, baseY: number): TileRect {
  const { w, h } = HOUSE_FOOTPRINTS[kind];
  const y = baseY - h;
  fillRect(tiles, { x, y, w, h: h - 1 }, Tile.Roof);
  fillRect(tiles, { x, y: baseY - 1, w, h: 1 }, Tile.Wall);
  // Porta: caminho em frente, centrado (2 tiles em larguras pares — a porta do sprite fica no meio da casa).
  setTile(tiles, x + Math.floor(w / 2), baseY, Tile.Path);
  if (w % 2 === 0) setTile(tiles, x + w / 2 - 1, baseY, Tile.Path);
  // Área livre de árvores/flores: em volta da casa, do telhado visível e da porta.
  const top = y - HOUSE_ROOF_OVERHANG;
  return { x: x - 1, y: top - 1, w: w + 2, h: baseY - top + 3 };
}

function build(): MapDef {
  const rng = seededRng(1337);
  const tiles = createGrid(W, H, Tile.Cloud);
  carveIsland(tiles, rng, Tile.Grass, 3);

  const plaza: TileRect = { x: 16, y: 12, w: 12, h: 8 };
  fillRect(tiles, plaza, Tile.Plaza);
  // Fonte no centro da praça.
  fillRect(tiles, { x: 21, y: 15, w: 2, h: 2 }, Tile.Water);

  // Caminhos: praça -> leste (ponte), praça -> norte e sul.
  const eastRoad: TileRect = { x: plaza.x + plaza.w, y: 14, w: W - (plaza.x + plaza.w), h: 3 };
  for (let y = eastRoad.y; y < eastRoad.y + eastRoad.h; y++) {
    for (let x = eastRoad.x; x < W; x++) {
      setTile(tiles, x, y, getTile(tiles, x, y) === Tile.Cloud ? Tile.Bridge : Tile.Path);
    }
  }
  // Mirante na borda norte (1 tile de grama até a nuvem: overlay não desenha em canto de nuvem) e largo
  // ao sul; as duas trilhas da praça terminam neles.
  const lookout: TileRect = { x: 19, y: 5, w: 6, h: 2 };
  const southSquare: TileRect = { x: 19, y: 24, w: 6, h: 2 };
  const northRoad: TileRect = { x: 21, y: lookout.y + lookout.h, w: 2, h: plaza.y - (lookout.y + lookout.h) };
  const southRoad: TileRect = { x: 21, y: plaza.y + plaza.h, w: 2, h: southSquare.y - (plaza.y + plaza.h) };
  fillRect(tiles, lookout, Tile.Plaza);
  fillRect(tiles, southSquare, Tile.Plaza);
  fillRect(tiles, northRoad, Tile.Path);
  fillRect(tiles, southRoad, Tile.Path);

  const houses = [
    house(tiles, 'house-red', 13, 10),
    house(tiles, 'house-blue', 26, 10),
    house(tiles, 'house-blue', 12, 24),
    house(tiles, 'house-orange', 26, 24),
  ];
  // Ruas ligando as portas às trilhas norte/sul (linha da porta).
  const streets: TileRect[] = [
    { x: 16, y: 10, w: 5, h: 1 },
    { x: 23, y: 10, w: 4, h: 1 },
    { x: 15, y: 24, w: 4, h: 1 },
    { x: 25, y: 24, w: 3, h: 1 },
  ];
  for (const street of streets) fillRect(tiles, street, Tile.Path);
  // Barraca na metade oeste da praça (Mercador na frente do balcão) e mesa da Seladora ao pé do mirante.
  const props = [placeProp(tiles, 'merchant-stall', 17, 13), placeProp(tiles, 'seal-altar', 19, 7)];
  const stone = placeReturnStone(tiles, {
    id: 'town',
    name: 'Vila Brisa',
    x: 25,
    y: 18,
    spawnId: 'returnStone',
    startsActive: true,
  });

  // Canteiros nos cantos do mirante e do largo.
  for (const [x, y] of [[18, 5], [25, 5], [18, 25], [25, 25]] as const) setTile(tiles, x, y, Tile.Flowers);

  const around = (r: TileRect): TileRect => ({ x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 });
  const keepClear: TileRect[] = [
    around(plaza),
    { ...eastRoad, y: eastRoad.y - 1, h: eastRoad.h + 2 },
    around(lookout),
    around(southSquare),
    northRoad,
    southRoad,
    ...streets.map(around),
    ...houses,
    ...props.map((p) => around(p.rect)),
  ];

  scatter(tiles, rng, Tile.Flowers, 0.08, Tile.Grass, keepClear);
  scatter(tiles, rng, Tile.Tree, 0.05, Tile.Grass, keepClear);

  return {
    id: 'town',
    name: 'Vila Brisa',
    width: W,
    height: H,
    tiles,
    spawns: {
      start: { x: 19, y: 17 },
      fromField: { x: 36, y: 15 },
      returnStone: { x: 25, y: 19 },
    },
    exits: [{ area: { x: W - 2, y: 14, w: 2, h: 3 }, toMap: 'field', toSpawn: 'fromTown' }],
    monsterSpawns: [],
    safe: true,
    props,
    npcs: [
      { npcId: 'mercador', x: 18, y: 14, facing: 'south' },
      // Atrás da mesa, no mirante.
      { npcId: 'seladora', x: 19, y: 6, facing: 'south' },
      { npcId: 'guardia', x: 22, y: 5, facing: 'south' },
    ],
    returnStones: [stone],
  };
}

export const TOWN_MAP = build();
