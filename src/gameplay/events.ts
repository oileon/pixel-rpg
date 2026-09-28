// Eventos do gameplay adicionados ao barramento da engine (declaration merging).

import type { Entity } from '../entities/Entity';
import type { KillReward } from './playerState';

declare module '../systems/events' {
  interface GameEventMap {
    /** Monstro derrotado pelo jogador, com as recompensas já aplicadas ao estado. */
    monsterKilled: { entity: Entity; monsterId: string; reward: KillReward };
    /** Subiu para `level`; `statPoints` soma os pontos de todos os níveis ganhos no mesmo abate. */
    levelUp: { level: number; statPoints: number };
    /** Jogador caiu (Fadiga já aplicada; ainda não voltou ao ponto seguro). Posição em px. */
    playerDied: { x: number; y: number; mapId: string };
    /**
     * Algo foi para a bolsa e deve "voar" até o HUD, a partir de (screenX, screenY) na tela.
     * `currency`: moeda já somada (vai ao contador); `item`: pego do chão (vai à bolsa);
     * `fragment`: fragmentos de Selo do abate.
     */
    lootCollected: { kind: 'currency' | 'item' | 'fragment'; amount: number; itemId?: string; screenX: number; screenY: number };
    /** Mensagem curta para o HUD. */
    notify: { text: string; color?: string };
  }
}

export {};
