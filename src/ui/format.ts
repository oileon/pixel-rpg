// Textos formatados compartilhados pela UI e pelos avisos do gameplay.

import { FATIGUE_DURATION_MS, FATIGUE_EXP_MULTIPLIER } from '../systems/exp';

/** mm:ss arredondado para cima. */
export function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** "30" para FATIGUE_EXP_MULTIPLIER = 0.7. */
export function fatiguePenaltyPercent(): number {
  return Math.round((1 - FATIGUE_EXP_MULTIPLIER) * 100);
}

/** Aviso mostrado ao cair: "Fadiga: −30% de EXP por 5 minutos". */
export function fatigueNotice(): string {
  return `Fadiga: −${fatiguePenaltyPercent()}% de EXP por ${Math.round(FATIGUE_DURATION_MS / 60000)} minutos`;
}
