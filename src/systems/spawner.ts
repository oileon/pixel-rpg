// Spawner genérico: recebe definições de monstros (dados) e regras de spawn do mapa.

import { Monster, type SpawnableDef } from '../entities/Monster';
import type { MonsterSpawnRule } from '../maps/types';
import type { WorldScene } from '../scenes/WorldScene';
import { WanderAI } from './ai';
import { gameEvents } from './events';

export class MonsterSpawner<T extends SpawnableDef> {
  private readonly defs: ReadonlyMap<string, T>;
  private readonly ruleOf = new Map<Monster<T>, MonsterSpawnRule>();

  constructor(
    private readonly world: WorldScene,
    defs: readonly T[],
    private readonly rules: readonly MonsterSpawnRule[],
  ) {
    this.defs = new Map(defs.map((d) => [d.id, d]));
  }

  /** Popula todas as regras e agenda respawn quando monstros morrem. */
  start(): void {
    gameEvents.onScene(this.world, 'entityDied', ({ entity }) => {
      const rule = this.ruleOf.get(entity as Monster<T>);
      if (!rule) return;
      this.ruleOf.delete(entity as Monster<T>);
      this.world.time.delayedCall(rule.respawnMs, () => this.spawnFromRule(rule));
    });
    for (const rule of this.rules) {
      if (!this.defs.has(rule.monsterId)) {
        console.warn(`[spawner] definição não encontrada: ${rule.monsterId}`);
        continue;
      }
      for (let i = 0; i < rule.count; i++) this.spawnFromRule(rule);
    }
  }

  /** Cria um monstro numa posição (px). Não entra no ciclo de respawn. */
  spawn(defId: string, x: number, y: number): Monster<T> | null {
    const def = this.defs.get(defId);
    if (!def) return null;
    return new Monster<T>(this.world, def, x, y);
  }

  /** Monstros vivos criados pelas regras. */
  get monsters(): Monster<T>[] {
    return [...this.ruleOf.keys()].filter((m) => !m.dead);
  }

  private spawnFromRule(rule: MonsterSpawnRule): Monster<T> | null {
    const def = this.defs.get(rule.monsterId);
    if (!def) return null;
    const point = this.world.randomWalkablePointIn(rule.area);
    if (!point) return null;
    const monster = new Monster<T>(this.world, def, point.x, point.y, rule.area);
    monster.ai = new WanderAI(rule.area);
    this.ruleOf.set(monster, rule);
    return monster;
  }
}
