// Decisão da IA de monstros (pura, sem Phaser). A camada de cena executa o modo escolhido.

import type { MonsterBehavior } from '../data/types';
import {
  HOME_ARRIVAL_RANGE,
  LOSE_TARGET_RANGE,
  RETURN_FORCE_TELEPORT_MS,
  RETURN_TIMEOUT_FACTOR,
  RETURN_TIMEOUT_SLACK_MS,
} from './config';

/** idle = passeio padrão; chase = persegue; attack = parado atacando; return = volta para casa. */
export type MonsterMode = 'idle' | 'chase' | 'attack' | 'return';

export interface BrainInput {
  mode: MonsterMode;
  behavior: MonsterBehavior;
  /** Foi atacado pelo jogador (passivos só lutam assim). */
  provoked: boolean;
  /** Jogador vivo, no mapa e atacável. */
  playerAvailable: boolean;
  distToPlayer: number;
  aggroRange: number;
  attackRange: number;
  /** Distância até o ponto de origem. */
  distFromHome: number;
  /** Afastou-se mais que isto de casa → desiste e volta. */
  leashRange: number;
}

export function decideMonsterMode(i: BrainInput): MonsterMode {
  // Voltando para casa ignora tudo, a menos que tenha sido reprovocado (ver hitReaction).
  if (i.mode === 'return' && !i.provoked) return i.distFromHome <= HOME_ARRIVAL_RANGE ? 'idle' : 'return';

  const engaged = i.provoked || (i.behavior === 'aggressive' && i.distToPlayer <= i.aggroRange);
  if (!i.playerAvailable || !engaged) return i.mode === 'idle' ? 'idle' : 'return';
  if (i.distFromHome > i.leashRange || i.distToPlayer > LOSE_TARGET_RANGE) return 'return';
  return i.distToPlayer <= i.attackRange ? 'attack' : 'chase';
}

/**
 * normal = leva dano e fica provocado; reengage = estava voltando, mas a briga é dentro da coleira,
 * então volta a lutar; immune = voltando com o jogador fora da coleira: não leva dano (estilo MMO).
 */
export type HitReaction = 'normal' | 'reengage' | 'immune';

export interface HitInput {
  mode: MonsterMode;
  monsterDistFromHome: number;
  playerDistFromHome: number;
  leashRange: number;
}

export function hitReaction(i: HitInput): HitReaction {
  if (i.mode !== 'return') return 'normal';
  const insideLeash = i.monsterDistFromHome <= i.leashRange && i.playerDistFromHome <= i.leashRange;
  return insideLeash ? 'reengage' : 'immune';
}

/** Prazo (ms) para um monstro voltar para casa, proporcional à distância e à velocidade (px/s). */
export function returnTimeoutMs(distToHome: number, speed: number): number {
  const travelMs = speed > 0 ? (distToHome / speed) * 1000 : 0;
  return travelMs * RETURN_TIMEOUT_FACTOR + RETURN_TIMEOUT_SLACK_MS;
}

export interface TeleportInput {
  elapsedMs: number;
  timeoutMs: number;
  /** Monstro dentro da área visível da câmera. */
  visible: boolean;
}

/** Teleporta para casa só depois do prazo e fora da vista; à vista, só se continuar preso bem além do prazo. */
export function shouldTeleportHome(i: TeleportInput): boolean {
  if (i.elapsedMs <= i.timeoutMs) return false;
  return !i.visible || i.elapsedMs > i.timeoutMs + RETURN_FORCE_TELEPORT_MS;
}
