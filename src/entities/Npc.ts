import { npcVisual } from '../assets/npcs';
import { findNpc, type NpcDef } from '../data/npcs';
import type { Direction8 } from '../systems/directions';
import type { WorldScene } from '../scenes/WorldScene';
import { Entity } from './Entity';

/** NPC parado e clicável. Clique → a engine leva o jogador até ele e abre o diálogo (systems/npcs.ts). */
export class Npc extends Entity {
  readonly def: NpcDef;
  /** Direção de descanso (volta a ela quando a conversa termina). */
  readonly restFacing: Direction8;

  constructor(world: WorldScene, npcId: string, x: number, y: number, facing: Direction8 = 'south') {
    super(world, 'npc', npcVisual(npcId), x, y, { facing, speed: 0 });
    this.def = findNpc(npcId) ?? { id: npcId, name: npcId, lines: ['...'] };
    this.restFacing = facing;
    this.sprite.setInteractive({ useHandCursor: true });
  }
}
