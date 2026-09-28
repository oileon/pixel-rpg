// NPCs (npcs.json): nome, falas e a ação oferecida no fim da conversa. A ação em si é registrada pelo gameplay
// (ver `registerNpcAction` em src/systems/npcs.ts); a engine só mostra o diálogo e chama o gancho.

import npcsJson from './npcs.json';

/** Ganchos de ação conhecidos. Novos valores exigem um handler registrado pelo gameplay. */
export type NpcAction = 'shop' | 'seals' | 'pact';

export interface NpcDef {
  id: string;
  /** Nome exibido na caixa de diálogo. */
  name: string;
  /** Falas mostradas em sequência (uma por página). */
  lines: string[];
  action?: NpcAction;
  /** Texto do botão da ação. */
  actionLabel?: string;
}

export const NPCS = npcsJson as NpcDef[];

const byId = new Map(NPCS.map((n) => [n.id, n]));

export function findNpc(id: string): NpcDef | undefined {
  return byId.get(id);
}
