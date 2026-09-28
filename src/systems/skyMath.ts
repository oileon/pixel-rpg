// Contas do mar de nuvens sem Phaser (testáveis): offset das camadas, reciclagem das nuvens avulsas e
// recorte da nuvem do tileset base.

import type { SkyLayerDef } from '../assets/sky';

/** tilePosition da camada: parallax com a câmera + deriva do vento + balanço lento. */
export function skyLayerOffset(
  layer: Pick<SkyLayerDef, 'parallax' | 'wind' | 'bob'>,
  scrollX: number,
  scrollY: number,
  timeMs: number,
): { x: number; y: number } {
  const t = timeMs / 1000;
  // Vento para leste = a textura anda para a direita = tilePosition diminui.
  return {
    x: scrollX * layer.parallax - layer.wind.x * t,
    y: scrollY * layer.parallax - layer.wind.y * t + Math.sin(t * 0.6) * layer.bob,
  };
}

export type PuffExit = 'none' | 'right' | 'left' | 'vertical';

/**
 * Se a nuvem avulsa saiu da tela (coordenadas de tela do canto superior esquerdo). `right` = passou do
 * lado direito (renasce à esquerda); `left` = ficou muito para trás pela esquerda (câmera andou para
 * leste) e renasce à direita; `vertical` = câmera andou em y, sorteia outra altura.
 */
export function puffExit(
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  viewW: number,
  viewH: number,
  margin = 64,
): PuffExit {
  if (screenX > viewW + margin) return 'right';
  if (screenX + width < -margin * 4) return 'left';
  if (screenY > viewH + margin || screenY + height < -margin) return 'vertical';
  return 'none';
}

/** Valor sorteado numa faixa [min, max]. */
export function inRange([min, max]: readonly [number, number], rng: () => number): number {
  return min + (max - min) * rng();
}

/**
 * Recorta a nuvem de um tileset RGBA: todo pixel cuja cor aparece no tile de nuvem pura (`cloudRect`)
 * fica transparente. Devolve um novo buffer; o original não muda.
 */
export function cutoutCloudPixels(
  data: Uint8ClampedArray,
  width: number,
  cloudRect: { x: number; y: number; w: number; h: number },
): Uint8ClampedArray {
  const rgb = (i: number) => (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
  const palette = new Set<number>();
  for (let y = cloudRect.y; y < cloudRect.y + cloudRect.h; y++) {
    for (let x = cloudRect.x; x < cloudRect.x + cloudRect.w; x++) palette.add(rgb((y * width + x) * 4));
  }
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < out.length; i += 4) {
    if (palette.has(rgb(i))) out[i + 3] = 0;
  }
  return out;
}
