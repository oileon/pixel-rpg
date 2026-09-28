// Caixa de diálogo: estado + API usada pela engine (NPCs, Pedra de Retorno) e pelo gameplay. O desenho fica na
// DialogScene (src/ui/DialogScene.ts), que escuta `dialogChanged`. Só um diálogo por vez: abrir outro substitui.

import { gameEvents } from './events';

export interface DialogChoice {
  label: string;
  /** Chamado depois de fechar o diálogo (ou com ele aberto, se `keepOpen`). */
  onSelect?: () => void;
  /** Não fecha ao escolher (ex.: a ação troca o conteúdo com outro `openDialog`). */
  keepOpen?: boolean;
  enabled?: boolean;
}

export interface DialogRequest {
  /** Nome no topo da caixa. */
  speaker: string;
  /** Uma fala por página; clique/Espaço avança. As escolhas aparecem na última página. */
  lines: readonly string[];
  /** Sem escolhas, a última página mostra só "Fechar". */
  choices?: readonly DialogChoice[];
  /** Chamado uma vez quando o diálogo fecha (por escolha, Esc, afastamento ou troca de mapa). */
  onClose?: () => void;
}

let current: DialogRequest | null = null;

export function isDialogOpen(): boolean {
  return current !== null;
}

export function currentDialog(): DialogRequest | null {
  return current;
}

export function openDialog(request: DialogRequest): void {
  const previous = current;
  current = request;
  previous?.onClose?.();
  gameEvents.emit('dialogChanged', { dialog: request });
}

export function closeDialog(): void {
  if (!current) return;
  const closed = current;
  current = null;
  closed.onClose?.();
  gameEvents.emit('dialogChanged', { dialog: null });
}

/** Escolha feita na caixa (chamado pela DialogScene). */
export function selectDialogChoice(choice: DialogChoice): void {
  if (choice.enabled === false) return;
  if (!choice.keepOpen) closeDialog();
  choice.onSelect?.();
}
