// HUD mínimo da engine (nome do mapa e dica de controles). HP/SP/EXP ficam com o gameplay.

import Phaser from 'phaser';

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#ffffff',
  stroke: '#1b2433',
  strokeThickness: 3,
};

export const HUD_DEPTH = 100000;

export class Hud {
  private readonly mapLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, mapName: string) {
    this.mapLabel = scene.add.text(8, 8, mapName, TEXT_STYLE).setScrollFactor(0).setDepth(HUD_DEPTH);
    scene.add
      .text(8, scene.scale.height - 8, 'Clique: andar/atacar · Segurar: seguir · WASD: andar', {
        ...TEXT_STYLE,
        fontSize: '12px',
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH)
      .setAlpha(0.8);
  }

  setMapName(name: string): void {
    this.mapLabel.setText(name);
  }
}
