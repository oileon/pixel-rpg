// NPCs do mapa: cria as entidades de `MapDef.npcs`, leva o jogador até o NPC clicado e abre o diálogo com as
// falas de npcs.json. A última página oferece a ação do NPC (loja, selos, prova do Pacto): o gameplay registra o
// que ela faz com `registerNpcAction`; sem handler, o NPC avisa que ainda não está disponível.

import { INTERACT_RANGE, TILE_SIZE } from '../config';
import type { NpcAction } from '../data/npcs';
import { Npc } from '../entities/Npc';
import type { WorldScene } from '../scenes/WorldScene';
import { openDialog, type DialogChoice } from './dialog';
import { gameEvents } from './events';
import type { Interactable, Interactions } from './interaction';

export interface NpcActionContext {
  npc: Npc;
  world: WorldScene;
}

export type NpcActionHandler = (ctx: NpcActionContext) => void;

const actionHandlers = new Map<NpcAction, NpcActionHandler>();

/** Define o que a ação faz (ex.: abrir a loja). Devolve a função que remove o handler. */
export function registerNpcAction(action: NpcAction, handler: NpcActionHandler): () => void {
  actionHandlers.set(action, handler);
  return () => {
    if (actionHandlers.get(action) === handler) actionHandlers.delete(action);
  };
}

const UNAVAILABLE_LINE = 'Volte mais tarde, ainda estou me preparando.';

function talk(world: WorldScene, npc: Npc): void {
  const def = npc.def;
  npc.faceTowards(world.player.x, world.player.y);
  gameEvents.emit('npcInteracted', { npc, npcId: def.id });
  const choices: DialogChoice[] = [];
  const action = def.action;
  if (action) {
    choices.push({
      label: def.actionLabel ?? 'Aceitar',
      onSelect: () => {
        gameEvents.emit('npcAction', { npc, npcId: def.id, action });
        const handler = actionHandlers.get(action);
        if (handler) handler({ npc, world });
        else openDialog({ speaker: def.name, lines: [UNAVAILABLE_LINE], onClose: () => npc.face(npc.restFacing) });
      },
    });
  }
  choices.push({ label: 'Até logo' });
  openDialog({ speaker: def.name, lines: def.lines, choices, onClose: () => npc.face(npc.restFacing) });
}

/** Cria os NPCs do mapa e os registra para interação. */
export function spawnNpcs(world: WorldScene, interactions: Interactions): Npc[] {
  const npcs: Npc[] = [];
  const targets = new Map<Npc, Interactable>();
  for (const placement of world.mapDef.npcs ?? []) {
    const p = world.tileCenter(placement.x, placement.y);
    // Pés no centro-baixo do tile (como os monstros), para não "flutuar" meio tile acima do chão.
    const npc = new Npc(world, placement.npcId, p.x, p.y + TILE_SIZE / 4, placement.facing);
    const target: Interactable = {
      get x() {
        return npc.x;
      },
      get y() {
        return npc.y;
      },
      range: INTERACT_RANGE,
      interact: () => talk(world, npc),
    };
    targets.set(npc, target);
    interactions.add(target);
    npcs.push(npc);
  }
  // O clique no NPC chega como entityClicked (o gameplay ignora o que não é monstro).
  gameEvents.onScene(world, 'entityClicked', ({ entity }) => {
    const target = entity instanceof Npc ? targets.get(entity) : undefined;
    if (target) interactions.approach(target);
  });
  return npcs;
}
