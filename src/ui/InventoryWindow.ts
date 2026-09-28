// Janela de inventário: grade 5×8, coluna de equipamentos (clique para desequipar), moeda, tooltip com
// comparação de equipamento, uso de itens e clique direito para mandar consumíveis à barra de atalhos.
// Aba "Selos": encaixes do equipamento vestido, estojo de Selos (selecionar → clicar no encaixe), fusão e
// Ressonâncias ativas. Só atualiza os objetos quando o estado mostrado muda.

import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { CURRENCY, getItem, getSeal, SEALS_DATA } from '../data';
import type { EquipSlot, SealGrade } from '../data/types';
import {
  assignSlotToHotbar,
  fuseSealStock,
  playerDerived,
  playerState,
  previewEquip,
  previewSocket,
  removeSealFrom,
  sealCapacity,
  socketSealInto,
  unequip,
  useSlot,
  type ActionResult,
} from '../gameplay/playerState';
import { gameEvents } from '../systems/events';
import {
  canSealGoInSlot,
  GRADE_NAMES,
  MAX_SEAL_GRADE,
  SEAL_GRADES,
  sealCount,
  sealName,
  socketsOf,
  type SealRef,
} from '../systems/seals';
import { getItemIcon, RARITY_COLORS } from './itemIcons';
import { activeResonanceLines, ELEMENT_COLORS, elementCss, sealsSignature, sealTooltipText, stockRows } from './sealView';
import {
  EQUIP_SLOT_NAMES,
  EQUIP_SLOTS,
  equipComparisonText,
  inventorySignature,
  itemTooltipText,
  placeTooltip,
  type Rect,
} from './uiLogic';
import { Panel, UI_BAD, UI_MUTED, UI_TEXT, uiButton, uiText } from './widgets';

const COLS = 5;
const ROWS = 8;
const SLOT_SIZE = 36;
const SLOT_GAP = 4;
const GRID_X = 10;
const GRID_Y = 32;
const GRID_W = COLS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP;
const GRID_H = ROWS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP;
/** Coluna de equipamentos à direita da grade. */
const EQUIP_X = GRID_X + GRID_W + 14;
const EQUIP_COL_W = 60;
const EQUIP_LABEL_H = 13;
const EQUIP_STEP = EQUIP_LABEL_H + SLOT_SIZE + 10;
const PANEL_W = EQUIP_X + EQUIP_COL_W + 8;
const PANEL_H = GRID_Y + GRID_H + 10;
/** Encostado na borda direita, para não cobrir o jogador no centro nem a janela de Status. */
const PANEL_X = GAME_WIDTH - PANEL_W - 8;
const PANEL_Y = 96;

const SLOT_FILL = 0x1a2332;
const SLOT_STROKE = 0x3a465c;
/** Slot de equipamento ocupado por item comum (os demais usam a cor da raridade). */
const EQUIP_STROKE = 0x9aa6b8;
const TOOLTIP_WRAP = 220;
const TOOLTIP_PAD = 6;

// Aba Selos (dentro da área da grade).
const SEAL_COL_X = GRID_X + 70;
const SOCKET_SIZE = 24;
const SOCKET_GAP = 6;
const SOCKET_ROW_H = 30;
const GRADE_BTN_W = 40;
const GRADE_BTN_H = 16;
const GRADE_BTN_GAP = 2;
const STOCK_ROW_H = 20;
const MAX_STOCK_ROWS = 7;
/** Pontinhos de encaixe ao lado de cada slot da coluna de equipamentos. */
const PIP_SIZE = 7;
const PIP_STEP = 10;
const SELECT_STROKE = 0xffd76a;
const CAN_SOCKET_STROKE = 0x7dff8a;

interface SlotView {
  rect: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  qty?: Phaser.GameObjects.Text;
}

type Tab = 'items' | 'seals';

type Hover =
  | { kind: 'inventory'; index: number }
  | { kind: 'equip'; slot: EquipSlot }
  | { kind: 'socket'; slot: EquipSlot; index: number }
  | { kind: 'seal'; ref: SealRef };

const refKey = (ref: SealRef) => `${ref.sealId}:${ref.grade}`;
const socketKey = (slot: EquipSlot, index: number) => `${slot}:${index}`;

