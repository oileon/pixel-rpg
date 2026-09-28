// Barra de atalhos 1–8 embaixo da tela. Clique esquerdo (ou a tecla) usa; clique direito limpa.
// Itens entram pelo clique direito no Inventário. Só se atualiza quando atalhos ou quantidades mudam.

import Phaser from 'phaser';
import { getItem } from '../data';
import { HOTBAR_LABELS } from '../gameplay/config';
import { clearHotbarSlot, playerState, useHotbarSlot, type ActionResult } from '../gameplay/playerState';
import { gameEvents } from '../systems/events';
import { HOTBAR_SIZE } from '../systems/hotbar';
import { countItem } from '../systems/inventory';
import { getItemIcon } from './itemIcons';
import { hotbarSignature } from './uiLogic';
import { UI_BAD, UI_MUTED, UI_TEXT, uiText } from './widgets';

const SLOT_SIZE = 36;
const SLOT_GAP = 4;
const BAR_W = HOTBAR_SIZE * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP;
/** Acima das linhas de dica (y ≈ 520) e abaixo da faixa de avisos. */
export const HOTBAR_TOP = 478;

interface SlotView {
  rect: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  qty: Phaser.GameObjects.Text;
  skill: Phaser.GameObjects.Text;
}

export class Hotbar {
  private readonly slots: SlotView[] = [];
  private signature = '';

  constructor(private readonly scene: Phaser.Scene) {
    const x0 = Math.round((scene.scale.width - BAR_W) / 2);
    // Fundo "consome" cliques para não mover o jogador.
    scene.add.rectangle(x0 - 4, HOTBAR_TOP - 4, BAR_W + 8, SLOT_SIZE + 8, 0x10151f, 0.55).setOrigin(0).setInteractive();
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const x = x0 + i * (SLOT_SIZE + SLOT_GAP);
      const rect = scene.add
        .rectangle(x, HOTBAR_TOP, SLOT_SIZE, SLOT_SIZE, 0x1a2332, 0.9)
        .setOrigin(0)
        .setStrokeStyle(1, 0x3a465c)
        .setInteractive({ useHandCursor: true });
      const icon = scene.add.image(x + SLOT_SIZE / 2, HOTBAR_TOP + SLOT_SIZE / 2, '').setVisible(false);
      uiText(scene, x + 2, HOTBAR_TOP, HOTBAR_LABELS[i], 10, UI_MUTED);
      const qty = uiText(scene, x + SLOT_SIZE - 2, HOTBAR_TOP + SLOT_SIZE - 1, '', 10).setOrigin(1, 1);
      const skill = uiText(scene, x + SLOT_SIZE / 2, HOTBAR_TOP + SLOT_SIZE / 2, '', 10, '#c9a7ff').setOrigin(0.5);
      rect.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) {
          clearHotbarSlot(playerState, i);
          this.refresh();
        } else {
          this.use(i);
        }
      });
      this.slots.push({ rect, icon, qty, skill });
    }
  }

  use(index: number): void {
    this.report(useHotbarSlot(playerState, index));
  }

  private report(result: ActionResult): void {
    if (result.message) gameEvents.emit('notify', { text: result.message, color: result.ok ? UI_TEXT : UI_BAD });
    this.refresh();
  }

  /** Chamado a cada frame; só mexe nos objetos se algo mudou. */
  refresh(): void {
    const countOf = (itemId: string) => countItem(playerState.inventory, itemId);
    const signature = hotbarSignature(playerState.hotbar, countOf);
    if (signature === this.signature) return;
    this.signature = signature;

    this.slots.forEach((view, i) => {
      const entry = playerState.hotbar[i];
      view.skill.setText(entry?.kind === 'skill' ? 'skill' : '');
      if (entry?.kind !== 'item') {
        view.icon.setVisible(false);
        view.qty.setText('');
        return;
      }
      const count = countOf(entry.itemId);
      view.icon.setTexture(getItemIcon(this.scene, getItem(entry.itemId))).setVisible(true).setAlpha(count > 0 ? 1 : 0.35);
      view.qty.setText(`${count}`).setColor(count > 0 ? UI_TEXT : UI_BAD);
    });
  }
}
