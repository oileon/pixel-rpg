// Interação com NPCs e objetos (Pedra de Retorno): clicar leva o jogador até o alvo e, ao chegar no alcance,
// chama `interact()`. A tecla E interage com o alvo mais perto no alcance. Afastar-se fecha o diálogo aberto.

import Phaser from 'phaser';
import { INTERACT_KEY } from '../config';
import type { WorldScene } from '../scenes/WorldScene';
import { onKeyPress } from '../ui/keys';
import { closeDialog, isDialogOpen } from './dialog';
import { gameEvents } from './events';

export interface Interactable {
  /** Ponto (px, mundo) de onde se mede a distância até os pés do jogador. */
  readonly x: number;
  readonly y: number;
  /** Alcance (px) para interagir. */
  readonly range: number;
  interact(): void;
}

/** Folga (px) além do alcance antes de fechar a conversa quando o jogador se afasta. */
const LEAVE_MARGIN = 48;

export class Interactions {
  private readonly byObject = new Map<Phaser.GameObjects.GameObject, Interactable>();
  private readonly all = new Set<Interactable>();
  /** Alvo para onde o jogador está andando. */
  private pending: Interactable | null = null;
  /** Alvo da conversa aberta (fecha ao se afastar). */
  private talking: Interactable | null = null;

  constructor(private readonly world: WorldScene) {
    gameEvents.onScene(world, 'groundClicked', () => {
      this.pending = null;
    });
    gameEvents.onScene(world, 'mapExiting', () => {
      this.pending = null;
      closeDialog();
    });
    gameEvents.onScene(world, 'dialogChanged', ({ dialog }) => {
      if (!dialog) this.talking = null;
    });
    world.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      world.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
      this.byObject.clear();
      this.all.clear();
      this.pending = null;
      closeDialog();
    });
    const keyboard = world.input.keyboard;
    if (keyboard) onKeyPress(keyboard, INTERACT_KEY, () => this.interactNearest());
  }

  /** Registra um alvo. Com `object`, clicar nele leva o jogador até lá (o objeto vira interativo). */
  add(target: Interactable, object?: Phaser.GameObjects.GameObject): void {
    this.all.add(target);
    if (object) {
      this.byObject.set(object, target);
      if (!object.input) object.setInteractive({ useHandCursor: true });
    }
  }

  /** Alvo dono de algum dos objetos sob o ponteiro. */
  findIn(objects: readonly Phaser.GameObjects.GameObject[]): Interactable | undefined {
    for (const obj of objects) {
      const target = this.byObject.get(obj);
      if (target) return target;
    }
    return undefined;
  }

  /** Anda até o alvo e interage ao entrar no alcance (na hora, se já estiver perto). */
  approach(target: Interactable): void {
    const player = this.world.player;
    if (this.world.traveling || player.dead) return;
    this.pending = null;
    if (this.inRange(target)) {
      this.start(target);
      return;
    }
    if (player.moveTo(target.x, target.y, { closest: true })) this.pending = target;
  }

  private inRange(target: Interactable): boolean {
    return this.world.player.distanceTo(target) <= target.range;
  }

  private start(target: Interactable): void {
    const player = this.world.player;
    player.stop();
    player.faceTowards(target.x, target.y);
    this.talking = target;
    target.interact();
  }

  private interactNearest(): void {
    if (this.world.traveling) return;
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const target of this.all) {
      const d = this.world.player.distanceTo(target);
      if (d <= target.range && d < bestDist) {
        best = target;
        bestDist = d;
      }
    }
    if (best) this.start(best);
  }

  private update(): void {
    if (this.world.traveling) return;
    const player = this.world.player;
    const pending = this.pending;
    if (pending) {
      if (this.world.keyboardMoving) {
        this.pending = null;
      } else if (this.inRange(pending)) {
        this.pending = null;
        this.start(pending);
      } else if (!player.isMoving && player.currentPath.length === 0) {
        // Chegou ao ponto alcançável mais perto e mesmo assim ficou longe: desiste.
        this.pending = null;
      }
    }
    const talking = this.talking;
    if (talking && isDialogOpen() && player.distanceTo(talking) > talking.range + LEAVE_MARGIN) closeDialog();
  }
}
