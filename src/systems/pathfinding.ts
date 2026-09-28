// A* em grade com 8 vizinhos + suavização por linha de visão. Sem dependência do Phaser (testável).

export interface GridPoint {
  x: number;
  y: number;
}

export interface WalkGrid {
  readonly width: number;
  readonly height: number;
  /** true se o tile não pode ser atravessado (fora da grade também conta como bloqueado). */
  isBlocked(x: number, y: number): boolean;
}

const SQRT2 = Math.SQRT2;

const NEIGHBORS: readonly [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

/** Tile livre mais próximo de `goal` num raio de `radius` tiles (ou null). */
export function nearestWalkable(grid: WalkGrid, goal: GridPoint, radius = 3): GridPoint | null {
  if (!grid.isBlocked(goal.x, goal.y)) return goal;
  let best: GridPoint | null = null;
  let bestDist = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = goal.x + dx;
      const y = goal.y + dy;
      if (grid.isBlocked(x, y)) continue;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
}

/**
 * Tile alcançável a partir de `start` mais perto de `goal` (em linha reta), explorando até `maxNodes`
 * tiles. Usado quando o destino é inalcançável (nuvem, outra margem do lago): anda até o mais perto dá.
 * Empate fica com o encontrado primeiro (mais perto de `start`). `accept` filtra candidatos (ex.: fora de saídas);
 * eles ainda podem ser atravessados.
 */
export function nearestReachable(
  grid: WalkGrid,
  start: GridPoint,
  goal: GridPoint,
  accept: (p: GridPoint) => boolean = () => true,
  maxNodes = 6000,
): GridPoint {
  const w = grid.width;
  const seen = new Set<number>([start.y * w + start.x]);
  const queue: GridPoint[] = [start];
  let best = start;
  let bestDist = (start.x - goal.x) ** 2 + (start.y - goal.y) ** 2;
  for (let head = 0; head < queue.length && head < maxNodes; head++) {
    const c = queue[head]!;
    const d = (c.x - goal.x) ** 2 + (c.y - goal.y) ** 2;
    if (d < bestDist && accept(c)) {
      bestDist = d;
      best = c;
    }
    for (const [dx, dy] of NEIGHBORS) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (grid.isBlocked(nx, ny) || seen.has(ny * w + nx)) continue;
      if (dx !== 0 && dy !== 0 && (grid.isBlocked(c.x + dx, c.y) || grid.isBlocked(c.x, c.y + dy))) continue;
      seen.add(ny * w + nx);
      queue.push({ x: nx, y: ny });
    }
  }
  return best;
}

/**
 * Caminho de `start` até `goal` (inclusive ambos), em tiles. Diagonais não cortam quinas.
 * Se o destino estiver bloqueado, usa o tile livre mais próximo. Retorna null se não houver caminho.
 */
export function findPath(
  grid: WalkGrid,
  start: GridPoint,
  goal: GridPoint,
  maxNodes = 6000,
): GridPoint[] | null {
  const target = nearestWalkable(grid, goal);
  if (!target) return null;
  if (start.x === target.x && start.y === target.y) return [start];

  const w = grid.width;
  const key = (x: number, y: number) => y * w + x;
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  // Heap binário simples de [f, key].
  const heap: [number, number][] = [];
  const push = (f: number, k: number) => {
    heap.push([f, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]![0] <= heap[i]![0]) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const pop = (): [number, number] | undefined => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };

  const startKey = key(start.x, start.y);
  const goalKey = key(target.x, target.y);
  gScore.set(startKey, 0);
  push(octile(start.x, start.y, target.x, target.y), startKey);

  let expanded = 0;
  while (heap.length > 0) {
    const [, current] = pop()!;
    if (current === goalKey) {
      const path: GridPoint[] = [];
      let k: number | undefined = current;
      while (k !== undefined) {
        path.push({ x: k % w, y: Math.floor(k / w) });
        k = cameFrom.get(k);
      }
      return path.reverse();
    }
    if (closed.has(current)) continue;
    closed.add(current);
    if (++expanded > maxNodes) return null;

    const cx = current % w;
    const cy = Math.floor(current / w);
    const g = gScore.get(current)!;
    for (const [dx, dy, cost] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (grid.isBlocked(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (grid.isBlocked(cx + dx, cy) || grid.isBlocked(cx, cy + dy))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const ng = g + cost;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        cameFrom.set(nk, current);
        push(ng + octile(nx, ny, target.x, target.y), nk);
      }
    }
  }
  return null;
}

/**
 * Linha de visão entre dois pontos em coordenadas de tile (fracionárias), considerando um corpo
 * de raio `radius` (em tiles): testa a linha central e duas paralelas.
 */
export function hasLineOfSight(
  grid: WalkGrid,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius = 0.3,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return !grid.isBlocked(Math.floor(ax), Math.floor(ay));
  const px = (-dy / len) * radius;
  const py = (dx / len) * radius;
  const steps = Math.ceil(len / 0.25);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const y = ay + dy * t;
    if (grid.isBlocked(Math.floor(x), Math.floor(y))) return false;
    if (grid.isBlocked(Math.floor(x + px), Math.floor(y + py))) return false;
    if (grid.isBlocked(Math.floor(x - px), Math.floor(y - py))) return false;
  }
  return true;
}

/**
 * Remove pontos intermediários desnecessários (string pulling). Recebe pontos em coordenadas de
 * tile fracionárias (ex.: centros = x + 0.5) e devolve a lista suavizada, sem o ponto inicial.
 */
export function smoothPath(grid: WalkGrid, points: readonly GridPoint[], radius = 0.3): GridPoint[] {
  if (points.length <= 1) return [];
  const result: GridPoint[] = [];
  let anchor = points[0]!;
  let i = 1;
  while (i < points.length) {
    let furthest = i;
    for (let j = points.length - 1; j > i; j--) {
      const p = points[j]!;
      if (hasLineOfSight(grid, anchor.x, anchor.y, p.x, p.y, radius)) {
        furthest = j;
        break;
      }
    }
    anchor = points[furthest]!;
    result.push(anchor);
    i = furthest + 1;
  }
  return result;
}
