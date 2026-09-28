// Atalhos de teclado da UI: um disparo por toque real de tecla.
// Ignora o auto-repeat do navegador (segurar a tecla) e o mesmo evento entregue duas vezes: o Phaser
// relê a fila de teclas a cada evento novo no mesmo frame e pode repetir `keydown-X`.

import Phaser from 'phaser';

const handled = new WeakSet<KeyboardEvent>();

/**
 * Por caractere (`event.key`), não por código de tecla: `-` e `=` têm códigos diferentes no Firefox e no
 * teclado numérico, mas o mesmo caractere.
 */
export function onCharPress(keyboard: Phaser.Input.Keyboard.KeyboardPlugin, chars: readonly string[], handler: () => void): void {
  keyboard.on('keydown', (event: KeyboardEvent) => {
    if (event.repeat || !chars.includes(event.key) || handled.has(event)) return;
    handled.add(event);
    handler();
  });
}

export function onKeyPress(keyboard: Phaser.Input.Keyboard.KeyboardPlugin, key: string, handler: () => void): void {
  keyboard.on(`keydown-${key}`, (event: KeyboardEvent) => {
    if (event.repeat || handled.has(event)) return;
    handled.add(event);
    handler();
  });
}
