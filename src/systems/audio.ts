// Preferências de áudio (volume global e mudo). Puro: a síntese fica em audio/sfx.ts.

export interface AudioSettings {
  /** Volume global, 0..1. */
  volume: number;
  muted: boolean;
}

export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, Math.round(v * 100) / 100));
}

export function defaultAudioSettings(defaultVolume: number): AudioSettings {
  return { volume: clampVolume(defaultVolume), muted: false };
}

/** Ganho final aplicado ao mixer (0 quando mudo). */
export function masterGain(s: AudioSettings): number {
  return s.muted ? 0 : clampVolume(s.volume);
}

export function toggleMute(s: AudioSettings): AudioSettings {
  return { ...s, muted: !s.muted };
}

/** Sobe/desce o volume em `delta`; mexer no volume tira o mudo. */
export function stepVolume(s: AudioSettings, delta: number): AudioSettings {
  return { volume: clampVolume(s.volume + delta), muted: false };
}

/** Lê preferências de um valor desconhecido (save); campos inválidos voltam ao padrão. */
export function readAudioSettings(raw: unknown, fallback: AudioSettings): { settings: AudioSettings; valid: boolean } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { settings: { ...fallback }, valid: false };
  const r = raw as Record<string, unknown>;
  const volumeOk = typeof r.volume === 'number' && Number.isFinite(r.volume);
  const mutedOk = typeof r.muted === 'boolean';
  return {
    settings: {
      volume: volumeOk ? clampVolume(r.volume as number) : fallback.volume,
      muted: mutedOk ? (r.muted as boolean) : fallback.muted,
    },
    valid: volumeOk && mutedOk,
  };
}
