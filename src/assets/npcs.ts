// Visuais dos NPCs (mesmo formato do manifesto de personagens em manifest.ts). Por enquanto são placeholders
// gerados em runtime; quando o artista entregar os sprites em public/assets/characters/npcs/<id>/, trocar a entrada
// por uma fonte `rotations`/`sheet` (ver docs/assets.md). Ids sem entrada caem no placeholder genérico.

import type { VisualDef } from './manifest';

function placeholderNpc(id: string, color: number): VisualDef {
  return {
    key: `npc:${id}`,
    source: { kind: 'placeholder', shape: 'person', color, width: 32, height: 48 },
    feetY: 46,
    body: { width: 16, height: 10 },
  };
}

export const NPC_VISUALS: Readonly<Record<string, VisualDef>> = {
  mercador: placeholderNpc('mercador', 0xe8a33d),
  seladora: placeholderNpc('seladora', 0x8e5cc9),
  guardia: placeholderNpc('guardia', 0x4fb3c8),
};

const FALLBACK = placeholderNpc('generic', 0xd0d0d0);

export function npcVisual(npcId: string): VisualDef {
  return NPC_VISUALS[npcId] ?? FALLBACK;
}

export function allNpcVisuals(): VisualDef[] {
  return [...Object.values(NPC_VISUALS), FALLBACK];
}
