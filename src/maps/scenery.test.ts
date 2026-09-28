import { describe, expect, it } from 'vitest';
import {
  FLAT_PROPS,
  HOUSE_FOOTPRINTS,
  HOUSE_ROOF_OVERHANG,
  PROP_FOOTPRINTS,
  SCENERY_OBJECTS,
  THEMES,
  WANG_FRAME,
  type HouseKind,
  type PropKind,
} from '../assets/scenery';
import { TILE_SIZE } from '../config';
import { FIELD_MAP } from './field';
import { FOREST_MAP } from './forest';
import { BRIDGE_OVERHANG_TILES, buildSceneryLayout, EMPTY_FRAME } from './scenery';
import blueMeta from '../../public/assets/objects/house-blue/meta.json';
import orangeMeta from '../../public/assets/objects/house-orange/meta.json';
import redMeta from '../../public/assets/objects/house-red/meta.json';
import { findPath, type WalkGrid } from '../systems/pathfinding';
import { TOWN_MAP } from './town';
import { BLOCKING_TILES, Tile } from './types';

const blocked = new Set(BLOCKING_TILES);
const townGrid: WalkGrid = {
  width: TOWN_MAP.width,
  height: TOWN_MAP.height,
  isBlocked: (x, y) => {
    const t = TOWN_MAP.tiles[y]?.[x];
    return t === undefined || blocked.has(t);
  },
};

function reachable(to: { x: number; y: number }): boolean {
  const path = findPath(townGrid, TOWN_MAP.spawns.start!, to, 20000);
  const last = path?.[path.length - 1];
  return last?.x === to.x && last?.y === to.y;
}

describe('HOUSE_FOOTPRINTS', () => {
  it.each(Object.keys(HOUSE_FOOTPRINTS) as HouseKind[])('%s bate com footprintTiles do meta.json', (kind) => {
    const metas = { 'house-red': redMeta, 'house-orange': orangeMeta, 'house-blue': blueMeta };
    expect(HOUSE_FOOTPRINTS[kind]).toEqual(metas[kind].footprintTiles);
  });
});

interface ObjectMeta {
  footprintTiles: { w: number; h: number };
  blocking: boolean;
}
const OBJECT_METAS = import.meta.glob<ObjectMeta>('../../public/assets/objects/*/meta.json', { eager: true, import: 'default' });
/** Arquivos existentes em public/assets (só os nomes; nada é carregado). */
const ASSET_FILES = new Set(
  Object.keys(import.meta.glob('../../public/assets/**/*.{png,json}')).map((k) => k.replace('../../public/', '')),
);

function readMeta(kind: string): ObjectMeta {
  const meta = OBJECT_METAS[`../../public/assets/objects/${kind}/meta.json`];
  if (!meta) throw new Error(`meta.json ausente: ${kind}`);
  return meta;
}

describe('PROP_FOOTPRINTS', () => {
  it.each(Object.keys(PROP_FOOTPRINTS) as PropKind[])('%s bate com footprintTiles/blocking do meta.json', (kind) => {
    const meta = readMeta(kind);
    expect(PROP_FOOTPRINTS[kind]).toEqual(meta.footprintTiles);
    expect(FLAT_PROPS.has(kind)).toBe(!meta.blocking);
  });
});

describe('manifesto de cenário', () => {
  it('todo objeto e tileset aponta para um arquivo existente', () => {
    const urls = [
      ...Object.values(SCENERY_OBJECTS).flatMap((d) => [d.url, ...(d.metaUrl ? [d.metaUrl] : [])]),
      ...Object.values(THEMES).flatMap((t) => [t.base.url, t.cutout.url, ...Object.values(t.overlays).map((o) => o.url)]),
    ];
    expect(ASSET_FILES.has('assets/objects/tree-oak/object.png')).toBe(true);
    for (const url of urls) expect(ASSET_FILES.has(url), url).toBe(true);
  });
});

