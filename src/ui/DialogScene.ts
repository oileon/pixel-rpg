// Caixa de diálogo (NPCs, Pedra de Retorno). Cena própria acima da UIScene: enquanto aberta, o fundo consome os
// cliques (não chegam ao mundo). Estado e API em src/systems/dialog.ts; esta cena só desenha e trata o input.

import Phaser from 'phaser';
import { closeDialog, currentDialog, selectDialogChoice, type DialogChoice, type DialogRequest } from '../systems/dialog';
import { gameEvents } from '../systems/events';
import { HOTBAR_TOP } from './Hotbar';
import { uiButton, uiText, UI_MUTED } from './widgets';

export const DIALOG_SCENE_KEY = 'dialog';

const BOX_W = 600;
const PAD = 12;
const TEXT_SIZE = 13;
const BUTTON_GAP = 8;
const BUTTON_ROW_H = 26;
/** Fundo da caixa fica logo acima da barra de atalhos. */
const BOX_BOTTOM = HOTBAR_TOP - 14;

export class DialogScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private dialog: DialogRequest | null = null;
  private page = 0;

  constructor() {
    super({ key: DIALOG_SCENE_KEY });
  }

  create(): void {
    this.root = this.add.container(0, 0).setVisible(false);
    gameEvents.onScene(this, 'dialogChanged', ({ dialog }) => this.show(dialog));
    const keyboard = this.input.keyboard;
    if (keyboard) {
      // Direto no teclado (sem onKeyPress): o Esc também fecha janelas da UIScene, e onKeyPress entrega cada
      // tecla a um só handler.
      const on = (key: string, handler: () => void) =>
        keyboard.on(`keydown-${key}`, (event: KeyboardEvent) => {
          if (!event.repeat) handler();
        });
      on('SPACE', () => this.advance());
      on('ENTER', () => this.advance());
      on('ESC', () => closeDialog());
    }
    // Aberto antes de a cena existir (ex.: no mesmo frame do boot).
    this.show(currentDialog());
  }

  private show(dialog: DialogRequest | null): void {
    this.dialog = dialog;
    this.page = 0;
    this.render();
  }

  private get lastPage(): boolean {
    return !this.dialog || this.page >= this.dialog.lines.length - 1;
  }

  /** Clique/Espaço: próxima fala; na última, com uma escolha só (ou nenhuma), escolhe/fecha. */
  private advance(): void {
    const dialog = this.dialog;
    if (!dialog) return;
    if (!this.lastPage) {
      this.page++;
      this.render();
    } else if (!dialog.choices || dialog.choices.length === 0) {
      closeDialog();
    } else if (dialog.choices.length === 1) {
      selectDialogChoice(dialog.choices[0]!);
    }
  }

  private render(): void {
    this.root.removeAll(true);
    const dialog = this.dialog;
    this.root.setVisible(dialog !== null);
    if (!dialog) return;

    const x0 = Math.round((this.scale.width - BOX_W) / 2);
    const name = uiText(this, PAD, PAD, dialog.speaker, 14, '#ffe9a8');
    const body = uiText(this, PAD, PAD + 22, dialog.lines[this.page] ?? '', TEXT_SIZE);
    body.setWordWrapWidth(BOX_W - PAD * 2, true);

    const buttons: Phaser.GameObjects.Text[] = [];
    let hint: Phaser.GameObjects.Text | null = null;
    if (this.lastPage) {
      const choices: readonly DialogChoice[] = dialog.choices?.length ? dialog.choices : [{ label: 'Fechar' }];
      for (const choice of choices) {
        buttons.push(uiButton(this, 0, 0, choice.label, () => selectDialogChoice(choice), { enabled: choice.enabled, size: 12 }));
      }
    } else {
      hint = uiText(this, 0, 0, `▼ clique ou Espaço (${this.page + 1}/${dialog.lines.length})`, 11, UI_MUTED);
    }

    // Botões em linhas que quebram na largura da caixa.
    const top = body.y + body.height + 10;
    let bx = PAD;
    let by = top;
    for (const b of buttons) {
      if (bx > PAD && bx + b.width > BOX_W - PAD) {
        bx = PAD;
        by += BUTTON_ROW_H;
      }
      b.setPosition(bx, by);
      bx += b.width + BUTTON_GAP;
    }
    const contentBottom = buttons.length > 0 ? by + BUTTON_ROW_H - 4 : top + 14;
    const height = Math.max(84, contentBottom + PAD);
    if (hint) hint.setPosition(BOX_W - PAD - hint.width, height - PAD - hint.height + 2);

    const bg = this.add.rectangle(0, 0, BOX_W, height, 0x18202e, 0.94).setOrigin(0).setStrokeStyle(2, 0x8fb3ff, 0.9);
    // Consome o clique (o mundo fica abaixo) e avança a fala.
    bg.setInteractive({ useHandCursor: !this.lastPage });
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.advance());
    this.root.add([bg, name, body, ...buttons, ...(hint ? [hint] : [])]);
    this.root.setPosition(x0, BOX_BOTTOM - height);
  }
}
