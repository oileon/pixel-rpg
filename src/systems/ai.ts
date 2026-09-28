// Interface de IA de entidades + IA de passeio padrão. O gameplay pode implementar outras
// (perseguir, atacar, fugir) e atribuir em `monster.ai`.

import type { Entity } from '../entities/Entity';
import type { TileRect } from '../maps/types';

export interface EntityAI {
  update(entity: Entity, time: number, delta: number): void;
}

/** Fica parado um tempo, depois anda até um ponto livre aleatório da área e repete. */
export class WanderAI implements EntityAI {
  private waitMs: number;

  constructor(
    private readonly area: TileRect,
    private readonly minWaitMs = 1500,
    private readonly maxWaitMs = 4500,
    private readonly rng: () => number = Math.random,
  ) {
    this.waitMs = this.randomWait();
  }

  update(entity: Entity, _time: number, delta: number): void {
    if (entity.isMoving) return;
    this.waitMs -= delta;
    if (this.waitMs > 0) return;
    this.waitMs = this.randomWait();
    const target = entity.world.randomWalkablePointIn(this.area, this.rng);
    if (target) entity.moveTo(target.x, target.y);
  }

  private randomWait(): number {
    return this.minWaitMs + this.rng() * (this.maxWaitMs - this.minWaitMs);
  }
}
