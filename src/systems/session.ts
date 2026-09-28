// Estado da engine que sobrevive às trocas de mapa. Estado de gameplay (HP, EXP, inventário)
// fica nos módulos do gameplay — módulos ES já persistem entre cenas.

import type { Direction8 } from './directions';

export interface MapPoint {
  mapId: string;
  spawnId: string;
}

export const session = {
  currentMapId: '',
  facing: 'south' as Direction8,
  /** Atualizado ao entrar num mapa `safe`; destino de "voltar ao último ponto seguro". */
  lastSafePoint: { mapId: 'town', spawnId: 'start' } as MapPoint,
  /** Onde o save parou; o boot começa aqui (uma vez) em vez do ponto seguro. */
  resumePoint: null as MapPoint | null,
  /**
   * Ids das Pedras de Retorno ativadas pelo jogador (as `startsActive` contam sem estar aqui).
   * PENDENTE: persistir no save (campo novo em src/gameplay/save.ts).
   */
  activatedStones: [] as string[],
};
