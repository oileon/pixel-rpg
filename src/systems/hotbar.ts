// Barra de atalhos (teclas 1–8). Funções puras: sempre retornam uma nova barra.
// Cada slot guarda uma referência (item por id, ou skill no futuro), não um slot do inventário:
// usar um atalho de item consome a primeira pilha daquele item.

export const HOTBAR_SIZE = 8;

export type HotbarEntry = { kind: 'item'; itemId: string } | { kind: 'skill'; skillId: string };

export type Hotbar = readonly (HotbarEntry | null)[];

export function createHotbar(): Hotbar {
  return Array.from({ length: HOTBAR_SIZE }, () => null);
}

export function sameEntry(a: HotbarEntry | null, b: HotbarEntry | null): boolean {
  if (!a || !b) return a === b;
  if (a.kind === 'item' && b.kind === 'item') return a.itemId === b.itemId;
  if (a.kind === 'skill' && b.kind === 'skill') return a.skillId === b.skillId;
  return false;
}

export function findEntry(hotbar: Hotbar, entry: HotbarEntry): number {
  return hotbar.findIndex((e) => sameEntry(e, entry));
}

export function setSlot(hotbar: Hotbar, index: number, entry: HotbarEntry | null): Hotbar {
  if (index < 0 || index >= hotbar.length) return hotbar;
  const next = [...hotbar];
  // Um atalho aparece uma vez só: sai do slot antigo ao ir para outro.
  if (entry) {
    const old = findEntry(hotbar, entry);
    if (old >= 0) next[old] = null;
  }
  next[index] = entry;
  return next;
}

export interface AssignResult {
  hotbar: Hotbar;
  /** Slot usado; -1 se a barra estava cheia. */
  index: number;
  /** Já estava na barra (nada mudou). */
  already: boolean;
}

/** Coloca no primeiro slot livre (ou informa onde já está). */
export function assignToFreeSlot(hotbar: Hotbar, entry: HotbarEntry): AssignResult {
  const existing = findEntry(hotbar, entry);
  if (existing >= 0) return { hotbar, index: existing, already: true };
  const free = hotbar.findIndex((e) => e === null);
  if (free < 0) return { hotbar, index: -1, already: false };
  return { hotbar: setSlot(hotbar, free, entry), index: free, already: false };
}

export function swapSlots(hotbar: Hotbar, a: number, b: number): Hotbar {
  if (a === b || a < 0 || b < 0 || a >= hotbar.length || b >= hotbar.length) return hotbar;
  const next = [...hotbar];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
