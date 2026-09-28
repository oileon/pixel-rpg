// Preferências do jogador em tempo de execução (hoje só áudio). Salvas junto do save (save.ts).

import { FEEL } from '../data';
import { defaultAudioSettings, type AudioSettings } from '../systems/audio';

export interface GameSettings {
  audio: AudioSettings;
}

export function defaultSettings(): GameSettings {
  return { audio: defaultAudioSettings(FEEL.audio.defaultVolume) };
}

/** Preferências atuais (substituídas pelo save no boot). */
export const settings: GameSettings = defaultSettings();

type Listener = (s: GameSettings) => void;
const listeners = new Set<Listener>();

/** Avisado a cada mudança (o mixer de áudio usa para aplicar volume/mudo). */
export function onSettingsChanged(listener: Listener): void {
  listeners.add(listener);
  listener(settings);
}

export function updateSettings(next: Partial<GameSettings>): void {
  Object.assign(settings, next);
  for (const listener of listeners) listener(settings);
}
