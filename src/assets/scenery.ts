// Manifesto de cenário: caminhos dos tilesets Wang e dos objetos do PixelLab (ver docs/assets-cenario.md).
// Trocar/adicionar arte de cenário = mudar as entradas aqui.

/** Terrenos lógicos dos tilesets Wang. `grass` é o "upper" comum a todos (musgo no Bosque). */
export type Terrain = 'cloud' | 'grass' | 'path' | 'plaza' | 'water';
export type OverlayTerrain = 'path' | 'water' | 'plaza';

export interface TilesetDef {
  key: string;
  url: string;
}

/** Base (nuvem x grama) e overlays da Vila/Campos, na ordem de desenho: plaza por último. */
export const BASE_TILESET: TilesetDef = { key: 'tileset:cloud-grass', url: 'assets/tiles/cloud-grass/tileset.png' };
export const OVERLAY_TILESETS: Readonly<Record<OverlayTerrain, TilesetDef>> = {
  path: { key: 'tileset:grass-path', url: 'assets/tiles/grass-path/tileset.png' },
  water: { key: 'tileset:grass-water', url: 'assets/tiles/grass-water/tileset.png' },
  plaza: { key: 'tileset:grass-plaza', url: 'assets/tiles/grass-plaza/tileset.png' },
};
export const OVERLAY_ORDER: readonly OverlayTerrain[] = ['path', 'water', 'plaza'];

/**
 * Frame do tileset (row*4 + col) pelo índice `NW*8 + NE*4 + SW*2 + SE`, com upper(grama)=1, lower=0.
 * Layout idêntico em todos os tilesets (Vila e Bosque).
 */
export const WANG_FRAME: readonly number[] = [6, 7, 10, 9, 2, 11, 4, 15, 5, 14, 1, 8, 3, 0, 13, 12];

export type SceneryObjectKind =
  | 'tree-oak'
  | 'tree-blossom'
  | 'rock'
  | 'rock-b'
  | 'bush-flowers'
  | 'fountain'
  | 'house-red'
  | 'house-orange'
  | 'house-blue'
  | 'bridge-h'
  // Bosque Sussurrante
  | 'tree-forest'
  | 'bamboo'
  | 'bamboo-b'
  | 'rock-moss'
  | 'rock-moss-b'
  | 'flowers-glow'
  | 'mushroom-gold'
  | 'mushroom-red'
  | 'mushroom-teal'
  | 'log-moss'
  | 'lantern-firefly'
  | 'bridge-stream'
  // Vila Brisa viva
  | 'merchant-stall'
  | 'seal-altar'
  | 'return-stone';

/**
 * Conjunto visual do mapa (`MapDef.theme`). Os terrenos lógicos são os mesmos; o tema escolhe os tilesets
 * e os objetos que viram árvore/pedra/flor. `meadow` = Vila/Campos, `forest` = Bosque (musgo, terra, riacho).
 */
export type MapTheme = 'meadow' | 'forest';

export interface ThemeDef {
  base: TilesetDef;
  /** Base com a nuvem transparente (arquivo; se faltar, é gerado no boot a partir de `base`). */
  cutout: TilesetDef;
  /** Overlay ausente = o terreno fica só com a base (grama/musgo). */
  overlays: Partial<Record<OverlayTerrain, TilesetDef>>;
  /** Variações sorteadas por hash da célula para Tile.Tree / Tile.Rock / Tile.Flowers (peso = repetições). */
  trees: readonly SceneryObjectKind[];
  rocks: readonly SceneryObjectKind[];
  flowers: readonly SceneryObjectKind[];
}

export const THEMES: Readonly<Record<MapTheme, ThemeDef>> = {
  meadow: {
    base: BASE_TILESET,
    cutout: { key: 'tileset:cloud-grass-cutout', url: 'assets/tiles/cloud-grass/tileset-cutout.png' },
    overlays: OVERLAY_TILESETS,
    // ~30% cerejeiras, como antes.
    trees: ['tree-blossom', 'tree-oak', 'tree-oak'],
    rocks: ['rock', 'rock-b'],
    flowers: ['bush-flowers'],
  },
  forest: {
    base: { key: 'tileset:cloud-moss', url: 'assets/tiles/cloud-moss/tileset.png' },
    cutout: { key: 'tileset:cloud-moss-cutout', url: 'assets/tiles/cloud-moss/tileset-cutout.png' },
    overlays: {
      path: { key: 'tileset:moss-dirt', url: 'assets/tiles/moss-dirt/tileset.png' },
      water: { key: 'tileset:moss-stream', url: 'assets/tiles/moss-stream/tileset.png' },
    },
    trees: ['tree-forest', 'bamboo', 'bamboo-b', 'tree-forest'],
    rocks: ['rock-moss', 'rock-moss-b'],
    flowers: ['flowers-glow', 'flowers-glow', 'mushroom-gold'],
  },
};

