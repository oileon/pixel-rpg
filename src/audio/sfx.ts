// Efeitos sonoros sintetizados com WebAudio (sem arquivos). Receitas em data/sfx.json;
// volume/mudo vêm das preferências (gameplay/settings.ts).
//
// O AudioContext só é criado no primeiro som (sempre depois de um clique ou tecla do jogador),
// então a política de autoplay do navegador não bloqueia nada.

import { SFX } from '../data';
import type { SfxId, SfxLayer } from '../data/types';
import { masterGain } from '../systems/audio';
import { onSettingsChanged } from '../gameplay/settings';

/** Mesmo som repetido em menos que isto é ignorado (evita estourar com vários drops juntos). */
const MIN_REPEAT_MS = 35;
const NOISE_SECONDS = 1;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let gain = 1;
const lastPlayed = new Map<SfxId, number>();

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = typeof window !== 'undefined' ? window.AudioContext : undefined;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  master = ctx.createGain();
  master.gain.value = gain;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

function playLayer(ac: AudioContext, out: AudioNode, layer: SfxLayer): void {
  const start = ac.currentTime + (layer.delayMs ?? 0) / 1000;
  const dur = layer.ms / 1000;
  const attack = Math.min(dur * 0.5, (layer.attackMs ?? 4) / 1000);

  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, layer.gain), start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  let source: AudioScheduledSourceNode;
  if (layer.wave === 'noise') {
    const src = ac.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    source = src;
  } else {
    const osc = ac.createOscillator();
    osc.type = layer.wave;
    const [f0, f1] = layer.freq ?? [440, 440];
    osc.frequency.setValueAtTime(f0, start);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + dur);
    source = osc;
  }

  let node: AudioNode = source;
  if (layer.filter) {
    const filter = ac.createBiquadFilter();
    filter.type = layer.filter.type;
    filter.frequency.value = layer.filter.freq;
    node.connect(filter);
    node = filter;
  }
  node.connect(env);
  env.connect(out);
  source.start(start);
  source.stop(start + dur + 0.02);
  source.onended = () => env.disconnect();
}

/** Toca um efeito. Silencioso se o áudio estiver mudo ou indisponível. */
export function playSfx(id: SfxId): void {
  if (gain <= 0) return;
  const ac = context();
  if (!ac || !master) return;
  if (ac.state === 'suspended') void ac.resume();
  const now = performance.now();
  if (now - (lastPlayed.get(id) ?? -Infinity) < MIN_REPEAT_MS) return;
  lastPlayed.set(id, now);
  for (const layer of SFX[id]) playLayer(ac, master, layer);
}

let installed = false;

/** Liga o mixer às preferências (volume/mudo). */
export function installSfx(): void {
  if (installed) return;
  installed = true;
  onSettingsChanged((s) => {
    gain = masterGain(s.audio);
    if (ctx && master) master.gain.setTargetAtTime(gain, ctx.currentTime, 0.01);
  });
}
