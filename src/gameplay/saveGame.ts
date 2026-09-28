// Save no localStorage: carrega no boot, autosave (troca de mapa, a cada 30 s e ao fechar a aba)
// e "Novo jogo". A montagem/validação do save fica em save.ts (puro, testado).

import { MAPS } from '../maps';
import { gameEvents } from '../systems/events';
import { session } from '../systems/session';
import { AUTOSAVE_INTERVAL_MS } from './config';
import { playerState, replacePlayerState } from './playerState';
import { createSave, parseSave, serializeSave, type KnownMaps, type SaveLocation } from './save';
import { settings, updateSettings } from './settings';

export const SAVE_KEY = 'jogopixel.save';
/** Cópia do último save que falhou ao carregar (para depuração; não é lida pelo jogo). */
export const BAD_SAVE_KEY = 'jogopixel.save.invalido';

const FALLBACK: SaveLocation = { mapId: 'town', spawnId: 'start' };

let location: SaveLocation | null = null;
/** Depois de "Novo jogo" (ou com um save de versão mais nova) nada mais é salvo até recarregar a página. */
let suspended = false;
const bootNotices: { text: string; color: string }[] = [];

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function knownMaps(): KnownMaps {
  return Object.fromEntries(Object.values(MAPS).map((m) => [m.id, Object.keys(m.spawns)]));
}

/** Chamado antes do Phaser: aplica o save ao estado do jogador e define onde o jogo começa. */
export function loadGameAtBoot(): void {
  const store = storage();
  let raw: string | null = null;
  try {
    raw = store?.getItem(SAVE_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw === null) return;

  const result = parseSave(raw, { knownMaps: knownMaps(), fallback: FALLBACK });
  if (!result.ok && result.newerVersion !== undefined) {
    // Save de um jogo mais novo: não carrega, mas também não sobrescreve (autosave suspenso até recarregar).
    console.warn(`[save] ${result.reason}; autosave desligado para não sobrescrever.`);
    suspended = true;
    bootNotices.push({
      text: `Save de uma versão mais nova do jogo (v${result.newerVersion}). Jogando sem salvar para não apagá-lo.`,
      color: '#ff9f6b',
    });
    return;
  }
  if (!result.ok) {
    console.warn(`[save] save inválido (${result.reason}); começando personagem novo.`);
    try {
      store?.setItem(BAD_SAVE_KEY, raw);
    } catch {
      /* sem espaço: tudo bem */
    }
    bootNotices.push({ text: 'Save inválido ou de versão antiga: começando um personagem novo.', color: '#ff9f6b' });
    return;
  }
  const { game } = result;
  replacePlayerState(playerState, game.state);
  updateSettings(game.settings);
  session.lastSafePoint = game.lastSafePoint;
  session.resumePoint = game.location;
  location = game.location;
  for (const w of game.warnings) console.warn(`[save] ${w}`);
  bootNotices.push({
    text: game.warnings.length > 0 ? `Jogo carregado (${game.warnings.length} correção(ões) no save).` : 'Jogo carregado.',
    color: '#c8f0c0',
  });
}

/** Avisos do carregamento para a UI mostrar quando estiver pronta. */
export function takeBootNotices(): { text: string; color: string }[] {
  return bootNotices.splice(0);
}

export function saveGame(): boolean {
  if (suspended) return false;
  const here = location ?? session.lastSafePoint;
  try {
    storage()?.setItem(SAVE_KEY, serializeSave(createSave(playerState, here, session.lastSafePoint, Date.now(), settings)));
    return true;
  } catch (e) {
    console.warn('[save] falha ao salvar', e);
    return false;
  }
}

let installed = false;

export function installAutosave(): void {
  if (installed) return;
  installed = true;
  gameEvents.on('mapEntered', ({ mapId, spawnId }) => {
    location = { mapId, spawnId };
    saveGame();
  });
  window.setInterval(saveGame, AUTOSAVE_INTERVAL_MS);
  window.addEventListener('beforeunload', () => saveGame());
}

/** Apaga o save e recarrega com um personagem novo. */
export function newGame(): void {
  suspended = true;
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    /* ignora */
  }
  window.location.reload();
}
