// Direções em 8 sentidos (nomes iguais aos das pastas exportadas pelo PixelLab).

export type Direction8 =
  | 'south'
  | 'south-east'
  | 'east'
  | 'north-east'
  | 'north'
  | 'north-west'
  | 'west'
  | 'south-west';

export const DIRECTIONS_8: readonly Direction8[] = [
  'south',
  'south-east',
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
];

// Ordem por ângulo a partir do leste, sentido horário (y da tela cresce para baixo).
const BY_ANGLE: readonly Direction8[] = [
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
  'north',
  'north-east',
];

/**
 * Converte um vetor de movimento (coordenadas de tela) na direção de 8 sentidos mais próxima.
 * Retorna `null` para vetor (quase) nulo — nesse caso mantenha a direção atual.
 */
export function vectorToDirection(dx: number, dy: number, epsilon = 1e-6): Direction8 | null {
  if (Math.abs(dx) < epsilon && Math.abs(dy) < epsilon) return null;
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return BY_ANGLE[((sector % 8) + 8) % 8]!;
}

/** Vetor unitário de uma direção (coordenadas de tela). */
export function directionToVector(dir: Direction8): { x: number; y: number } {
  const index = BY_ANGLE.indexOf(dir);
  const angle = index * (Math.PI / 4);
  return { x: Math.round(Math.cos(angle) * 1e6) / 1e6, y: Math.round(Math.sin(angle) * 1e6) / 1e6 };
}
