// Janela de distribuição de stats: stats base com +/- à esquerda, atributos derivados (atual → novo)
// em duas colunas à direita e os botões de ação embaixo. Só reconstrói quando o estado mostrado muda.

import Phaser from 'phaser';
import { getClass } from '../data';
import type { BaseStats, StatKey } from '../data/types';
import { gameEvents } from '../systems/events';
import { applyAllocation, playerState, respecPlayer, statsInput } from '../gameplay/playerState';
import { canRespecFree, MAX_STAT, STAT_KEYS, previewStats, statIncreaseCost, type DerivedStats } from '../systems/stats';
import { sealsSignature } from './sealView';
import { respecButtonLabel, statsWindowSignature } from './uiLogic';
import { Panel, UI_BAD, UI_GOOD, UI_MUTED, UI_TEXT, uiButton, uiText } from './widgets';

const PANEL_W = 420;
const PANEL_H = 272;
/** Encostado na borda esquerda, para não cobrir o jogador no centro (x = 480) nem o Inventário. */
const PANEL_X = 8;
/** Abaixo do HUD do jogador (y 32–132). */
const PANEL_Y = 140;

const PAD = 10;
const STATS_TOP = 80;
const STAT_ROW = 22;
/** Colunas dos stats base (x relativo ao painel). */
const STAT_VALUE_X = PAD + 34;
const STAT_NEXT_X = PAD + 58;
const STAT_PLUS_X = PAD + 96;
const STAT_MINUS_X = PAD + 119;
const STAT_COST_X = PAD + 144;
/** Colunas dos atributos derivados (x relativo ao painel). */
const DERIVED_COLS = [190, 305];
const DERIVED_ROW = 20;
const DERIVED_VALUE_DX = 44;
const DERIVED_NEXT_DX = 74;
const ACTIONS_Y = 220;

const STAT_NAMES: Record<StatKey, string> = {
  str: 'STR',
  agi: 'AGI',
  vit: 'VIT',
  int: 'INT',
  dex: 'DEX',
  luk: 'LUK',
};

const DERIVED_ROWS: ReadonlyArray<{ label: string; key: keyof DerivedStats; suffix?: string }> = [
  { label: 'HP máx', key: 'maxHp' },
  { label: 'SP máx', key: 'maxSp' },
  { label: 'ATK', key: 'atk' },
  { label: 'MATK', key: 'matk' },
  { label: 'DEF', key: 'def' },
  { label: 'MDEF', key: 'mdef' },
  { label: 'HIT', key: 'hit' },
  { label: 'FLEE', key: 'flee' },
  { label: 'CRIT', key: 'crit', suffix: '%' },
  { label: 'ASPD', key: 'aspd' },
];

