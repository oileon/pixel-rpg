// Cena de interface que roda por cima dos mapas durante todo o jogo: HUD, janelas e avisos.
// Fica acima das cenas de mapa, então cliques nas janelas e no HUD não chegam ao mundo.

import Phaser from 'phaser';
import { HOTBAR_KEYS, KEYS, NEW_GAME_CONFIRM_MS } from '../gameplay/config';
import '../gameplay/events';
import { playerState, setAutoPickup } from '../gameplay/playerState';
import { newGame, takeBootNotices } from '../gameplay/saveGame';
import type { WorldScene } from '../scenes/WorldScene';
import { gameEvents } from '../systems/events';
import { session } from '../systems/session';
import { BestiaryWindow } from './BestiaryWindow';
import { Hotbar, HOTBAR_TOP } from './Hotbar';
import { ensureItemIcons } from './itemIcons';
import { InventoryWindow } from './InventoryWindow';
import { onKeyPress } from './keys';
import { Minimap } from './Minimap';
import { PlayerHud } from './PlayerHud';
import { StatsWindow } from './StatsWindow';
import { uiText } from './widgets';

export const UI_SCENE_KEY = 'ui';

/**
 * Avisos ficam logo acima da barra de atalhos, e estreitos o bastante (centro ± NOTICE_WRAP/2) para não
 * passar por baixo do Inventário, que fica à direita.
 */
const NOTICE_BOTTOM = HOTBAR_TOP - 8;
const NOTICE_LINE = 18;
const MAX_NOTICES = 2;
const NOTICE_WRAP = 340;
/** Anúncio de nível no topo, acima das janelas (que começam em y = 96). */
const BANNER_Y = 50;

export class UIScene extends Phaser.Scene {
  private hud!: PlayerHud;
  private stats!: StatsWindow;
  private inventory!: InventoryWindow;
  private bestiary!: BestiaryWindow;
  private hotbar!: Hotbar;
  private minimap!: Minimap;
  /** Momento do primeiro F10; o segundo dentro de NEW_GAME_CONFIRM_MS apaga o save. */
  private newGameArmedAt = -Infinity;
  private notices: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: UI_SCENE_KEY });
  }

  create(): void {
    ensureItemIcons(this);
    this.hud = new PlayerHud(this);
    this.stats = new StatsWindow(this);
    this.inventory = new InventoryWindow(this);
    this.bestiary = new BestiaryWindow(this);
    this.hotbar = new Hotbar(this);
    this.minimap = new Minimap(this);
    // A UIScene é lançada no primeiro `mapEntered`, então o minimapa perde esse evento.
    const world = session.currentMapId ? (this.scene.get(session.currentMapId) as WorldScene | null) : null;
    if (world?.mapDef) this.minimap.setWorld(world);

    const keyboard = this.input.keyboard;
    if (keyboard) {
      // O Bestiário fica no centro e cobre as outras duas janelas: abrir um fecha o outro lado.
      onKeyPress(keyboard, KEYS.stats, () => {
        this.bestiary.toggle(false);
        this.stats.toggle();
      });
      onKeyPress(keyboard, KEYS.inventory, () => {
        this.bestiary.toggle(false);
        this.inventory.toggle();
      });
      onKeyPress(keyboard, KEYS.bestiary, () => {
        const open = !this.bestiary.visible;
        if (open) {
          this.stats.toggle(false);
          this.inventory.toggle(false);
        }
        this.bestiary.toggle(open);
      });
      onKeyPress(keyboard, KEYS.autoPickup, () => {
        setAutoPickup(playerState, !playerState.autoPickup);
        this.notify(`Auto-pegar: ${playerState.autoPickup ? 'ligado' : 'desligado'}`);
      });
      HOTBAR_KEYS.forEach((key, i) => onKeyPress(keyboard, key, () => this.hotbar.use(i)));
      // Sem captura, F10 abre o menu do navegador no Windows e o segundo toque não chega.
      keyboard.addCapture(KEYS.newGame);
      onKeyPress(keyboard, KEYS.newGame, () => this.confirmNewGame());
      onKeyPress(keyboard, KEYS.close, () => {
        this.stats.toggle(false);
        this.inventory.toggle(false);
        this.bestiary.toggle(false);
      });
    }

    for (const { text, color } of takeBootNotices()) this.notify(text, color);
    gameEvents.onScene(this, 'notify', ({ text, color }) => this.notify(text, color));
    gameEvents.onScene(this, 'levelUp', ({ level, statPoints }) => this.showLevelUp(level, statPoints));
  }

  override update(time: number): void {
    this.hud.update();
    this.stats.refresh();
    this.inventory.refresh();
    this.bestiary.refresh();
    this.hotbar.refresh();
    this.minimap.update(time);
  }

  private confirmNewGame(): void {
    const now = this.time.now;
    if (now - this.newGameArmedAt <= NEW_GAME_CONFIRM_MS) {
      newGame();
      return;
    }
    this.newGameArmedAt = now;
    this.notify(`Aperte ${KEYS.newGame} de novo para apagar o save e começar um jogo novo.`, '#ffb3b3');
  }

  notify(text: string, color = '#ffffff'): void {
    const label = uiText(this, this.scale.width / 2, NOTICE_BOTTOM, text, 14, color)
      .setOrigin(0.5, 1)
      .setAlign('center')
      .setWordWrapWidth(NOTICE_WRAP);
    // Os anteriores sobem; só os mais recentes ficam visíveis.
    for (const old of this.notices) old.y -= Math.max(NOTICE_LINE, label.height);
    this.notices.unshift(label);
    for (const old of this.notices.splice(MAX_NOTICES)) {
      this.tweens.killTweensOf(old);
      old.destroy();
    }
    this.tweens.add({
      targets: label,
      alpha: 0,
      delay: 2200,
      duration: 500,
      onComplete: () => {
        this.notices = this.notices.filter((n) => n !== label);
        label.destroy();
      },
    });
  }

  private showLevelUp(level: number, statPoints: number): void {
    const cx = this.scale.width / 2;
    const title = uiText(this, cx, BANNER_Y, `Nível ${level}!`, 26, '#ffe066').setOrigin(0.5);
    const sub = uiText(this, cx, BANNER_Y + 26, `+${statPoints} pontos de status (tecla ${KEYS.stats})`, 13, '#fff2b3').setOrigin(0.5);
    title.setScale(0.4);
    this.tweens.add({ targets: title, scale: 1, duration: 350, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: [title, sub],
      alpha: 0,
      delay: 2400,
      duration: 600,
      onComplete: () => {
        title.destroy();
        sub.destroy();
      },
    });
  }
}
