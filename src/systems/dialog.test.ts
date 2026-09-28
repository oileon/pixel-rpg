import { describe, expect, it, vi } from 'vitest';

// Phaser não roda em Node: o barramento só precisa de um EventEmitter.
vi.mock('phaser', () => {
  class EventEmitter {
    private handlers = new Map<string, ((p: unknown) => void)[]>();
    on(ev: string, fn: (p: unknown) => void) {
      this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), fn]);
      return this;
    }
    off(ev: string, fn?: (p: unknown) => void) {
      this.handlers.set(ev, (this.handlers.get(ev) ?? []).filter((h) => fn && h !== fn));
      return this;
    }
    emit(ev: string, payload: unknown) {
      for (const h of this.handlers.get(ev) ?? []) h(payload);
    }
  }
  return { default: { Events: { EventEmitter } } };
});

const { closeDialog, currentDialog, isDialogOpen, openDialog, selectDialogChoice } = await import('./dialog');
const { gameEvents } = await import('./events');

describe('diálogo', () => {
  it('abre, avisa a UI e fecha chamando onClose uma vez', () => {
    const seen: (string | null)[] = [];
    const listener = ({ dialog }: { dialog: { speaker: string } | null }) => seen.push(dialog?.speaker ?? null);
    gameEvents.on('dialogChanged', listener);
    const onClose = vi.fn();
    openDialog({ speaker: 'Mercador', lines: ['Oi'], onClose });
    expect(isDialogOpen()).toBe(true);
    closeDialog();
    closeDialog();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(isDialogOpen()).toBe(false);
    expect(seen).toEqual(['Mercador', null]);
    gameEvents.off('dialogChanged', listener);
  });

  it('abrir outro diálogo fecha o anterior (onClose) e o substitui', () => {
    const first = vi.fn();
    openDialog({ speaker: 'A', lines: ['1'], onClose: first });
    openDialog({ speaker: 'B', lines: ['2'] });
    expect(first).toHaveBeenCalledTimes(1);
    expect(currentDialog()?.speaker).toBe('B');
    closeDialog();
  });

  it('escolha fecha e depois chama a ação; keepOpen mantém aberto; desabilitada não faz nada', () => {
    const order: string[] = [];
    openDialog({ speaker: 'A', lines: ['1'], onClose: () => order.push('close') });
    selectDialogChoice({ label: 'ir', onSelect: () => order.push(`select:${isDialogOpen()}`) });
    expect(order).toEqual(['close', 'select:false']);

    openDialog({ speaker: 'A', lines: ['1'] });
    selectDialogChoice({ label: 'fica', keepOpen: true });
    expect(isDialogOpen()).toBe(true);
    const never = vi.fn();
    selectDialogChoice({ label: 'não', enabled: false, onSelect: never });
    expect(never).not.toHaveBeenCalled();
    expect(isDialogOpen()).toBe(true);
    closeDialog();
  });
});
