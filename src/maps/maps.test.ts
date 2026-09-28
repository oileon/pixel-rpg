import { describe, expect, it } from 'vitest';
import { MONSTERS } from '../data';
import { TILE_SIZE } from '../config';
import { findPath, type WalkGrid } from '../systems/pathfinding';
import { findNpc } from '../data/npcs';
import { FIELD_MAP } from './field';
import { FOREST_MAP } from './forest';
import { TOWN_MAP } from './town';
import { BLOCKING_TILES, Tile, type MapDef } from './types';

function walkGrid(map: MapDef): WalkGrid {
  const blocked = new Set(BLOCKING_TILES);
  return {
    width: map.width,
    height: map.height,
    isBlocked: (x, y) => {
      const t = map.tiles[y]?.[x];
      return t === undefined || blocked.has(t);
    },
  };
}

const maps = [TOWN_MAP, FIELD_MAP, FOREST_MAP];
const byId = new Map(maps.map((m) => [m.id, m]));

describe.each(maps)('mapa $id', (map) => {
  const grid = walkGrid(map);

  it('tem dimensões consistentes', () => {
    expect(map.tiles).toHaveLength(map.height);
    for (const row of map.tiles) expect(row).toHaveLength(map.width);
  });

  it('spawns ficam em tiles livres', () => {
    for (const [id, s] of Object.entries(map.spawns)) {
      expect(grid.isBlocked(s.x, s.y), `spawn ${id}`).toBe(false);
    }
  });

  it('toda saída é alcançável de todo spawn e leva a um spawn existente', () => {
    for (const exit of map.exits) {
      const target = byId.get(exit.toMap);
      expect(target, `mapa ${exit.toMap}`).toBeDefined();
      expect(target!.spawns[exit.toSpawn], `spawn ${exit.toSpawn}`).toBeDefined();
      const goal = { x: exit.area.x, y: exit.area.y + Math.floor(exit.area.h / 2) };
      expect(grid.isBlocked(goal.x, goal.y)).toBe(false);
      for (const s of Object.values(map.spawns)) {
        const path = findPath(grid, s, goal, 20000);
        expect(path?.[path.length - 1]).toEqual(goal);
      }
    }
  });

  it('NPCs ficam em tiles livres, alcançáveis, e existem em npcs.json', () => {
    const from = Object.values(map.spawns)[0]!;
    for (const n of map.npcs ?? []) {
      expect(findNpc(n.npcId), n.npcId).toBeDefined();
      expect(grid.isBlocked(n.x, n.y), n.npcId).toBe(false);
      expect(findPath(grid, from, n, 20000)?.at(-1), n.npcId).toEqual({ x: n.x, y: n.y });
    }
  });

  it('Pedras de Retorno bloqueiam o footprint e têm chegada livre ao lado', () => {
    for (const stone of map.returnStones ?? []) {
      const { x, y, w, h } = stone.rect;
      for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) expect(map.tiles[ty]?.[tx]).toBe(Tile.Prop);
      const spawn = map.spawns[stone.spawnId];
      expect(spawn, stone.spawnId).toBeDefined();
      // Chegada encostada na pedra (dentro do alcance de uso).
      const dx = Math.max(0, x - spawn!.x, spawn!.x - (x + w - 1));
      const dy = Math.max(0, y - spawn!.y, spawn!.y - (y + h - 1));
      expect(Math.max(dx, dy)).toBe(1);
    }
  });

  it('props marcam o footprint na grade', () => {
    for (const prop of map.props ?? []) {
      const { x, y, w, h } = prop.rect;
      const expected = prop.kind === 'bridge-stream' ? Tile.Deck : Tile.Prop;
      for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) expect(map.tiles[ty]?.[tx], prop.kind).toBe(expected);
    }
  });

  it('spawn de chegada não fica dentro de uma saída', () => {
    for (const s of Object.values(map.spawns)) {
      for (const e of map.exits) {
        const inside = s.x >= e.area.x && s.x < e.area.x + e.area.w && s.y >= e.area.y && s.y < e.area.y + e.area.h;
        expect(inside).toBe(false);
      }
    }
  });
});

