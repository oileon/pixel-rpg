// Manifesto de visuais: única fonte de caminhos de assets usada pela engine.
// Trocar um placeholder pelo sprite real = mudar a entrada aqui (ver docs/assets.md).

import type { Direction8 } from '../systems/directions';
import { DIRECTIONS_8 } from '../systems/directions';

export type AnimState = 'idle' | 'walk' | 'attack';

export interface SheetAnimation {
  /** Linha da primeira direção; as demais seguem `directionOrder`, uma linha por direção. */
  firstRow: number;
  frames: number;
  frameRate: number;
}

/** Sprite sheet exportado pelo PixelLab (uma linha por direção/animação). */
export interface SheetSource {
  kind: 'sheet';
  url: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  directionOrder: readonly Direction8[];
  /** Linha com as 8 poses estáticas. */
  rotationRow: number;
  animations: Partial<Record<AnimState, SheetAnimation>>;
}

/** Só as 8 poses estáticas (sem animação): a engine faz um "quique" procedural ao andar. */
export interface RotationsSource {
  kind: 'rotations';
  urls: Record<Direction8, string>;
  frameWidth: number;
  frameHeight: number;
}

/** Forma gerada em runtime enquanto o asset não existe. */
export interface PlaceholderSource {
  kind: 'placeholder';
  shape: 'blob' | 'person';
  color: number;
  width: number;
  height: number;
}

export type VisualSource = SheetSource | RotationsSource | PlaceholderSource;

export interface VisualDef {
  key: string;
  source: VisualSource;
  /** Distância (px) do topo do frame até os pés — vira a origem (x,y) da entidade. */
  feetY: number;
  /** Caixa de colisão nos pés (px). */
  body: { width: number; height: number };
}

function rotationUrls(base: string): Record<Direction8, string> {
  const urls = {} as Record<Direction8, string>;
  for (const dir of DIRECTIONS_8) urls[dir] = `${base}/rotations/${dir}.png`;
  return urls;
}

// Ordem das linhas em aprendiz_sheet.json.
const PIXELLAB_SHEET_ORDER: readonly Direction8[] = [
  'south',
  'south-east',
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
];

export const VISUALS = {
  aprendiz: {
    key: 'aprendiz',
    source: {
      kind: 'sheet',
      url: 'assets/characters/aprendiz/aprendiz_sheet.png',
      // Células de 88px com o frame de 64px centralizado (pivô cell-center do PixelLab).
      frameWidth: 88,
      frameHeight: 88,
      columns: 8,
      directionOrder: PIXELLAB_SHEET_ORDER,
      rotationRow: 0,
      animations: {
        idle: { firstRow: 1, frames: 4, frameRate: 5 },
        walk: { firstRow: 9, frames: 8, frameRate: 12 },
        // Soco (tocar uma vez): 7 frames a 20 fps = 0,35 s.
        attack: { firstRow: 17, frames: 7, frameRate: 20 },
      },
    },
    feetY: 73,
    body: { width: 16, height: 10 },
  },
  // Pomi: arquivos na pasta "gosma" (nome de trabalho do artista).
  pomi: {
    key: 'pomi',
    source: {
      kind: 'sheet',
      url: 'assets/monsters/gosma/gosma_sheet.png',
      // Células de 60px com o frame de 48px centralizado.
      frameWidth: 60,
      frameHeight: 60,
      columns: 8,
      directionOrder: PIXELLAB_SHEET_ORDER,
      rotationRow: 0,
      // Só existe idle_bounce: parado quica devagar, andando quica mais rápido.
      animations: {
        idle: { firstRow: 1, frames: 8, frameRate: 8 },
        walk: { firstRow: 1, frames: 8, frameRate: 14 },
      },
    },
    feetY: 46,
    body: { width: 20, height: 10 },
  },
  plumito: {
    key: 'plumito',
    source: {
      kind: 'sheet',
      url: 'assets/monsters/plumito/plumito_sheet.png',
      frameWidth: 68,
      frameHeight: 68,
      columns: 8,
      directionOrder: PIXELLAB_SHEET_ORDER,
      rotationRow: 0,
      animations: {
        idle: { firstRow: 1, frames: 8, frameRate: 8 },
        walk: { firstRow: 1, frames: 8, frameRate: 14 },
      },
    },
    feetY: 54,
    body: { width: 18, height: 10 },
  },
  cascudo: {
    key: 'cascudo',
    source: {
      kind: 'sheet',
      url: 'assets/monsters/cascudo/Cascudo-Idle.png',
      frameWidth: 76,
      frameHeight: 76,
      columns: 8,
      directionOrder: PIXELLAB_SHEET_ORDER,
      rotationRow: 0,
      animations: {
        idle: { firstRow: 1, frames: 8, frameRate: 8 },
        walk: { firstRow: 1, frames: 8, frameRate: 12 },
      },
    },
    feetY: 62,
    body: { width: 24, height: 12 },
  },
  unknown: {
    key: 'unknown',
    source: { kind: 'placeholder', shape: 'blob', color: 0xff00ff, width: 28, height: 28 },
    feetY: 27,
    body: { width: 16, height: 10 },
  },
} satisfies Record<string, VisualDef>;

/** Visual de um id (monstro, personagem). Ids sem entrada caem no placeholder magenta. */
export function getVisual(id: string): VisualDef {
  return (VISUALS as Record<string, VisualDef>)[id] ?? VISUALS.unknown;
}

export function allVisuals(): VisualDef[] {
  return Object.values(VISUALS);
}

// Chaves de textura/animação derivadas.
export const textureKey = {
  sheet: (visual: string) => `${visual}:sheet`,
  rotation: (visual: string, dir: Direction8) => `${visual}:rot:${dir}`,
  placeholder: (visual: string) => `${visual}:ph`,
};

export const animKey = (visual: string, state: AnimState, dir: Direction8) => `${visual}:${state}:${dir}`;
