import { describe, expect, it } from 'vitest';
import { clampVolume, defaultAudioSettings, masterGain, readAudioSettings, stepVolume, toggleMute } from './audio';

describe('preferências de áudio', () => {
  it('limita o volume a [0, 1] e arredonda em centésimos', () => {
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(0.333)).toBe(0.33);
    expect(clampVolume(Number.NaN)).toBe(0);
  });

  it('mudo zera o ganho sem perder o volume', () => {
    const s = defaultAudioSettings(0.6);
    expect(masterGain(s)).toBe(0.6);
    const muted = toggleMute(s);
    expect(masterGain(muted)).toBe(0);
    expect(muted.volume).toBe(0.6);
    expect(masterGain(toggleMute(muted))).toBe(0.6);
  });

  it('mexer no volume tira o mudo e respeita os limites', () => {
    expect(stepVolume({ volume: 0.95, muted: true }, 0.1)).toEqual({ volume: 1, muted: false });
    expect(stepVolume({ volume: 0.05, muted: false }, -0.1).volume).toBe(0);
    expect(stepVolume({ volume: 0.6, muted: false }, -0.1).volume).toBe(0.5);
  });

  it('lê valores desconhecidos com fallback', () => {
    const fb = defaultAudioSettings(0.6);
    expect(readAudioSettings({ volume: 0.2, muted: true }, fb)).toEqual({ settings: { volume: 0.2, muted: true }, valid: true });
    expect(readAudioSettings(null, fb)).toEqual({ settings: fb, valid: false });
    expect(readAudioSettings({ volume: 0.2 }, fb)).toEqual({ settings: { volume: 0.2, muted: false }, valid: false });
  });
});
