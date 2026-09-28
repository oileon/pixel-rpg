// Barramento de eventos tipado, compartilhado entre engine e gameplay.
//
// Para adicionar eventos do gameplay sem editar este arquivo, use declaration merging:
//   declare module '../systems/events' {
//     interface GameEventMap { damageDealt: { target: Entity; amount: number } }
//   }

import Phaser from 'phaser';
import type { NpcAction } from '../data/npcs';
import type { Entity } from '../entities/Entity';
import type { Npc } from '../entities/Npc';
import type { DialogRequest } from './dialog';
import type { WorldScene } from '../scenes/WorldScene';
import type { Direction8 } from './directions';

export interface PointerInfo {
  worldX: number;
  worldY: number;
  /** 0 = esquerdo, 1 = meio, 2 = direito. */
  button: number;
}

export interface GameEventMap {
  /** Clique numa entidade (monstro, NPC...). O movimento NÃO é disparado — o gameplay decide. */
  entityClicked: { entity: Entity; pointer: PointerInfo };
  /** Clique no chão; a engine já move o jogador até lá. */
  groundClicked: { x: number; y: number; pointer: PointerInfo };
  entitySpawned: { entity: Entity };
  /** Emitido por `entity.die()`. A entidade some da cena logo depois (fade). */
  entityDied: { entity: Entity };
  /**
   * Emitido uma única vez quando a entidade é destruída (morte, troca de mapa ou remoção).
   * Nesse momento `entity.dead` e `entity.removed` já são true.
   */
  entityRemoved: { entity: Entity };
  /** Emitido a cada frame em que o jogador trocou de tile. */
  playerMoved: { x: number; y: number; tileX: number; tileY: number; facing: Direction8 };
  /** Jogador parou de andar (chegou ao destino, soltou WASD ou foi parado). */
  playerStopped: { x: number; y: number };
  /** Cena de mapa pronta (jogador já criado). `scene` é a cena que acabou de entrar. */
  mapEntered: { mapId: string; spawnId: string; scene: WorldScene };
  /**
   * Início da troca de mapa, antes do fade (cena ainda ativa, `scene.traveling` já é true).
   * As entidades da cena são removidas (entityRemoved) ao fim do fade.
   */
  mapExiting: { fromMapId: string; toMapId: string; toSpawnId: string; scene: WorldScene };
  /** Diálogo aberto/trocado (`dialog`) ou fechado (null). Use `openDialog`/`closeDialog` de systems/dialog.ts. */
  dialogChanged: { dialog: DialogRequest | null };
  /** Jogador chegou até um NPC e a conversa começou (antes das falas). */
  npcInteracted: { npc: Npc; npcId: string };
  /**
   * Escolheu a ação do NPC (loja, selos, prova do Pacto). Emitido sempre; o handler registrado com
   * `registerNpcAction` (systems/npcs.ts) é quem abre a janela certa.
   */
  npcAction: { npc: Npc; npcId: string; action: NpcAction };
  /**
   * Pedra de Retorno usada: o ponto seguro (`session.lastSafePoint`) já aponta para ela. `firstTime` = acabou de ser
   * ativada. A lista de pedras ativadas fica em `session.activatedStones` (ainda não persistida no save).
   */
  returnStoneUsed: { stoneId: string; mapId: string; firstTime: boolean };
}

export type GameEventName = keyof GameEventMap;
type Handler<K extends GameEventName> = (payload: GameEventMap[K]) => void;

class TypedEventBus {
  private readonly emitter = new Phaser.Events.EventEmitter();

  on<K extends GameEventName>(event: K, handler: Handler<K>, context?: unknown): this {
    this.emitter.on(event, handler, context);
    return this;
  }

  once<K extends GameEventName>(event: K, handler: Handler<K>, context?: unknown): this {
    this.emitter.once(event, handler, context);
    return this;
  }

  off<K extends GameEventName>(event: K, handler?: Handler<K>, context?: unknown): this {
    this.emitter.off(event, handler, context);
    return this;
  }

  emit<K extends GameEventName>(event: K, payload: GameEventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  /**
   * Registra um handler e o remove automaticamente quando a cena for desligada/destruída.
   * Use isto em cenas para não vazar listeners entre trocas de mapa.
   */
  onScene<K extends GameEventName>(scene: Phaser.Scene, event: K, handler: Handler<K>): void {
    this.on(event, handler);
    const cleanup = () => this.off(event, handler);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }
}

/** Barramento global (sobrevive às trocas de cena). */
export const gameEvents = new TypedEventBus();
