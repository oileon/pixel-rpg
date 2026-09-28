// Sensação de combate: tempos e intensidades derivados de feel.json. Funções puras (sem Phaser);
// quem aplica os efeitos é gameplay/combatFeel.ts. Fórmulas em docs/design.md ("Sensação de combate").

import type { AttackFeel, FeelConfig, ScreenPoint } from '../data/types';

export interface SwingPlan {
  /** Duração total do golpe (animação ou avanço procedural). */
  swingMs: number;
  /** Momento do impacto, contado do início do golpe. O dano é aplicado aqui. */
  impactMs: number;
}

/** Duração natural de uma animação de sprite sheet. */
export function animationMs(frames: number, frameRate: number): number {
  return frameRate > 0 ? (frames / frameRate) * 1000 : 0;
}

/**
 * Planeja um golpe dentro do intervalo de ataque. A duração natural (animação, ou avanço+volta
 * do lunge) fica entre `minSwingMs` e `maxSwingMs` e nunca passa de `maxSwingFraction` do
 * intervalo, então o impacto sempre acontece antes do próximo golpe e o ASPD não muda.
 */
export function planSwing(attackDelayMs: number, cfg: AttackFeel, animMs: number | null): SwingPlan {
  const natural = animMs ?? cfg.lungeOutMs + cfg.lungeBackMs;
  const cap = Math.max(0, Math.min(cfg.maxSwingMs, attackDelayMs * cfg.maxSwingFraction));
  const swingMs = Math.min(cap, Math.max(cfg.minSwingMs, natural));
  const fraction = animMs !== null ? cfg.impactFraction : cfg.lungeOutMs / (cfg.lungeOutMs + cfg.lungeBackMs);
  return { swingMs, impactMs: Math.round(swingMs * Math.min(1, Math.max(0, fraction))) };
}

export interface HitInfo {
  hit: boolean;
  crit: boolean;
  damage: number;
  /** HP máximo do alvo (para decidir se foi um golpe "forte"). */
  targetMaxHp: number;
  killed: boolean;
}

/** Hit-stop em ms (0 no erro). Crítico é mais longo; o golpe fatal ganha um bônus. */
export function hitStopMs(hit: HitInfo, cfg: FeelConfig['hitStop']): number {
  if (!hit.hit) return 0;
  const base = hit.crit ? cfg.critMs : cfg.normalMs;
  return Math.min(cfg.maxMs, base + (hit.killed ? cfg.killBonusMs : 0));
}

export interface ShakeSpec {
  ms: number;
  intensity: number;
}

/** Tremida de câmera: só em crítico ou golpe que tira ≥ `heavyHitFraction` do HP máximo do alvo. */
export function shakeFor(hit: HitInfo, cfg: FeelConfig['shake']): ShakeSpec | null {
  if (!hit.hit) return null;
  if (hit.crit) return { ms: cfg.critMs, intensity: cfg.critIntensity };
  if (hit.targetMaxHp > 0 && hit.damage >= hit.targetMaxHp * cfg.heavyHitFraction) {
    return { ms: cfg.heavyMs, intensity: cfg.heavyIntensity };
  }
  return null;
}

/** Deslocamento de `px` pixels na direção de `from` para `to` (zero se coincidem). */
export function pushOffset(from: ScreenPoint, to: ScreenPoint, px: number): ScreenPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0 || px === 0) return { x: 0, y: 0 };
  return { x: (dx / len) * px, y: (dy / len) * px };
}

/** Recuo visual do alvo: maior no crítico. */
export function knockbackPx(crit: boolean, cfg: FeelConfig['knockback']): number {
  return crit ? cfg.critPx : cfg.normalPx;
}

/** Curva do avanço/recuo: sobe até 1 em `outMs` e volta a 0 em `backMs` (0 fora do intervalo). */
export function pulseCurve(elapsedMs: number, outMs: number, backMs: number): number {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs < outMs) return elapsedMs / outMs;
  const back = elapsedMs - outMs;
  if (back >= backMs) return 0;
  const t = back / backMs;
  return 1 - t * t * (3 - 2 * t);
}

// ---------- Loot voando ao HUD ----------

/** Quantas moedas desenhar voando para `amount` de moeda ganha. */
export function coinParticleCount(amount: number, cfg: FeelConfig['lootFly']): number {
  if (amount <= 0) return 0;
  return Math.min(cfg.maxCoinParticles, Math.max(1, Math.ceil(amount / Math.max(1, cfg.coinsPerParticle))));
}

/** Divide `amount` entre `parts` partículas (soma exata; as primeiras levam o resto). */
export function splitAmount(amount: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(amount / parts);
  const rest = amount - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rest ? 1 : 0));
}

/** Ponto da trajetória em arco (Bézier quadrática, controle acima do meio) em t ∈ [0, 1]. */
export function flightPoint(start: ScreenPoint, end: ScreenPoint, arcPx: number, t: number): ScreenPoint {
  const k = Math.min(1, Math.max(0, t));
  const cx = (start.x + end.x) / 2;
  const cy = Math.min(start.y, end.y) - arcPx;
  const u = 1 - k;
  return {
    x: u * u * start.x + 2 * u * k * cx + k * k * end.x,
    y: u * u * start.y + 2 * u * k * cy + k * k * end.y,
  };
}

export interface CameraView {
  /** Canto superior esquerdo visível, em coordenadas do mundo. */
  scrollX: number;
  scrollY: number;
  zoom: number;
  /** Posição da câmera na tela. */
  x: number;
  y: number;
}

/** Converte um ponto do mundo para a tela (para a UIScene, que não rola). */
export function worldToScreen(p: ScreenPoint, view: CameraView): ScreenPoint {
  return { x: view.x + (p.x - view.scrollX) * view.zoom, y: view.y + (p.y - view.scrollY) * view.zoom };
}

/**
 * Moeda "em voo": o contador do HUD mostra `real − pendente` e sobe quando cada moeda chega,
 * para o número bater com o que o jogador vê.
 */
export class PendingCounter {
  private pending = 0;

  add(amount: number): void {
    this.pending += Math.max(0, amount);
  }

  settle(amount: number): void {
    this.pending = Math.max(0, this.pending - Math.max(0, amount));
  }

  clear(): void {
    this.pending = 0;
  }

  display(real: number): number {
    return Math.max(0, real - this.pending);
  }
}