/** Todos os tilesets (base + overlays) de todos os temas, sem repetição — carregados no boot. */
export function allTilesets(): TilesetDef[] {
  const byKey = new Map<string, TilesetDef>();
  for (const theme of Object.values(THEMES)) {
    for (const ts of [theme.base, ...Object.values(theme.overlays)]) byKey.set(ts.key, ts);
  }
  return [...byKey.values()];
}

export interface SceneryObjectDef {
  key: string;
  url: string;
  /** meta.json com origin/pivô (ausente = sprite sheet de tiles, origem no canto). */
  metaUrl?: string;
  /** Sprite sheet de tiles 32x32 (ex.: ponte tileável). */
  frameSize?: number;
}

function objectDef(name: SceneryObjectKind): SceneryObjectDef {
  const base = `assets/objects/${name}`;
  return { key: `obj:${name}`, url: `${base}/object.png`, metaUrl: `${base}/meta.json` };
}

export const SCENERY_OBJECTS: Readonly<Record<SceneryObjectKind, SceneryObjectDef>> = {
  'tree-oak': objectDef('tree-oak'),
  'tree-blossom': objectDef('tree-blossom'),
  rock: objectDef('rock'),
  'rock-b': objectDef('rock-b'),
  'bush-flowers': objectDef('bush-flowers'),
  fountain: objectDef('fountain'),
  'house-red': objectDef('house-red'),
  'house-orange': objectDef('house-orange'),
  'house-blue': objectDef('house-blue'),
  // Frames 0/1/2 = borda norte, deck, borda sul; repete na horizontal.
  'bridge-h': { key: 'obj:bridge-h', url: 'assets/objects/bridge-h/bridge-h.png', frameSize: 32 },
  'tree-forest': objectDef('tree-forest'),
  bamboo: objectDef('bamboo'),
  'bamboo-b': objectDef('bamboo-b'),
  'rock-moss': objectDef('rock-moss'),
  'rock-moss-b': objectDef('rock-moss-b'),
  'flowers-glow': objectDef('flowers-glow'),
  'mushroom-gold': objectDef('mushroom-gold'),
  'mushroom-red': objectDef('mushroom-red'),
  'mushroom-teal': objectDef('mushroom-teal'),
  'log-moss': objectDef('log-moss'),
  'lantern-firefly': objectDef('lantern-firefly'),
  'bridge-stream': objectDef('bridge-stream'),
  'merchant-stall': objectDef('merchant-stall'),
  'seal-altar': objectDef('seal-altar'),
  // Estado inativo; o ativo é RETURN_STONE_ACTIVE (mesmo tamanho e pivô). Desenhada por systems/returnStones.ts.
  'return-stone': objectDef('return-stone'),
};

/** Pedra de Retorno ativada (`meta.states.active`). */
export const RETURN_STONE_ACTIVE: SceneryObjectDef = {
  key: 'obj:return-stone:active',
  url: 'assets/objects/return-stone/object-active.png',
};

/** Decoração pisável: fica atrás de quem está na mesma célula. */
export const WALKABLE_DECOR: ReadonlySet<SceneryObjectKind> = new Set(['bush-flowers', 'flowers-glow', 'mushroom-gold']);

/**
 * Objetos colocados à mão (`MapDef.props`). Colisão (tiles) = `footprintTiles` do meta.json, alinhada pela base
 * e centrada no pivô (testado em scenery.test.ts).
 */
export const PROP_FOOTPRINTS = {
  'log-moss': { w: 3, h: 1 },
  'mushroom-red': { w: 1, h: 1 },
  'mushroom-teal': { w: 1, h: 1 },
  'lantern-firefly': { w: 1, h: 1 },
  'rock-moss': { w: 1, h: 1 },
  'merchant-stall': { w: 3, h: 1 },
  'seal-altar': { w: 2, h: 1 },
  'return-stone': { w: 2, h: 1 },
  'bridge-stream': { w: 2, h: 2 },
} as const satisfies Partial<Record<SceneryObjectKind, { w: number; h: number }>>;

export type PropKind = keyof typeof PROP_FOOTPRINTS;

/** Props de chão: não bloqueiam e ficam no nível da ponte (a água sob a `bridge-stream` vira Tile.Deck). */
export const FLAT_PROPS: ReadonlySet<PropKind> = new Set(['bridge-stream']);

export type HouseKind = 'house-red' | 'house-orange' | 'house-blue';

/**
 * Colisão (tiles) de cada casa = `footprintTiles` do meta.json (testado em scenery.test.ts), alinhada pela
 * base e centrada no pivô. O telhado acima disso fica fora da colisão e cobre quem passa atrás.
 */
export const HOUSE_FOOTPRINTS: Readonly<Record<HouseKind, { w: number; h: number }>> = {
  'house-red': { w: 5, h: 3 },
  'house-orange': { w: 5, h: 3 },
  'house-blue': { w: 4, h: 2 },
};

/** Tiles de telhado acima da colisão (arredondado para cima) — mantidos livres de árvores na geração. */
export const HOUSE_ROOF_OVERHANG = 2;

export const sceneryMetaKey = (kind: SceneryObjectKind) => `${SCENERY_OBJECTS[kind].key}:meta`;
