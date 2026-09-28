// Camada de retorno visual/sonoro por cima do HUD (na UIScene): contador de moeda, bolsa, loot que
// voa do mundo até o HUD e teclas de som (mudo/volume). Criada por gameplay/install.ts.

import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { CURRENCY, FEEL, getItem } from '../data';
import type { ScreenPoint } from '../data/types';
import { KEYS } from '../gameplay/config';
import '../gameplay/events';
import { playerState } from '../gameplay/playerState';
import { saveGame } from '../gameplay/saveGame';
import { settings, updateSettings } from '../gameplay/settings';
import { stepVolume, toggleMute } from '../systems/audio';
import { gameEvents } from '../systems/events';
import { coinParticleCount, flightPoint, PendingCounter, splitAmount } from '../systems/feel';
import { onCharPress, onKeyPress } from './keys';
import { getItemIcon } from './itemIcons';
import { uiText } from './widgets';

/** Acima do HUD e das janelas da UIScene. */
const FLY_DEPTH = 5000;
const COIN_RADIUS = 5;
const FRAGMENT_COLOR = 0xc9a7ff;

type LootKind = 'currency' | 'item' | 'fragment';

export class FeedbackLayer {
  private readonly pending = new PendingCounter();
  private readonly coinIcon: Phaser.GameObjects.Arc;
  private readonly coinText: Phaser.GameObjects.Text;
  private readonly bag: Phaser.GameObjects.Container;
  private shownCurrency = -1;

  constructor(private readonly scene: Phaser.Scene) {
    const cfg = FEEL.lootFly;
    const coinColor = Phaser.Display.Color.HexStringToColor(CURRENCY.iconColor).color;
    this.coinIcon = scene.add.circle(cfg.coinTarget.x, cfg.coinTarget.y, COIN_RADIUS, coinColor).setStrokeStyle(1, 0x7a5a10);
    this.coinText = uiText(scene, cfg.coinTarget.x - COIN_RADIUS - 4, cfg.coinTarget.y, '', 11, CURRENCY.iconColor).setOrigin(1, 0.5);
    this.bag = this.createBag(cfg.bagTarget);

    gameEvents.onScene(scene, 'lootCollected', (e) => this.fly(e.kind, e.amount, { x: e.screenX, y: e.screenY }, e.itemId));
    gameEvents.onScene(scene, 'levelUp', () => playSfx('levelUp'));

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      onKeyPress(keyboard, KEYS.mute, () => this.setAudio(toggleMute(settings.audio)));
      onCharPress(keyboard, KEYS.volumeDown, () => this.setAudio(stepVolume(settings.audio, -FEEL.audio.volumeStep)));
      onCharPress(keyboard, KEYS.volumeUp, () => this.setAudio(stepVolume(settings.audio, FEEL.audio.volumeStep)));
    }

    const onUpdate = () => this.update();
    scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
  }

  private update(): void {
    const value = this.pending.display(playerState.currency);
    if (value === this.shownCurrency) return;
    this.shownCurrency = value;
    this.coinText.setText(value.toLocaleString('pt-BR'));
  }

  private setAudio(audio: typeof settings.audio): void {
    updateSettings({ audio });
    saveGame();
    const text = audio.muted ? `Som desligado (${KEYS.mute})` : `Som: ${Math.round(audio.volume * 100)}%`;
    gameEvents.emit('notify', { text });
  }

  /** Bolsa desenhada no canto inferior direito: destino dos itens pegos. */
  private createBag(at: ScreenPoint): Phaser.GameObjects.Container {
    const g = this.scene.add.graphics();
    g.fillStyle(0x10151f, 0.55).fillRoundedRect(-16, -16, 32, 32, 6);
    g.fillStyle(0x8a5a32, 1).fillRoundedRect(-9, -6, 18, 15, 4);
    g.fillStyle(0xb07a44, 1).fillRoundedRect(-9, -6, 18, 6, 3);
    g.lineStyle(2, 0x5a3a1e, 1).strokeRoundedRect(-9, -6, 18, 15, 4);
    g.lineStyle(2, 0x5a3a1e, 1).strokeCircle(0, -9, 4);
    const label = uiText(this.scene, 10, 8, KEYS.inventory, 9, '#c8d2e0').setOrigin(0.5);
    const bag = this.scene.add.container(at.x, at.y, [g, label]);
    // "Consome" cliques para não mover o jogador.
    bag.setSize(32, 32).setInteractive();
    return bag;
  }

  private fly(kind: LootKind, amount: number, from: ScreenPoint, itemId?: string): void {
    const cfg = FEEL.lootFly;
    if (kind === 'currency') {
      const shares = splitAmount(amount, coinParticleCount(amount, cfg));
      this.pending.add(amount);
      shares.forEach((share, i) =>
        this.launch(this.coinParticle(from), from, cfg.coinTarget, i, () => {
          this.pending.settle(share);
          playSfx('coin');
          this.bump(this.coinIcon);
        }),
      );
    } else if (kind === 'fragment') {
      for (let i = 0; i < cfg.fragmentParticles; i++) {
        const shard = this.scene.add.rectangle(from.x, from.y, 5, 5, FRAGMENT_COLOR).setAngle(45).setStrokeStyle(1, 0xffffff, 0.8);
        this.launch(shard, from, cfg.fragmentTarget, i, () => undefined);
      }
    } else if (itemId) {
      const icon = this.scene.add.image(from.x, from.y, getItemIcon(this.scene, getItem(itemId)));
      this.launch(icon, from, cfg.bagTarget, 0, () => this.bump(this.bag));
    }
  }

  private coinParticle(at: ScreenPoint): Phaser.GameObjects.Arc {
    const color = Phaser.Display.Color.HexStringToColor(CURRENCY.iconColor).color;
    return this.scene.add.circle(at.x, at.y, 4, color).setStrokeStyle(1, 0x7a5a10);
  }

  /** Voo em arco com um pequeno espalhamento inicial, chegando menor ao destino. */
  private launch(
    obj: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth,
    from: ScreenPoint,
    to: ScreenPoint,
    index: number,
    onArrive: () => void,
  ): void {
    const cfg = FEEL.lootFly;
    obj.setDepth(FLY_DEPTH);
    const start = { x: from.x + Phaser.Math.Between(-8, 8), y: from.y + Phaser.Math.Between(-6, 4) };
    obj.setPosition(start.x, start.y);
    const clock = { t: 0 };
    this.scene.tweens.add({
      targets: clock,
      t: 1,
      delay: index * cfg.staggerMs,
      duration: cfg.durationMs,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const p = flightPoint(start, to, cfg.arcPx, clock.t);
        obj.setPosition(p.x, p.y);
        obj.setScale(1 + (cfg.endScale - 1) * clock.t);
      },
      onComplete: () => {
        obj.destroy();
        onArrive();
      },
    });
  }

  private bump(target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject): void {
    this.scene.tweens.killTweensOf(target);
    target.setScale(1.35);
    this.scene.tweens.add({ targets: target, scale: 1, duration: 160, ease: 'Quad.easeOut' });
  }
}