export class InventoryWindow {
  private readonly panel: Panel;
  private readonly slots: SlotView[] = [];
  private readonly equipSlots = new Map<EquipSlot, SlotView>();
  private readonly tooltip: Phaser.GameObjects.Container;
  private readonly tooltipBg: Phaser.GameObjects.Rectangle;
  private readonly tooltipText: Phaser.GameObjects.Text;
  private hover: Hover | null = null;
  private signature = '';
  private currencyText!: Phaser.GameObjects.Text;
  private tab: Tab = 'items';
  /** Selo escolhido no estojo, esperando um clique num encaixe. */
  private selected: SealRef | null = null;
  /** Botões das abas, pontinhos de encaixe e conteúdo da aba Selos: reconstruídos quando mudam. */
  private readonly tabLayer: Phaser.GameObjects.Container;
  private readonly pipLayer: Phaser.GameObjects.Container;
  private readonly sealLayer: Phaser.GameObjects.Container;
  private readonly socketRects = new Map<string, Phaser.GameObjects.Rectangle>();
  private readonly sealRects = new Map<string, Phaser.GameObjects.Rectangle>();

  constructor(private readonly scene: Phaser.Scene) {
    this.panel = new Panel(scene, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 'Inventário', () => this.toggle(false));
    this.build();
    this.tabLayer = this.panel.add(scene.add.container(0, 0));
    this.pipLayer = this.panel.add(scene.add.container(0, 0));
    this.sealLayer = this.panel.add(scene.add.container(0, 0).setVisible(false));
    this.buildTabs();

    // Fora do painel e acima de tudo, com fundo próprio.
    this.tooltipBg = scene.add.rectangle(0, 0, 10, 10, 0x0b0f17, 0.96).setOrigin(0).setStrokeStyle(1, 0x8fb3ff, 0.8);
    this.tooltipText = uiText(scene, TOOLTIP_PAD, TOOLTIP_PAD, '', 11, '#ffe9a8').setWordWrapWidth(TOOLTIP_WRAP, true);
    this.tooltip = scene.add.container(0, 0, [this.tooltipBg, this.tooltipText]).setDepth(1000).setVisible(false);
  }

