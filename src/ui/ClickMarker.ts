// Anel que marca o destino do clique.

import Phaser from 'phaser';

export class ClickMarker {
  private readonly ring: Phaser.GameObjects.Ellipse;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.ring = scene.add.ellipse(0, 0, 18, 9).setStrokeStyle(2, 0xffffff, 0.9).setVisible(false).setDepth(1);
  }

  show(x: number, y: number): void {
    this.tween?.stop();
    this.ring.setPosition(x, y).setScale(1).setAlpha(1).setVisible(true);
    this.tween = this.scene.tweens.add({
      targets: this.ring,
      scale: 0.4,
      alpha: 0,
      duration: 450,
      onComplete: () => this.ring.setVisible(false),
    });
  }
}
