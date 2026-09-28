// Barras de HP/SP/EXP, nível, aviso de Fadiga e dica de teclas.

import Phaser from 'phaser';
import { EXP_TABLE, getClass } from '../data';
import { KEYS } from '../gameplay/config';
import { playerDerived, playerState } from '../gameplay/playerState';
import { settings } from '../gameplay/settings';
import { expProgressRatio, fatigueRemainingMs } from '../systems/exp';
import { availableStatPoints } from '../systems/stats';
import { fatiguePenaltyPercent, formatTime } from './format';
import { uiText } from './widgets';

const BAR_W = 180;
const BAR_H = 14;
const BOX_X = 4;
const BOX_Y = 32; // abaixo do nome do mapa (Hud da engine, y = 8, 14 px)
const BOX_W = BAR_W + 80;
const BOX_H = 100;

interface Bar {
  bg: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  tooltip?: Phaser.GameObjects.Text;
}

export function keyHint(autoPickup: boolean, muted = false): string {
  // Curto: divide o rodapé com a dica de controles da engine (Hud.ts), alinhada à esquerda.
  return `${KEYS.stats} Status · ${KEYS.inventory} Inventário · ${KEYS.bestiary} Bestiário · ${KEYS.autoPickup} Auto [${autoPickup ? 'ON' : 'OFF'}] · ${KEYS.mute} Som [${muted ? 'OFF' : 'ON'}]`;
}

export class PlayerHud {
  private readonly levelLabel: Phaser.GameObjects.Text;
  private readonly hp: Bar;
  private readonly sp: Bar;
  private readonly exp: Bar;
  private readonly fatigue: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    const x = BOX_X + 4;
    const y = BOX_Y + 4;
    // Interativo para "consumir" cliques: clicar no HUD não move o jogador.
    scene.add.rectangle(BOX_X, BOX_Y, BOX_W, BOX_H, 0x10151f, 0.55).setOrigin(0).setInteractive();
    this.levelLabel = uiText(scene, x, y, '', 13, '#ffe9a8');
    this.hp = this.bar(x, y + 20, 'HP', 0x5fd35a);
    this.sp = this.bar(x, y + 36, 'SP', 0x4f9bff);
    this.exp = this.bar(x, y + 52, 'EXP', 0xb68cff);
    this.fatigue = uiText(scene, x, y + 67, '', 12, '#ff9f6b');
    // Também "consome" cliques; o Text ajusta a área de clique quando o texto muda.
    this.hint = uiText(scene, scene.scale.width - 8, scene.scale.height - 8, keyHint(playerState.autoPickup), 12)
      .setOrigin(1, 1)
      .setAlpha(0.85)
      .setInteractive();
  }

  private bar(x: number, y: number, name: string, color: number): Bar {
    const scene = this.scene;
    uiText(scene, x, y - 2, name, 11, '#c8d2e0');
    const bg = scene.add.rectangle(x + 30, y, BAR_W, BAR_H, 0x0a0e15, 0.9).setOrigin(0).setStrokeStyle(1, 0x3a465c);
    const fill = scene.add.rectangle(x + 31, y + 1, BAR_W - 2, BAR_H - 2, color, 1).setOrigin(0);
    const label = uiText(scene, x + 34 + BAR_W, y + 1, '', 11);

    // Tooltip para números exatos ao passar mouse
    const tooltip = uiText(scene, x + 30 + BAR_W / 2, y + BAR_H + 4, '', 10, '#ffe9a8').setOrigin(0.5, 0).setVisible(false);
    bg.setInteractive();
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => tooltip.setVisible(true));
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => tooltip.setVisible(false));

    return { bg, fill, label, tooltip };
  }

  private setBar(bar: Bar, ratio: number, label: string, tooltipText?: string): void {
    bar.fill.width = Math.max(0, Math.min(1, ratio)) * (BAR_W - 2);
    bar.label.setText(label);
    if (bar.tooltip && tooltipText) bar.tooltip.setText(tooltipText);
  }

  update(): void {
    const s = playerState;
    const d = playerDerived(s);
    const points = availableStatPoints(s.level, s.stats);
    this.levelLabel.setText(`Nv ${s.level}  ${getClass(s.classId).name}${points > 0 ? `   (+${points} pts: ${KEYS.stats})` : ''}`);

    this.setBar(this.hp, s.hp / d.maxHp, `${s.hp}/${d.maxHp}`, `HP: ${s.hp} / ${d.maxHp}`);
    this.setBar(this.sp, s.sp / d.maxSp, `${s.sp}/${d.maxSp}`, `SP: ${s.sp} / ${d.maxSp}`);

    const ratio = expProgressRatio({ level: s.level, exp: s.exp }, EXP_TABLE);
    const expText = s.level >= EXP_TABLE.maxLevel ? 'MAX' : `${(ratio * 100).toFixed(1)}%`;
    const expTooltip = s.level >= EXP_TABLE.maxLevel ? 'Nível máximo' : `EXP: ${s.exp} / ${EXP_TABLE.expToNext[s.level - 1] ?? 0}`;
    this.setBar(this.exp, ratio, expText, expTooltip);

    const remaining = fatigueRemainingMs(s.fatigue, Date.now());
    this.fatigue.setText(remaining > 0 ? `Fadiga ${formatTime(remaining)}  (−${fatiguePenaltyPercent()}% EXP)` : '');
    this.hint.setText(keyHint(s.autoPickup, settings.audio.muted));
  }
}
