import { describe, expect, it } from 'vitest';
import { LOSE_TARGET_RANGE, RETURN_FORCE_TELEPORT_MS, RETURN_TIMEOUT_SLACK_MS } from './config';
import { decideMonsterMode, hitReaction, returnTimeoutMs, shouldTeleportHome, type BrainInput } from './monsterBrain';

const base: BrainInput = {
  mode: 'idle',
  behavior: 'passive',
  provoked: false,
  playerAvailable: true,
  distToPlayer: 100,
  aggroRange: 160,
  attackRange: 40,
  distFromHome: 0,
  leashRange: 400,
};

describe('decideMonsterMode', () => {
  it('passivo ignora o jogador até ser atacado', () => {
    expect(decideMonsterMode(base)).toBe('idle');
    expect(decideMonsterMode({ ...base, provoked: true })).toBe('chase');
    expect(decideMonsterMode({ ...base, provoked: true, distToPlayer: 30 })).toBe('attack');
  });

  it('agressivo persegue dentro do raio de aggro', () => {
    const aggressive = { ...base, behavior: 'aggressive' as const };
    expect(decideMonsterMode({ ...aggressive, distToPlayer: 200 })).toBe('idle');
    expect(decideMonsterMode(aggressive)).toBe('chase');
    expect(decideMonsterMode({ ...aggressive, distToPlayer: 40 })).toBe('attack');
  });

  it('volta para casa se passar da coleira, perder o jogador ou o jogador cair', () => {
    const fighting = { ...base, provoked: true, mode: 'chase' as const };
    expect(decideMonsterMode({ ...fighting, distFromHome: 500 })).toBe('return');
    expect(decideMonsterMode({ ...fighting, distToPlayer: LOSE_TARGET_RANGE + 1 })).toBe('return');
    expect(decideMonsterMode({ ...fighting, playerAvailable: false })).toBe('return');
  });

  it('enquanto volta ignora o jogador até chegar', () => {
    const returning = { ...base, behavior: 'aggressive' as const, mode: 'return' as const, distToPlayer: 10 };
    expect(decideMonsterMode({ ...returning, distFromHome: 200 })).toBe('return');
    expect(decideMonsterMode({ ...returning, distFromHome: 10 })).toBe('idle');
  });

  it('reprovocado durante a volta, dentro da coleira, volta a lutar', () => {
    const returning = { ...base, mode: 'return' as const, provoked: true, distFromHome: 100, distToPlayer: 30 };
    expect(decideMonsterMode(returning)).toBe('attack');
    expect(decideMonsterMode({ ...returning, distToPlayer: 100 })).toBe('chase');
  });
});

describe('hitReaction (golpe no monstro)', () => {
  const hit = { mode: 'chase' as const, monsterDistFromHome: 100, playerDistFromHome: 120, leashRange: 400 };

  it('fora do modo de volta, leva dano normalmente', () => {
    expect(hitReaction(hit)).toBe('normal');
    expect(hitReaction({ ...hit, mode: 'idle' })).toBe('normal');
  });

  it('voltando: revida se a briga é dentro da coleira, senão fica imune', () => {
    const returning = { ...hit, mode: 'return' as const };
    expect(hitReaction(returning)).toBe('reengage');
    expect(hitReaction({ ...returning, playerDistFromHome: 500 })).toBe('immune');
    expect(hitReaction({ ...returning, monsterDistFromHome: 450 })).toBe('immune');
  });
});

describe('volta para casa: prazo e teleporte', () => {
  it('prazo proporcional à distância e à velocidade', () => {
    // Cascudo: 531 px a 40 px/s ≈ 13,3 s de caminhada → ×1,5 + folga.
    expect(returnTimeoutMs(531, 40)).toBeCloseTo((531 / 40) * 1000 * 1.5 + RETURN_TIMEOUT_SLACK_MS);
    expect(returnTimeoutMs(531, 40)).toBeGreaterThan(8000);
    expect(returnTimeoutMs(100, 0)).toBe(RETURN_TIMEOUT_SLACK_MS);
  });

  it('só teleporta depois do prazo e fora da câmera; à vista, apenas se continuar preso', () => {
    const timeoutMs = 10_000;
    expect(shouldTeleportHome({ elapsedMs: 9_000, timeoutMs, visible: false })).toBe(false);
    expect(shouldTeleportHome({ elapsedMs: 10_500, timeoutMs, visible: false })).toBe(true);
    expect(shouldTeleportHome({ elapsedMs: 10_500, timeoutMs, visible: true })).toBe(false);
    expect(shouldTeleportHome({ elapsedMs: timeoutMs + RETURN_FORCE_TELEPORT_MS + 1, timeoutMs, visible: true })).toBe(true);
  });
});
