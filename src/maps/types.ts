// Formato dos mapas provisórios gerados por código.

import type { MapTheme, PropKind } from '../assets/scenery';
import type { Direction8 } from '../systems/directions';

export enum Tile {
  Cloud = 0,
  Grass = 1,
  Path = 2,
  Water = 3,
  Tree = 4,
  Wall = 5,
  Rock = 6,
  Flowers = 7,
  Bridge = 8,
  Roof = 9,
  Plaza = 10,
  /** Ocupado por um objeto colocado à mão (`MapDef.props`, Pedra de Retorno): bloqueia; chão = vizinhos. */
  Prop = 11,
  /** Ponte sobre água (`bridge-stream`): andável; o chão desenhado continua sendo água. */
  Deck = 12,
}

export const TILE_COUNT = 13;

/** Tiles que bloqueiam movimento. */
export const BLOCKING_TILES: readonly Tile[] = [Tile.Cloud, Tile.Water, Tile.Tree, Tile.Wall, Tile.Rock, Tile.Roof, Tile.Prop];

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapExit {
  /** Área (em tiles) que dispara a troca ao ser pisada. */
  area: TileRect;
  toMap: string;
  toSpawn: string;
}

export interface MonsterSpawnRule {
  monsterId: string;
  count: number;
  /** Área (em tiles) onde os monstros nascem e passeiam. */
  area: TileRect;
  respawnMs: number;
}

/** Objeto de cenário colocado à mão; `rect` = footprint (tiles) já marcado na grade (Prop ou Deck). */
export interface MapProp {
  kind: PropKind;
  rect: TileRect;
}

/** NPC parado num tile; `npcId` = id em src/data/npcs.json. */
export interface NpcPlacement {
  npcId: string;
  x: number;
  y: number;
  facing?: Direction8;
}

/** Pedra de Retorno: footprint 2x1 em `rect` (Tile.Prop); `spawnId` = chegada do teleporte (em `spawns`). */
export interface ReturnStonePlacement {
  /** Id global (único entre todos os mapas) — é o que fica salvo como "ativada". */
  id: string;
  /** Nome na lista de teleporte. */
  name: string;
  rect: TileRect;
  spawnId: string;
  /** Já começa ativada (ex.: a da Vila). */
  startsActive?: boolean;
}

export interface MapDef {
  /** Também é a chave da cena Phaser. */
  id: string;
  /** Nome exibido ao jogador. */
  name: string;
  width: number;
  height: number;
  /** tiles[y][x] */
  tiles: Tile[][];
  /** Pontos de chegada, em tiles. */
  spawns: Record<string, { x: number; y: number }>;
  exits: MapExit[];
  monsterSpawns: MonsterSpawnRule[];
  /** Mapa seguro (sem monstros) — vira o "último ponto seguro" ao entrar. */
  safe: boolean;
  /** Conjunto de tilesets/objetos (padrão `meadow`). */
  theme?: MapTheme;
  props?: MapProp[];
  npcs?: NpcPlacement[];
  returnStones?: ReturnStonePlacement[];
}
