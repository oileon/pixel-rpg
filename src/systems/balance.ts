// Simulação de luta com as fórmulas reais (sem Phaser), para balanceamento e testes.
// Modelo: o jogador ataca um monstro por vez; todos os monstros vivos atacam o jogador.
// Não considera movimento, regeneração nem consumíveis.

import type { MonsterDef, Rng } from '../data/types';
import { monsterCombatStats, resolveAttack, type CombatStats } from './combat';
import { attackDelayMs } from './stats';

/** Espera antes do 1º golpe de um monstro (igual a MONSTER_WINDUP_MS do gameplay). */
export const SIM_MONSTER_WINDUP_MS = 300;
/** Limite de segurança da simulação. */
export const SIM_MAX_MS = 5 * 60_000;

export interface SimFighter {
  stats: CombatStats;
  hp: number;
  attackDelayMs: number;
}

export interface FightResult {
  playerWon: boolean;
  /** Duração até alguém cair (ou até SIM_MAX_MS). */
  timeMs: number;
  playerHpLeft: number;
  monstersKilled: number;
}

export function monsterFighter(monster: MonsterDef): SimFighter {
  return { stats: monsterCombatStats(monster), hp: monster.hp, attackDelayMs: attackDelayMs(monster.aspd) };
}

/** Luta do jogador contra `monsters` ao mesmo tempo (todos já em alcance no instante 0). */
export function simulateFight(player: SimFighter, monsters: readonly SimFighter[], rng: Rng): FightResult {
  let playerHp = player.hp;
  const hps = monsters.map((m) => m.hp);
  const nextMonsterAt = monsters.map(() => SIM_MONSTER_WINDUP_MS);
  let nextPlayerAt = 0;
  let killed = 0;
  let time = 0;

  while (time <= SIM_MAX_MS) {
    const alive = hps.map((hp, i) => (hp > 0 ? i : -1)).filter((i) => i >= 0);
    if (alive.length === 0) return { playerWon: true, timeMs: time, playerHpLeft: playerHp, monstersKilled: killed };
    const nextMonster = Math.min(...alive.map((i) => nextMonsterAt[i]));
    time = Math.min(nextPlayerAt, nextMonster);

    if (nextPlayerAt <= nextMonster) {
      const target = alive[0];
      hps[target] -= resolveAttack(player.stats, monsters[target].stats, rng).damage;
      if (hps[target] <= 0) killed++;
      nextPlayerAt += player.attackDelayMs;
    } else {
      for (const i of alive) {
        if (nextMonsterAt[i] !== time) continue;
        playerHp -= resolveAttack(monsters[i].stats, player.stats, rng).damage;
        nextMonsterAt[i] += monsters[i].attackDelayMs;
      }
      if (playerHp <= 0) return { playerWon: false, timeMs: time, playerHpLeft: 0, monstersKilled: killed };
    }
  }
  return { playerWon: false, timeMs: time, playerHpLeft: playerHp, monstersKilled: killed };
}

export interface FightSummary {
  winRate: number;
  /** Média do tempo das lutas em que o jogador caiu (Infinity se nunca caiu). */
  avgTimeToDieMs: number;
  /** Média do tempo das lutas vencidas (Infinity se nunca venceu). */
  avgTimeToWinMs: number;
  avgHpLeftOnWin: number;
}

export function summarizeFights(player: SimFighter, monsters: readonly SimFighter[], trials: number, rng: Rng): FightSummary {
  let wins = 0;
  let winTime = 0;
  let hpLeft = 0;
  let loseTime = 0;
  for (let t = 0; t < trials; t++) {
    const r = simulateFight(player, monsters, rng);
    if (r.playerWon) {
      wins++;
      winTime += r.timeMs;
      hpLeft += r.playerHpLeft;
    } else {
      loseTime += r.timeMs;
    }
  }
  const losses = trials - wins;
  return {
    winRate: wins / trials,
    avgTimeToDieMs: losses > 0 ? loseTime / losses : Infinity,
    avgTimeToWinMs: wins > 0 ? winTime / wins : Infinity,
    avgHpLeftOnWin: wins > 0 ? hpLeft / wins : 0,
  };
}

/**
 * Tempo esperado (ms) para o jogador morrer se só apanhar de `monsters` (fugindo ou sem revidar).
 * Usa média de dano por golpe, então é determinístico.
 */
export function expectedTimeToDieMs(player: SimFighter, monsters: readonly SimFighter[], rng: Rng, samples = 2000): number {
  const dps = monsters.reduce((sum, m) => {
    let total = 0;
    for (let i = 0; i < samples; i++) total += resolveAttack(m.stats, player.stats, rng).damage;
    return sum + total / samples / m.attackDelayMs;
  }, 0);
  return dps > 0 ? SIM_MONSTER_WINDUP_MS + player.hp / dps : Infinity;
}
