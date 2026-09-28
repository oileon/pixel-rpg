import { MONSTERS, type MonsterDef } from '../data';
import { FIELD_MAP } from '../maps/field';
import type { MapDef } from '../maps/types';
import { MonsterSpawner } from '../systems/spawner';
import { WorldScene } from './WorldScene';

/** Campo com monstros (Campos de Pêssego; base de outros campos, ex.: ForestScene). */
export class FieldScene extends WorldScene {
  spawner!: MonsterSpawner<MonsterDef>;

  constructor(map: MapDef = FIELD_MAP) {
    super(map);
  }

  override create(): void {
    super.create();
    this.spawner = new MonsterSpawner(this, MONSTERS, this.mapDef.monsterSpawns);
    this.spawner.start();
  }
}
