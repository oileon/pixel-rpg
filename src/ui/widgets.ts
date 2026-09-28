// Peças de UI simples (texto, botão, painel) usadas pela UIScene.

import Phaser from 'phaser';

export const UI_FONT = 'monospace';
export const UI_TEXT = '#f2f5fa';
export const UI_MUTED = '#9aa6b8';
export const UI_GOOD = '#7dff8a';
export const UI_BAD = '#ff7a7a';

export function uiText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size = 12,
  color = UI_TEXT,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, value, {
    fontFamily: UI_FONT,
    fontSize: `${size}px`,
    color,
    stroke: '#10151f',
    strokeThickness: 3,
  });
}

export interface ButtonOptions {
  enabled?: boolean;
  size?: number;
  background?: string;
}

export function uiButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: (pointer: Phaser.Input.Pointer) => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Text {
  const enabled = options.enabled ?? true;
  const background = options.background ?? '#2d3b55';
  const button = scene.add.text(x, y, label, {
    fontFamily: UI_FONT,
    fontSize: `${options.size ?? 12}px`,
    color: enabled ? UI_TEXT : '#5d687a',
    backgroundColor: enabled ? background : '#222a38',
    padding: { x: 6, y: 3 },
  });
  if (enabled) {
    button.setInteractive({ useHandCursor: true });
    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => button.setBackgroundColor('#4a6190'));
    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => button.setBackgroundColor(background));
    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => onClick(pointer));
  }
  return button;
}

/** Janela com fundo que bloqueia cliques no mundo, título e botão de fechar. */
export class Panel {
  readonly root: Phaser.GameObjects.Container;
  /** Conteúdo reconstruído a cada `clear()`. Coordenadas relativas ao painel. */
  readonly content: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;

  constructor(
    readonly scene: Phaser.Scene,
    x: number,
    y: number,
    readonly width: number,
    readonly height: number,
    title: string,
    onClose: () => void,
  ) {
    const bg = scene.add.rectangle(0, 0, width, height, 0x18202e, 0.94).setOrigin(0).setStrokeStyle(2, 0x8fb3ff, 0.9);
    // Interativo só para "consumir" o clique (a cena de UI fica acima do mundo).
    bg.setInteractive();
    this.title = uiText(scene, 10, 8, title, 14, '#ffe9a8');
    const close = uiButton(scene, width - 26, 6, 'x', onClose);
    this.content = scene.add.container(0, 0);
    this.root = scene.add.container(x, y, [bg, this.title, close, this.content]).setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  setTitle(title: string): void {
    this.title.setText(title);
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  clear(): void {
    this.content.removeAll(true);
  }

  add<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.content.add(obj);
    return obj;
  }
}