export class StatsWindow {
  private readonly panel: Panel;
  private allocation: Partial<BaseStats> = {};
  /** Primeiro clique em Resetar só arma a confirmação. */
  private confirmingRespec = false;
  private signature = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.panel = new Panel(scene, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 'Status', () => this.toggle(false));
  }

  toggle(visible?: boolean): void {
    this.panel.setVisible(visible ?? !this.panel.visible);
    this.allocation = {};
    this.confirmingRespec = false;
    this.signature = '';
    this.refresh();
  }

  /** Chamado a cada frame; só reconstrói o conteúdo se algo mostrado mudou. */
  refresh(): void {
    if (!this.panel.visible) return;
    const s = playerState;
    const signature = statsWindowSignature({
      classId: s.classId,
      level: s.level,
      stats: s.stats,
      equipment: s.equipment,
      allocation: this.allocation,
      confirmingRespec: this.confirmingRespec,
      seals: sealsSignature(s.seals, s.equipmentSeals),
    });
    if (signature === this.signature) return;
    this.signature = signature;
    this.rebuild();
  }

  private setAllocation(allocation: Partial<BaseStats>): void {
    this.allocation = allocation;
    this.confirmingRespec = false;
    this.refresh();
  }

  private rebuild(): void {
    this.panel.clear();
    const s = playerState;
    const preview = previewStats(statsInput(s), this.allocation);
    const hasChanges = STAT_KEYS.some((k) => (this.allocation[k] ?? 0) > 0);

    // Cabeçalho
    this.panel.add(uiText(this.scene, PAD, 32, `Nível ${s.level}  •  ${getClass(s.classId).name}`, 13, '#ffe9a8'));
    this.panel.add(uiText(this.scene, PAD, 52, `Pontos disponíveis: ${preview.remainingPoints}`, 12, UI_TEXT));
    this.panel.add(uiText(this.scene, PAD + 220, 53, '(n) = custo do próximo +1', 11, UI_MUTED));
    this.separator(72);

    // Stats base (coluna esquerda)
    let y = STATS_TOP;
    for (const key of STAT_KEYS) {
      const current = s.stats[key];
      const add = this.allocation[key] ?? 0;
      const next = current + add;
      const atMax = next >= MAX_STAT;
      const cost = statIncreaseCost(next);
      const affordable = preview.valid && !atMax && cost <= preview.remainingPoints;

      this.panel.add(uiText(this.scene, PAD, y, STAT_NAMES[key], 12, UI_TEXT));
      this.panel.add(uiText(this.scene, STAT_VALUE_X, y, `${current}`, 12, UI_TEXT));
      if (add > 0) this.panel.add(uiText(this.scene, STAT_NEXT_X, y, `→${next}`, 12, UI_GOOD));

      this.panel.add(
        uiButton(this.scene, STAT_PLUS_X, y - 3, '+', () => this.setAllocation({ ...this.allocation, [key]: add + 1 }), {
          enabled: affordable,
          size: 11,
        }),
      );
      this.panel.add(
        uiButton(this.scene, STAT_MINUS_X, y - 3, '−', () => this.setAllocation({ ...this.allocation, [key]: Math.max(0, add - 1) }), {
          enabled: add > 0,
          size: 11,
        }),
      );
      this.panel.add(uiText(this.scene, STAT_COST_X, y, atMax ? 'máx' : `(${cost})`, 11, affordable ? UI_MUTED : UI_BAD));
      y += STAT_ROW;
    }

    // Atributos derivados (duas colunas à direita): valor atual e, se mudar, o novo.
    const perCol = Math.ceil(DERIVED_ROWS.length / DERIVED_COLS.length);
    DERIVED_ROWS.forEach((row, i) => {
      const cx = DERIVED_COLS[Math.floor(i / perCol)];
      const ry = STATS_TOP + (i % perCol) * DERIVED_ROW;
      const before = preview.before[row.key];
      const after = preview.after[row.key];
      const suffix = row.suffix ?? '';
      const changed = before !== after;

      this.panel.add(uiText(this.scene, cx, ry, row.label, 11, UI_MUTED));
      this.panel.add(uiText(this.scene, cx + DERIVED_VALUE_DX, ry, `${before}${suffix}`, 11, UI_TEXT));
      if (changed) {
        this.panel.add(uiText(this.scene, cx + DERIVED_NEXT_DX, ry, `→${after}${suffix}`, 11, after > before ? UI_GOOD : UI_BAD));
      }
    });

    this.separator(ACTIONS_Y - 10);

    // Botões de ação
    this.panel.add(
      uiButton(
        this.scene,
        PAD,
        ACTIONS_Y,
        'Aplicar',
        () => {
          if (applyAllocation(playerState, this.allocation)) {
            gameEvents.emit('notify', { text: 'Stats aplicados!', color: UI_GOOD });
            this.setAllocation({});
          }
        },
        { enabled: preview.valid && hasChanges, size: 12, background: '#2d5530' },
      ),
    );
    this.panel.add(
      uiButton(this.scene, PAD + 74, ACTIONS_Y, 'Cancelar', () => this.setAllocation({}), { enabled: hasChanges, size: 12 }),
    );

    const canRespec = canRespecFree(s.level);
    this.panel.add(
      uiButton(
        this.scene,
        PAD + 156,
        ACTIONS_Y,
        respecButtonLabel(s.level, this.confirmingRespec),
        () => this.onRespecClick(),
        { enabled: canRespec, size: 12, background: this.confirmingRespec ? '#a0452d' : '#6b3a2d' },
      ),
    );

    if (!preview.valid && hasChanges && preview.reason) {
      this.panel.add(uiText(this.scene, PAD, ACTIONS_Y + 28, `⚠ ${preview.reason}`, 11, UI_BAD));
    } else if (this.confirmingRespec) {
      this.panel.add(uiText(this.scene, PAD, ACTIONS_Y + 28, 'Clique de novo para devolver todos os pontos.', 11, UI_MUTED));
    }
  }

  private onRespecClick(): void {
    if (!this.confirmingRespec) {
      this.confirmingRespec = true;
      this.refresh();
      return;
    }
    this.confirmingRespec = false;
    if (respecPlayer(playerState)) {
      gameEvents.emit('notify', { text: 'Stats resetados!', color: UI_TEXT });
      this.allocation = {};
    }
    this.refresh();
  }

  private separator(y: number): void {
    this.panel.add(this.scene.add.rectangle(PAD, y, PANEL_W - PAD * 2, 1, 0x3a465c).setOrigin(0));
  }
}