describe('WANG_FRAME', () => {
  it('é uma permutação dos 16 frames', () => {
    expect([...WANG_FRAME].sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
  });
});

describe('cenário da cidade', () => {
  const layout = buildSceneryLayout(TOWN_MAP);
  const kinds = (k: string) => layout.objects.filter((o) => o.kind === k);

  const houses = layout.objects.filter((o) => o.kind.startsWith('house-'));

  it('agrupa os tiles de cada casa em um único objeto do tamanho do footprint', () => {
    expect(houses).toHaveLength(4);
    expect(kinds('house-blue')).toHaveLength(2);
    expect(kinds('house-red')).toHaveLength(1);
    expect(kinds('house-orange')).toHaveLength(1);
    for (const h of houses) {
      expect({ w: h.rect.w, h: h.rect.h }).toEqual(HOUSE_FOOTPRINTS[h.kind as HouseKind]);
      // Pivô na base centrada da colisão.
      expect(h.x).toBe((h.rect.x + h.rect.w / 2) * TILE_SIZE);
      expect(h.y).toBe((h.rect.y + h.rect.h) * TILE_SIZE);
    }
  });

  it('mantém a porta acessível e a parede frontal bloqueada', () => {
    for (const h of houses) {
      const base = h.rect.y + h.rect.h;
      const doorX = Math.floor(h.x / TILE_SIZE - 0.01);
      expect(TOWN_MAP.tiles[base]?.[doorX]).toBe(Tile.Path);
      expect(reachable({ x: doorX, y: base })).toBe(true);
      for (let x = h.rect.x; x < h.rect.x + h.rect.w; x++) {
        expect(TOWN_MAP.tiles[base - 1]?.[x]).toBe(Tile.Wall);
        for (let y = h.rect.y; y < base; y++) expect(townGrid.isBlocked(x, y)).toBe(true);
      }
    }
  });

  it('deixa andável (e sem árvore/pedra) a faixa atrás do telhado', () => {
    const solidObjects = layout.objects.filter((o) => ['tree-oak', 'tree-blossom', 'rock', 'rock-b'].includes(o.kind));
    for (const h of houses) {
      const behindY = h.rect.y - 1;
      const cx = h.rect.x + Math.floor(h.rect.w / 2);
      expect(townGrid.isBlocked(cx, behindY)).toBe(false);
      expect(reachable({ x: cx, y: behindY })).toBe(true);
      // Quem está atrás tem os pés acima do pivô → fica atrás do sprite (depth = y).
      expect((behindY + 1) * TILE_SIZE).toBeLessThanOrEqual(h.y);
      for (const o of solidObjects) {
        const inRoof =
          o.rect.x >= h.rect.x - 1 && o.rect.x <= h.rect.x + h.rect.w && o.rect.y >= h.rect.y - HOUSE_ROOF_OVERHANG && o.rect.y < h.rect.y;
        expect(inRoof, `${o.kind} em (${o.rect.x},${o.rect.y})`).toBe(false);
      }
    }
  });

  it('transforma a água da praça em fonte sobre praça', () => {
    const [fountain] = kinds('fountain');
    expect(fountain?.rect).toEqual({ x: 21, y: 15, w: 2, h: 2 });
    expect({ x: fountain?.x, y: fountain?.y }).toEqual({ x: 22 * TILE_SIZE, y: 17 * TILE_SIZE });
    expect(layout.terrain[15]?.[21]).toBe('plaza');
    expect(layout.overlays.find((o) => o.terrain === 'water')!.frames.flat().every((f) => f === EMPTY_FRAME)).toBe(true);
  });

  it('cobre toda a ponte com bridge-h', () => {
    const bridgeCells = TOWN_MAP.tiles.flat().filter((t) => t === Tile.Bridge).length;
    expect(kinds('bridge-h').length).toBeGreaterThan(bridgeCells);
  });

  it('a ponte que chega na borda do mapa continua além dela', () => {
    const maxX = Math.max(...kinds('bridge-h').map((o) => o.rect.x));
    expect(maxX).toBe(TOWN_MAP.width - 1 + BRIDGE_OVERHANG_TILES);
  });
});

describe('cenário do Bosque', () => {
  const layout = buildSceneryLayout(FOREST_MAP);
  const forestKinds = new Set<string>([...THEMES.forest.trees, ...THEMES.forest.rocks, ...THEMES.forest.flowers]);

  it('usa os objetos do tema do bosque (nada de carvalho/cerejeira)', () => {
    const kinds = new Set(layout.objects.map((o) => o.kind));
    for (const k of ['tree-oak', 'tree-blossom', 'rock', 'rock-b', 'bush-flowers']) expect(kinds.has(k as never), k).toBe(false);
    expect([...kinds].some((k) => forestKinds.has(k))).toBe(true);
  });

  it('pontes do riacho ficam no chão, sobre água andável', () => {
    const bridges = layout.objects.filter((o) => o.kind === 'bridge-stream');
    expect(bridges).toHaveLength(2);
    for (const b of bridges) {
      expect(b.flat).toBe(true);
      for (let y = b.rect.y; y < b.rect.y + b.rect.h; y++) {
        for (let x = b.rect.x; x < b.rect.x + b.rect.w; x++) {
          expect(FOREST_MAP.tiles[y]?.[x]).toBe(Tile.Deck);
          expect(layout.terrain[y]?.[x]).toBe('water');
        }
      }
      // Trilha dos dois lados (norte e sul) da ponte.
      for (let x = b.rect.x; x < b.rect.x + b.rect.w; x++) {
        expect(FOREST_MAP.tiles[b.rect.y - 1]?.[x]).toBe(Tile.Path);
        expect(FOREST_MAP.tiles[b.rect.y + b.rect.h]?.[x]).toBe(Tile.Path);
      }
    }
  });
});

describe('Vila Brisa viva', () => {
  const layout = buildSceneryLayout(TOWN_MAP);

  it('barraca e mesa viram objetos, com o chão dos vizinhos por baixo', () => {
    const stall = layout.objects.find((o) => o.kind === 'merchant-stall')!;
    expect(stall).toBeDefined();
    expect(layout.terrain[stall.rect.y]?.[stall.rect.x + 1]).toBe('plaza');
    expect(layout.objects.filter((o) => o.kind === 'seal-altar')).toHaveLength(1);
  });

  it('a Pedra de Retorno não é desenhada pelo cenário (é interativa)', () => {
    expect(layout.objects.some((o) => o.kind === 'return-stone')).toBe(false);
  });
});

describe.each([TOWN_MAP, FIELD_MAP, FOREST_MAP])('dual grid $id', (map) => {
  const layout = buildSceneryLayout(map);

  it('tem (W+1)x(H+1) células', () => {
    for (const frames of [layout.base, ...layout.overlays.map((o) => o.frames)]) {
      expect(frames).toHaveLength(map.height + 1);
      for (const row of frames) expect(row).toHaveLength(map.width + 1);
    }
  });

  it('não desenha overlay em células com canto de nuvem', () => {
    const t = layout.terrain;
    const at = (x: number, y: number) => t[Math.min(Math.max(y, 0), map.height - 1)]![Math.min(Math.max(x, 0), map.width - 1)]!;
    for (const o of layout.overlays) {
      o.frames.forEach((row, y) =>
        row.forEach((f, x) => {
          if (f === EMPTY_FRAME) return;
          const corners = [at(x - 1, y - 1), at(x, y - 1), at(x - 1, y), at(x, y)];
          expect(corners).not.toContain('cloud');
        }),
      );
    }
  });
});