  private build(): void {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const index = row * COLS + col;
        const x = GRID_X + col * (SLOT_SIZE + SLOT_GAP);
        const y = GRID_Y + row * (SLOT_SIZE + SLOT_GAP);
        const view = this.slotView(x, y, true);
        this.bindSlot(view.rect, { kind: 'inventory', index }, (right) => (right ? this.toHotbar(index) : this.useItem(index)));
        this.slots.push(view);
      }
    }

    this.panel.add(uiText(this.scene, EQUIP_X, GRID_Y - 2, 'Equipado', 11, '#ffe9a8'));
    EQUIP_SLOTS.forEach((slot, i) => {
      const top = GRID_Y + 16 + i * EQUIP_STEP;
      this.panel.add(uiText(this.scene, EQUIP_X, top, EQUIP_SLOT_NAMES[slot], 10, UI_MUTED));
      const view = this.slotView(EQUIP_X + (EQUIP_COL_W - SLOT_SIZE) / 2, top + EQUIP_LABEL_H, false);
      this.bindSlot(view.rect, { kind: 'equip', slot }, (right) => {
        if (!right) this.unequipSlot(slot);
      });
      this.equipSlots.set(slot, view);
    });

    // Moeda embaixo da coluna de equipamentos (o nome vem de currency.json).
    const moneyTop = GRID_Y + 16 + EQUIP_SLOTS.length * EQUIP_STEP + 4;
    this.panel.add(uiText(this.scene, EQUIP_X, moneyTop, CURRENCY.name, 10, UI_MUTED).setWordWrapWidth(EQUIP_COL_W + 6, true));
    this.currencyText = this.panel.add(uiText(this.scene, EQUIP_X, moneyTop + 30, '', 12, CURRENCY.iconColor));
  }

  /** Abas "Itens | Selos" ao lado do título; a ativa fica destacada. */
  private buildTabs(): void {
    this.tabLayer.removeAll(true);
    const tabs: [Tab, string][] = [
      ['items', 'Itens'],
      ['seals', 'Selos'],
    ];
    let x = 104;
    for (const [tab, label] of tabs) {
      const active = this.tab === tab;
      const button = uiButton(this.scene, x, 6, label, () => this.setTab(tab), {
        size: 11,
        background: active ? '#4a6190' : '#222a38',
      });
      this.tabLayer.add(button);
      x += button.width + 4;
    }
  }

  private setTab(tab: Tab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.selected = null;
    this.hover = null;
    this.buildTabs();
    const showGrid = tab === 'items';
    for (const view of this.slots) {
      view.rect.setVisible(showGrid);
      view.icon.setVisible(showGrid && view.icon.visible);
      view.qty?.setVisible(showGrid);
    }
    this.sealLayer.setVisible(!showGrid);
    this.signature = '';
    this.refresh();
  }

  private slotView(x: number, y: number, withQuantity: boolean): SlotView {
    const rect = this.panel.add(
      this.scene.add.rectangle(x, y, SLOT_SIZE, SLOT_SIZE, SLOT_FILL).setOrigin(0).setStrokeStyle(1, SLOT_STROKE).setInteractive(),
    );
    const icon = this.panel.add(this.scene.add.image(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, '').setOrigin(0.5).setVisible(false));
    const qty = withQuantity
      ? this.panel.add(uiText(this.scene, x + SLOT_SIZE - 3, y + SLOT_SIZE - 3, '', 10).setOrigin(1, 1))
      : undefined;
    return { rect, icon, qty };
  }

  private bindSlot(rect: Phaser.GameObjects.Rectangle, hover: Hover, onClick: (rightButton: boolean) => void): void {
    rect.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      this.hover = hover;
      this.updateTooltip();
    });
    rect.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      this.hover = null;
      this.updateTooltip();
    });
    rect.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => onClick(pointer.rightButtonDown()));
  }

  /** Mostra o tooltip do slot sob o mouse, ou esconde se não houver item ali. */
  private updateTooltip(): void {
    const target = this.hover ? this.hoverTarget(this.hover) : null;
    if (!target || !this.panel.visible) {
      this.tooltip.setVisible(false);
      return;
    }
    this.tooltipText.setText(target.text);
    const w = this.tooltipText.width + TOOLTIP_PAD * 2;
    const h = this.tooltipText.height + TOOLTIP_PAD * 2;
    this.tooltipBg.setSize(w, h);
    const anchor: Rect = {
      x: this.panel.root.x + target.rect.x,
      y: this.panel.root.y + target.rect.y,
      width: target.rect.width,
      height: target.rect.height,
    };
    const pos = placeTooltip(anchor, w, h, this.scene.scale.width, this.scene.scale.height);
    this.tooltip.setPosition(pos.x, pos.y).setVisible(true);
  }

  private hoverTarget(hover: Hover): { text: string; rect: Phaser.GameObjects.Rectangle } | null {
    switch (hover.kind) {
      case 'inventory':
        return this.inventoryTooltip(hover.index);
      case 'equip':
        return this.equipTooltip(hover.slot);
      case 'socket':
        return this.socketTooltip(hover.slot, hover.index);
      case 'seal':
        return this.sealTooltip(hover.ref);
    }
  }

  private inventoryTooltip(index: number): { text: string; rect: Phaser.GameObjects.Rectangle } | null {
    const slot = playerState.inventory.slots[index];
    if (!slot || this.tab !== 'items') return null;
    const item = getItem(slot.itemId);
    const lines = [itemTooltipText(item, slot.quantity)];
    if (item.equip) {
      const hasEquipped = Boolean(playerState.equipment[item.equip.slot]);
      lines.push(equipComparisonText(playerDerived(playerState), previewEquip(playerState, item.id), hasEquipped));
      const required = item.equip.requiredLevel ?? 1;
      lines.push(playerState.level < required ? `Requer nível ${required}.` : 'Clique para equipar.');
    } else if (item.type === 'consumable') {
      lines.push('Clique para usar. Clique direito: barra de atalhos.');
    }
    return { text: lines.join('\n'), rect: this.slots[index].rect };
  }

  private equipTooltip(slot: EquipSlot): { text: string; rect: Phaser.GameObjects.Rectangle } | null {
    const itemId = playerState.equipment[slot];
    const view = this.equipSlots.get(slot);
    if (!itemId || !view) return null;
    const lines = [itemTooltipText(getItem(itemId))];
    const sockets = socketsOf(playerState.equipmentSeals, slot, sealCapacity(playerState, slot));
    if (sockets.length > 0) {
      lines.push(`Selos: ${sockets.map((r) => (r ? sealName(r) : 'vazio')).join(', ')} (aba Selos)`);
    }
    lines.push(sockets.some(Boolean) ? 'Clique para remover (os Selos voltam ao estojo).' : 'Clique para remover.');
    return { text: lines.join('\n'), rect: view.rect };
  }

  private socketTooltip(slot: EquipSlot, index: number): { text: string; rect: Phaser.GameObjects.Rectangle } | null {
    const rect = this.socketRects.get(socketKey(slot, index));
    if (!rect) return null;
    const current = socketsOf(playerState.equipmentSeals, slot, sealCapacity(playerState, slot))[index];
    if (current) return { text: `${sealTooltipText(current)}\nClique para remover.`, rect };
    const lines = ['Encaixe vazio.'];
    const selected = this.selected;
    if (!selected) {
      lines.push('Escolha um Selo no estojo e clique aqui.');
    } else if (!canSealGoInSlot(getSeal(selected.sealId), slot)) {
      lines.push(`${sealName(selected)} não encaixa em ${EQUIP_SLOT_NAMES[slot]}.`);
    } else {
      const after = previewSocket(playerState, selected, slot, index);
      if (after) lines.push(equipComparisonText(playerDerived(playerState), after, false, `Ao encaixar ${sealName(selected)}`));
      lines.push('Clique para encaixar.');
    }
    return { text: lines.join('\n'), rect };
  }

  private sealTooltip(ref: SealRef): { text: string; rect: Phaser.GameObjects.Rectangle } | null {
    const rect = this.sealRects.get(refKey(ref));
    if (!rect) return null;
    const count = sealCount(playerState.seals, ref);
    const lines = [sealTooltipText(ref, count)];
    // Prévia no primeiro equipamento vestido que aceita o Selo e tem encaixe livre.
    for (const slot of EQUIP_SLOTS) {
      const after = count > 0 ? previewSocket(playerState, ref, slot) : null;
      if (after) {
        lines.push(equipComparisonText(playerDerived(playerState), after, false, `Em ${EQUIP_SLOT_NAMES[slot]}`));
        break;
      }
    }
    if (count > 0) lines.push('Clique para escolher; depois clique num encaixe.');
    return { text: lines.join('\n'), rect };
  }

  private useItem(index: number): void {
    if (this.tab !== 'items') return;
    this.report(useSlot(playerState, index));
  }

  private toHotbar(index: number): void {
    if (this.tab !== 'items') return;
    this.report(assignSlotToHotbar(playerState, index));
  }

  private unequipSlot(slot: EquipSlot): void {
    this.report(unequip(playerState, slot));
  }

  private clickSocket(slot: EquipSlot, index: number): void {
    const current = socketsOf(playerState.equipmentSeals, slot, sealCapacity(playerState, slot))[index];
    if (current && !this.selected) {
      this.report(removeSealFrom(playerState, slot, index));
      return;
    }
    if (!this.selected) {
      gameEvents.emit('notify', { text: 'Escolha um Selo no estojo e clique no encaixe.', color: UI_MUTED });
      return;
    }
    const result = socketSealInto(playerState, this.selected, slot, index);
    // Acabaram os Selos daquele tipo e grau: desmarca.
    if (result.ok && sealCount(playerState.seals, this.selected) === 0) this.selected = null;
    this.report(result);
  }

  private clickSeal(ref: SealRef): void {
    if (sealCount(playerState.seals, ref) === 0) return;
    const same = this.selected?.sealId === ref.sealId && this.selected.grade === ref.grade;
    this.selected = same ? null : ref;
    this.signature = '';
    this.refresh();
  }

  private fuseSelected(): void {
    const ref = this.selected;
    if (!ref) return;
    const result = fuseSealStock(playerState, ref.sealId, ref.grade);
    if (result.ok && sealCount(playerState.seals, ref) === 0) this.selected = null;
    this.report(result);
  }

  private report(result: ActionResult): void {
    if (result.message) gameEvents.emit('notify', { text: result.message, color: result.ok ? UI_TEXT : UI_BAD });
    this.refresh();
  }

  toggle(visible?: boolean): void {
    this.panel.setVisible(visible ?? !this.panel.visible);
    // Esconder o painel não dispara pointerout: limpa o hover na mão.
    this.hover = null;
    this.selected = null;
    this.tooltip.setVisible(false);
    this.signature = '';
    this.refresh();
  }

  get visible(): boolean {
    return this.panel.visible;
  }

  /** Chamado a cada frame; só mexe nos objetos se o inventário, o equipamento ou os Selos mudaram. */
  refresh(): void {
    if (!this.panel.visible) return;
    const money = `${playerState.currency}`;
    if (this.currencyText.text !== money) this.currencyText.setText(money);
    const selected = this.selected ? refKey(this.selected) : '';
    const signature = `${inventorySignature(playerState)}|${sealsSignature(playerState.seals, playerState.equipmentSeals)}|${this.tab}|${selected}`;
    if (signature === this.signature) return;
    this.signature = signature;

    const showGrid = this.tab === 'items';
    const inv = playerState.inventory;
    this.slots.forEach((view, i) => {
      const slot = inv.slots[i];
      this.setIcon(view, slot?.itemId, SLOT_STROKE);
      if (!showGrid) view.icon.setVisible(false);
      view.qty?.setText(slot && slot.quantity > 1 ? `${slot.quantity}` : '');
    });
    for (const [slot, view] of this.equipSlots) this.setIcon(view, playerState.equipment[slot], EQUIP_STROKE);
    this.buildPips();
    if (!showGrid) this.buildSealTab();
    // O slot sob o mouse pode ter mudado (item usado até acabar, equipado, removido).
    this.updateTooltip();
  }

  /** Um pontinho por encaixe ao lado de cada equipamento vestido: vazio ou na cor do elemento do Selo. */
  private buildPips(): void {
    this.pipLayer.removeAll(true);
    EQUIP_SLOTS.forEach((slot, i) => {
      const top = GRID_Y + 16 + i * EQUIP_STEP + EQUIP_LABEL_H + 2;
      socketsOf(playerState.equipmentSeals, slot, sealCapacity(playerState, slot)).forEach((ref, j) => {
        const x = EQUIP_X + EQUIP_COL_W - PIP_SIZE;
        const pip = this.scene.add.rectangle(x, top + j * PIP_STEP, PIP_SIZE, PIP_SIZE, SLOT_FILL).setOrigin(0);
        if (ref) pip.setFillStyle(ELEMENT_COLORS[getSeal(ref.sealId).element]).setStrokeStyle(1, 0x10151f);
        else pip.setStrokeStyle(1, EQUIP_STROKE);
        this.pipLayer.add(pip);
      });
    });
  }

  private buildSealTab(): void {
    this.sealLayer.removeAll(true);
    this.socketRects.clear();
    this.sealRects.clear();
    const add = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      this.sealLayer.add(obj);
      return obj;
    };
    const scene = this.scene;
    let y = GRID_Y - 2;

    // Encaixes do equipamento vestido.
    add(uiText(scene, GRID_X, y, 'Encaixes', 11, '#ffe9a8'));
    y += 16;
    let anySocket = false;
    for (const slot of EQUIP_SLOTS) {
      const sockets = socketsOf(playerState.equipmentSeals, slot, sealCapacity(playerState, slot));
      if (sockets.length === 0) continue;
      anySocket = true;
      add(uiText(scene, GRID_X, y + 6, EQUIP_SLOT_NAMES[slot], 10, UI_MUTED));
      sockets.forEach((ref, i) => {
        const x = SEAL_COL_X + i * (SOCKET_SIZE + SOCKET_GAP);
        const rect = add(scene.add.rectangle(x, y, SOCKET_SIZE, SOCKET_SIZE, SLOT_FILL).setOrigin(0).setInteractive());
        if (ref) {
          const color = ELEMENT_COLORS[getSeal(ref.sealId).element];
          rect.setFillStyle(color, 0.35).setStrokeStyle(2, color);
          add(uiText(scene, x + SOCKET_SIZE / 2, y + SOCKET_SIZE / 2, GRADE_NAMES[ref.grade], 10).setOrigin(0.5));
        } else {
          const canSocket = this.selected && canSealGoInSlot(getSeal(this.selected.sealId), slot);
          rect.setStrokeStyle(canSocket ? 2 : 1, canSocket ? CAN_SOCKET_STROKE : SLOT_STROKE);
        }
        this.socketRects.set(socketKey(slot, i), rect);
        this.bindSlot(rect, { kind: 'socket', slot, index: i }, (right) => {
          if (!right) this.clickSocket(slot, i);
        });
      });
      y += SOCKET_ROW_H;
    }
    if (!anySocket) {
      add(uiText(scene, GRID_X, y, 'Nenhum equipamento vestido tem encaixe.', 10, UI_MUTED).setWordWrapWidth(GRID_W, true));
      y += 28;
    }

    // Estojo: um Selo por linha, um botão por grau.
    y += 4;
    add(uiText(scene, GRID_X, y, 'Estojo', 11, '#ffe9a8'));
    y += 16;
    const rows = stockRows(playerState.seals);
    if (rows.length === 0) {
      add(uiText(scene, GRID_X, y, 'Sem Selos. Cada abate dá fragmentos; veja o progresso no Bestiário (B).', 10, UI_MUTED).setWordWrapWidth(GRID_W, true));
      y += 40;
    }
    for (const row of rows.slice(0, MAX_STOCK_ROWS)) {
      const seal = getSeal(row.sealId);
      const shortName = seal.name.replace(/^Selo d[eoa] /, '');
      add(uiText(scene, GRID_X, y + 2, shortName, 10, elementCss(seal.element)).setWordWrapWidth(SEAL_COL_X - GRID_X - 2, true));
      SEAL_GRADES.forEach((grade, i) => this.gradeButton(add, row.sealId, grade, row.counts[grade], SEAL_COL_X + i * (GRADE_BTN_W + GRADE_BTN_GAP), y));
      y += STOCK_ROW_H;
    }
    if (rows.length > MAX_STOCK_ROWS) {
      add(uiText(scene, GRID_X, y, `+${rows.length - MAX_STOCK_ROWS} tipos de Selo`, 10, UI_MUTED));
      y += 14;
    }

    // Fusão do Selo escolhido.
    const sel = this.selected;
    if (sel) {
      const cost = SEALS_DATA.fusionCost;
      const canFuse = sel.grade < MAX_SEAL_GRADE && sealCount(playerState.seals, sel) >= cost;
      const label =
        sel.grade < MAX_SEAL_GRADE
          ? `Fundir ${cost}× ${GRADE_NAMES[sel.grade]} → ${GRADE_NAMES[(sel.grade + 1) as SealGrade]}`
          : 'Grau máximo';
      add(uiButton(scene, GRID_X, y + 2, label, () => this.fuseSelected(), { size: 10, enabled: canFuse }));
      y += 22;
    }

    // Ressonâncias ativas.
    y += 2;
    const resonances = activeResonanceLines(playerState.equipmentSeals);
    if (resonances.length === 0) {
      add(uiText(scene, GRID_X, y, 'Ressonância: encaixe 2+ Selos do mesmo elemento ou família.', 10, UI_MUTED).setWordWrapWidth(GRID_W, true));
    } else {
      for (const line of resonances) {
        const text = add(uiText(scene, GRID_X, y, line, 10, '#ffd76a').setWordWrapWidth(GRID_W, true));
        y += text.height + 2;
      }
    }
  }

  private gradeButton(
    add: <T extends Phaser.GameObjects.GameObject>(obj: T) => T,
    sealId: string,
    grade: SealGrade,
    count: number,
    x: number,
    y: number,
  ): void {
    const ref: SealRef = { sealId, grade };
    const selected = this.selected?.sealId === sealId && this.selected.grade === grade;
    const rect = add(this.scene.add.rectangle(x, y, GRADE_BTN_W, GRADE_BTN_H, count > 0 ? 0x2d3b55 : SLOT_FILL).setOrigin(0).setInteractive());
    rect.setStrokeStyle(selected ? 2 : 1, selected ? SELECT_STROKE : SLOT_STROKE);
    add(uiText(this.scene, x + GRADE_BTN_W / 2, y + GRADE_BTN_H / 2, `${GRADE_NAMES[grade]}×${count}`, 10, count > 0 ? UI_TEXT : UI_MUTED).setOrigin(0.5));
    this.sealRects.set(refKey(ref), rect);
    this.bindSlot(rect, { kind: 'seal', ref }, (right) => {
      if (!right) this.clickSeal(ref);
    });
  }

  /** Ícone sem tint; a raridade aparece na borda (itens comuns usam `commonStroke`). */
  private setIcon(view: SlotView, itemId: string | undefined, commonStroke: number): void {
    if (!itemId) {
      view.icon.setVisible(false);
      view.rect.setStrokeStyle(1, SLOT_STROKE);
      return;
    }
    const item = getItem(itemId);
    view.icon.setTexture(getItemIcon(this.scene, item)).setVisible(true);
    if (item.rarity === 'common') view.rect.setStrokeStyle(1, commonStroke);
    else view.rect.setStrokeStyle(2, RARITY_COLORS[item.rarity]);
  }
}
