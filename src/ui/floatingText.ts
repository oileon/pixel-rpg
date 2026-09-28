// Números/textos que sobem e somem (dano, "Miss", EXP) no espaço do mundo.

import Phaser from 'phaser';

export interface FloatStyle {
  color: string;
  size?: number;
  /** Sobe mais devagar e dura mais (ex.: level up). */
  slow?: boolean;
}

/** Acima de tudo no mundo, abaixo do HUD. */
const FLOAT_DEPTH = 50000;

export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, style: FloatStyle): void {
  const label = scene.add
    .text(x + Phaser.Math.Between(-6, 6), y, text, {
      fontFamily: 'monospace',
      fontSize: `${style.size ?? 14}px`,
      fontStyle: 'bold',
      color: style.color,
      stroke: '#1b2433',
      strokeThickness: 3,
    })
    .setOrigin(0.5, 1)
    .setDepth(FLOAT_DEPTH);
  const duration = style.slow ? 1600 : 900;
  scene.tweens.add({ targets: label, y: y - (style.slow ? 40 : 28), duration, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: label, alpha: 0, delay: duration * 0.55, duration: duration * 0.45, onComplete: () => label.destroy() });
  if ((style.size ?? 14) > 14) {
    label.setScale(1.6);
    scene.tweens.add({ targets: label, scale: 1, duration: 180, ease: 'Back.easeOut' });
  }
}