describe.each(maps)('spawns de monstros em $id', (map) => {
  it('tocas de monstros agressivos ficam longe o bastante para puxar um por vez', () => {
    const rules = map.monsterSpawns.filter((r) => MONSTERS.find((m) => m.id === r.monsterId)?.behavior === 'aggressive');
    for (const r of rules) {
      const def = MONSTERS.find((m) => m.id === r.monsterId)!;
      expect(r.count, r.monsterId).toBe(1);
      for (const o of rules) {
        if (o === r) continue;
        // Menor distância entre as áreas (tiles) > 2x o aggro: o jogador não entra no alcance de dois ao mesmo tempo.
        const gapX = Math.max(0, o.area.x - (r.area.x + r.area.w), r.area.x - (o.area.x + o.area.w));
        const gapY = Math.max(0, o.area.y - (r.area.y + r.area.h), r.area.y - (o.area.y + o.area.h));
        expect(Math.hypot(gapX, gapY) * TILE_SIZE).toBeGreaterThan(2 * def.aggroRange);
      }
    }
  });
});

describe('ligações entre mapas', () => {
  it('toda saída tem a volta: o mapa de destino tem uma saída de volta', () => {
    for (const map of maps) {
      for (const exit of map.exits) {
        expect(byId.get(exit.toMap)!.exits.some((e) => e.toMap === map.id), `${map.id} -> ${exit.toMap}`).toBe(true);
      }
    }
  });

  it('ids das Pedras de Retorno são únicos e há exatamente uma ativa desde o início (Vila)', () => {
    const stones = maps.flatMap((m) => m.returnStones ?? []);
    expect(new Set(stones.map((s) => s.id)).size).toBe(stones.length);
    expect(stones.filter((s) => s.startsActive).map((s) => s.id)).toEqual(['town']);
    for (const m of [TOWN_MAP, FIELD_MAP, FOREST_MAP]) expect(m.returnStones?.length, m.id).toBe(1);
  });
});

describe('Bosque Sussurrante', () => {
  const grid = walkGrid(FOREST_MAP);
  const entry = FOREST_MAP.spawns.fromField!;
  const reach = (to: { x: number; y: number }, g: WalkGrid = grid) => {
    const path = findPath(g, entry, to, 50000);
    return path?.at(-1)?.x === to.x && path?.at(-1)?.y === to.y;
  };
  const center = (r: { x: number; y: number; w: number; h: number }) => ({
    x: r.x + Math.floor(r.w / 2),
    y: r.y + Math.floor(r.h / 2),
  });

  it('é maior que os Campos de Pêssego', () => {
    expect(FOREST_MAP.width * FOREST_MAP.height).toBeGreaterThan(FIELD_MAP.width * FIELD_MAP.height);
  });

  it('tem 3 espécies nas clareiras e um chefe', () => {
    const ids = new Set(FOREST_MAP.monsterSpawns.map((r) => r.monsterId));
    expect(ids).toEqual(new Set(['cogumelim', 'zunzum', 'musgolento', 'tronco_rei']));
    const boss = FOREST_MAP.monsterSpawns.filter((r) => r.monsterId === 'tronco_rei');
    expect(boss).toHaveLength(1);
    expect(boss[0]!.count).toBe(1);
  });

  it('toda área de spawn tem chão livre e é alcançável da entrada', () => {
    for (const rule of FOREST_MAP.monsterSpawns) {
      const cells: { x: number; y: number }[] = [];
      for (let y = rule.area.y; y < rule.area.y + rule.area.h; y++) {
        for (let x = rule.area.x; x < rule.area.x + rule.area.w; x++) if (!grid.isBlocked(x, y)) cells.push({ x, y });
      }
      // Pelo menos metade da área livre (o spawner sorteia pontos livres dentro dela).
      expect(cells.length, rule.monsterId).toBeGreaterThanOrEqual((rule.area.w * rule.area.h) / 2);
      expect(reach(cells[Math.floor(cells.length / 2)]!), rule.monsterId).toBe(true);
    }
  });

  it('o riacho só se atravessa pelas pontes', () => {
    const deck = (x: number, y: number) => FOREST_MAP.tiles[y]?.[x] === Tile.Deck;
    const noBridges: WalkGrid = { ...grid, isBlocked: (x, y) => deck(x, y) || grid.isBlocked(x, y) };
    const boss = FOREST_MAP.monsterSpawns.find((r) => r.monsterId === 'tronco_rei')!;
    const target = center(boss.area);
    expect(reach(target)).toBe(true);
    expect(reach(target, noBridges)).toBe(false);
    expect(FOREST_MAP.props?.filter((p) => p.kind === 'bridge-stream')).toHaveLength(2);
  });
});
