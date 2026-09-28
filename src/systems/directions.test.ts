import { describe, expect, it } from 'vitest';
import { DIRECTIONS_8, directionToVector, vectorToDirection } from './directions';

describe('vectorToDirection', () => {
  it('mapeia os eixos (y da tela para baixo)', () => {
    expect(vectorToDirection(1, 0)).toBe('east');
    expect(vectorToDirection(-1, 0)).toBe('west');
    expect(vectorToDirection(0, 1)).toBe('south');
    expect(vectorToDirection(0, -1)).toBe('north');
  });

  it('mapeia as diagonais', () => {
    expect(vectorToDirection(1, 1)).toBe('south-east');
    expect(vectorToDirection(-1, 1)).toBe('south-west');
    expect(vectorToDirection(1, -1)).toBe('north-east');
    expect(vectorToDirection(-1, -1)).toBe('north-west');
  });

  it('usa setores de 45° centrados em cada direção', () => {
    expect(vectorToDirection(10, 3)).toBe('east'); // ~16.7°
    expect(vectorToDirection(10, 5)).toBe('south-east'); // ~26.6°
    expect(vectorToDirection(-10, -0.1)).toBe('west');
  });

  it('retorna null para vetor nulo', () => {
    expect(vectorToDirection(0, 0)).toBeNull();
  });

  it('é inversa de directionToVector', () => {
    for (const dir of DIRECTIONS_8) {
      const v = directionToVector(dir);
      expect(vectorToDirection(v.x, v.y)).toBe(dir);
    }
  });
});
