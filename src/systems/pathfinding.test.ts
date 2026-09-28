import { describe, expect, it } from 'vitest';
import { findPath, hasLineOfSight, nearestReachable, nearestWalkable, smoothPath, type WalkGrid } from './pathfinding';

/** '#' = bloqueado, '.' = livre. */
function gridFrom(rows: string[]): WalkGrid {
  return {
    width: rows[0]!.length,
    height: rows.length,
    isBlocked: (x, y) => rows[y]?.[x] !== '.',
  };
}

describe('findPath', () => {
  it('anda em diagonal em campo aberto', () => {
    const grid = gridFrom(['....', '....', '....', '....']);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 3, y: 3 });
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
  });

  it('contorna paredes', () => {
    const grid = gridFrom(['.....', '.###.', '.....']);
    const path = findPath(grid, { x: 0, y: 1 }, { x: 4, y: 1 })!;
    expect(path[0]).toEqual({ x: 0, y: 1 });
    expect(path[path.length - 1]).toEqual({ x: 4, y: 1 });
    for (const p of path) expect(grid.isBlocked(p.x, p.y)).toBe(false);
  });

  it('não corta quinas na diagonal', () => {
    const grid = gridFrom(['.#', '..']);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 1, y: 1 })!;
    expect(path).toHaveLength(3);
  });

  it('usa o tile livre mais próximo se o destino estiver bloqueado', () => {
    const grid = gridFrom(['...#', '...#']);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 3, y: 0 })!;
    expect(path[path.length - 1]).toEqual({ x: 2, y: 0 });
  });

  it('retorna null quando não há caminho', () => {
    const grid = gridFrom(['..#..', '..#..']);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
  });
});

describe('nearestWalkable', () => {
  it('retorna null se nada livre no raio', () => {
    const grid = gridFrom(['#####']);
    expect(nearestWalkable(grid, { x: 2, y: 0 }, 2)).toBeNull();
  });
});

describe('smoothPath / hasLineOfSight', () => {
  it('liga pontos em linha reta quando não há obstáculo', () => {
    const grid = gridFrom(['.....', '.....', '.....']);
    const points = [0, 1, 2, 3, 4].map((x) => ({ x: x + 0.5, y: 1.5 }));
    expect(smoothPath(grid, points)).toEqual([{ x: 4.5, y: 1.5 }]);
  });

  it('mantém o desvio quando há parede no meio', () => {
    const grid = gridFrom(['.....', '..#..', '.....']);
    expect(hasLineOfSight(grid, 0.5, 1.5, 4.5, 1.5)).toBe(false);
    const path = findPath(grid, { x: 0, y: 1 }, { x: 4, y: 1 })!;
    const smoothed = smoothPath(
      grid,
      path.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 })),
    );
    expect(smoothed.length).toBeGreaterThan(1);
    expect(smoothed[smoothed.length - 1]).toEqual({ x: 4.5, y: 1.5 });
  });
});

describe('nearestReachable', () => {
  it('leva ao tile alcançável mais perto de um destino longe dentro da nuvem', () => {
    // Ilha 3x3 no canto; destino bem fora dela (além do raio de nearestWalkable).
    const grid = gridFrom(['...#######', '...#######', '...#######', '##########', '##########']);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 9, y: 4 })).toBeNull();
    expect(nearestReachable(grid, { x: 0, y: 0 }, { x: 9, y: 4 })).toEqual({ x: 2, y: 2 });
  });

  it('respeita o filtro de candidatos, mas passa por eles', () => {
    const grid = gridFrom(['.....']);
    const notLast = (p: { x: number }) => p.x !== 4;
    expect(nearestReachable(grid, { x: 0, y: 0 }, { x: 4, y: 0 }, notLast)).toEqual({ x: 3, y: 0 });
  });

  it('ignora tiles livres do outro lado de um muro', () => {
    const grid = gridFrom(['..#..', '..#..', '..#..']);
    expect(nearestReachable(grid, { x: 0, y: 1 }, { x: 4, y: 1 })).toEqual({ x: 1, y: 1 });
  });
});
