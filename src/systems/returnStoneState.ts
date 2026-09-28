// Estado das Pedras de Retorno (sem Phaser, testável): quais estão ativadas e para onde dá para viajar.

import { MAPS } from '../maps';
import type { ReturnStonePlacement } from '../maps/types';
import { session } from './session';

export interface ReturnStoneRef {
  mapId: string;
  mapName: string;
  stone: ReturnStonePlacement;
}

/** Todas as pedras de todos os mapas, na ordem de MAPS. */
export function allReturnStones(): ReturnStoneRef[] {
  return Object.values(MAPS).flatMap((map) =>
    (map.returnStones ?? []).map((stone) => ({ mapId: map.id, mapName: map.name, stone })),
  );
}

export function isStoneActive(stone: ReturnStonePlacement): boolean {
  return stone.startsActive === true || session.activatedStones.includes(stone.id);
}

/** Ativa a pedra; true se ela acabou de ser ativada. */
export function activateStone(stone: ReturnStonePlacement): boolean {
  if (isStoneActive(stone)) return false;
  session.activatedStones = [...session.activatedStones, stone.id];
  return true;
}

/** Destinos de teletransporte a partir de `fromId`: as outras pedras já ativadas. */
export function teleportDestinations(fromId: string): ReturnStoneRef[] {
  return allReturnStones().filter((r) => r.stone.id !== fromId && isStoneActive(r.stone));
}
