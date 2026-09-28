import { getVisual } from '../assets/manifest';
import type { TileRect } from '../maps/types';
import type { EntityAI } from '../systems/ai';
import type { WorldScene } from '../scenes/WorldScene';
import { Entity } from './Entity';

/** Mínimo que a engine precisa de uma definição de monstro (MonsterDef do gameplay é compatível). */
export interface SpawnableDef {
  id: string;
  name: string;
  /** px/s */
  moveSpeed: number;
}

export class Monster<T extends SpawnableDef = SpawnableDef> extends Entity {
  /** Comportamento atual; o gameplay pode trocar (ex.: perseguir/atacar) ou pôr null. */
  ai: EntityAI | null = null;

  constructor(
    world: WorldScene,
    readonly def: T,
    x: number,
    y: number,
    /** Área (tiles) de origem — usada pela IA de passeio. */
    readonly homeArea: TileRect | null = null,
  ) {
    super(world, 'monster', getVisual(def.id), x, y, { speed: def.moveSpeed });
    this.sprite.setInteractive({ useHandCursor: true });
  }

  override update(time: number, delta: number): void {
    if (!this.dead) this.ai?.update(this, time, delta);
    super.update(time, delta);
  }
}
