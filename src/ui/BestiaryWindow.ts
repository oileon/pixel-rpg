// Bestiário (tecla B): lista de monstros à esquerda e a entrada escolhida à direita, revelada aos poucos
// (visto → 1 abate → 10 abates → Selo obtido). Monstro nunca visto aparece como silhueta e "???".
// Só reconstrói quando o bestiário, os fragmentos ou a escolha mudam.

import Phaser from 'phaser';
import { getVisual, textureKey } from '../assets/manifest';
import { MONSTERS } from '../data';
import type { MonsterDef } from '../data/types';
import { playerState } from '../gameplay/playerState';
import { seenCount } from '../systems/bestiary';
import { bestiaryDetail, bestiaryListName } from './sealView';
import { Panel, UI_MUTED, UI_TEXT, uiText } from './widgets';

const PANEL_W = 430;
const PANEL_H = 400;
/** Centralizado, à direita do HUD do jogador (x 4–264). */
const PANEL_X = 270;
const PANEL_Y = 70;
const LIST_X = 10;
const LIST_Y = 34;
const LIST_W = 120;
const ROW_H = 22;
const DETAIL_X = LIST_X + LIST_W + 10;
const DETAIL_W = PANEL_W - DETAIL_X - 10;
const PORTRAIT = 80;
const SILHOUETTE = 0x3a465c;

/** Monstros em ordem de nível (a ordem do bestiário). */
const ORDERED: readonly MonsterDef[] = [...MONSTERS].sort((a, b) => a.level - b.level);

export class BestiaryWindow {
  private readonly panel: Panel;
  private selected = 0;
  private signature = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.panel = new Panel(scene, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 'Bestiário', () => this.toggle(false));
  }

  get visible(): boolean {
    return this.panel.visible;
  }

  toggle(visible?: boolean): void {
    this.panel.setVisible(visible ?? !this.panel.visible);
    this.signature = '';
    this.refresh();
  }

  refresh(): void {
    if (!this.panel.visible) return;
    const signature = `${JSON.stringify(playerState.bestiary)}|${JSON.stringify(playerState.sealFragments)}|${this.selected}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.rebuild();
  }

  private rebuild(): void {
    const scene = this.scene;
    this.panel.clear();
    const seen = seenCount(playerState.bestiary, ORDERED.map((m) => m.id));
    this.panel.add(uiText(scene, 110, 10, `Vistos ${seen}/${ORDERED.length}`, 11, UI_MUTED));

    ORDERED.forEach((monster, i) => {
      const y = LIST_Y + i * ROW_H;
      const entry = playerState.bestiary[monster.id];
      const active = i === this.selected;
      const row = this.panel.add(
        scene.add
          .rectangle(LIST_X, y, LIST_W, ROW_H - 2, active ? 0x2d3b55 : 0x1a2332)
          .setOrigin(0)
          .setStrokeStyle(1, active ? 0xffd76a : 0x3a465c)
          .setInteractive({ useHandCursor: true }),
      );
      row.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.selected = i;
        this.refresh();
      });
      this.panel.add(uiText(scene, LIST_X + 4, y + 3, bestiaryListName(monster, entry), 11, entry ? UI_TEXT : UI_MUTED));
      if (entry) this.panel.add(uiText(scene, LIST_X + LIST_W - 4, y + 4, `${entry.kills}`, 10, UI_MUTED).setOrigin(1, 0));
    });

    const monster = ORDERED[this.selected];
    if (!monster) return;
    const detail = bestiaryDetail(monster, playerState.bestiary[monster.id], playerState.sealFragments[monster.sealId] ?? 0);

    this.panel.add(scene.add.rectangle(DETAIL_X, LIST_Y, PORTRAIT, PORTRAIT, 0x10151f).setOrigin(0).setStrokeStyle(1, 0x3a465c));
    const portrait = this.portrait(monster.id, DETAIL_X + PORTRAIT / 2, LIST_Y + PORTRAIT / 2);
    if (portrait) {
      if (detail.silhouette) portrait.setTintFill(SILHOUETTE);
      this.panel.add(portrait);
    }
    this.panel.add(uiText(scene, DETAIL_X + PORTRAIT + 10, LIST_Y + 4, detail.title, 16, '#ffe9a8'));

    let y = LIST_Y + PORTRAIT + 8;
    for (const line of detail.lines) {
      const text = this.panel.add(uiText(scene, DETAIL_X, y, line.text, 10, line.color ?? UI_TEXT).setWordWrapWidth(DETAIL_W, true));
      y += text.height + 3;
    }
  }

  /** Pose parada virada para o sul (sheet → rotação → placeholder), recortada na moldura. */
  private portrait(monsterId: string, x: number, y: number): Phaser.GameObjects.Image | null {
    const visual = getVisual(monsterId);
    const src = visual.source;
    const textures = this.scene.textures;
    let image: Phaser.GameObjects.Image | null = null;
    if (src.kind === 'sheet' && textures.exists(textureKey.sheet(visual.key))) {
      const col = Math.max(0, src.directionOrder.indexOf('south'));
      image = this.scene.add.image(x, y, textureKey.sheet(visual.key), src.rotationRow * src.columns + col);
    } else if (src.kind === 'rotations' && textures.exists(textureKey.rotation(visual.key, 'south'))) {
      image = this.scene.add.image(x, y, textureKey.rotation(visual.key, 'south'));
    } else if (textures.exists(textureKey.placeholder(visual.key))) {
      image = this.scene.add.image(x, y, textureKey.placeholder(visual.key));
    }
    if (!image) return null;
    // Escala inteira que caiba na moldura (pixel art nítida).
    const scale = Math.max(1, Math.floor(PORTRAIT / Math.max(image.width, image.height)));
    return image.setScale(scale);
  }
}
