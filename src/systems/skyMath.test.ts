import { describe, expect, it } from 'vitest';
import { PUFFS_ABOVE, PUFFS_BELOW, SKY_LAYERS } from '../assets/sky';
import { cutoutCloudPixels, inRange, puffExit, skyLayerOffset } from './skyMath';

describe('skyLayerOffset', () => {
  const layer = { parallax: 0.5, wind: { x: 10, y: 0 }, bob: 0 };

  it('acompanha a câmera pelo fator de parallax', () => {
    expect(skyLayerOffset(layer, 200, 100, 0)).toEqual({ x: 100, y: 50 });
  });

  it('deriva com o vento ao longo do tempo (para leste = tilePosition diminui)', () => {
    expect(skyLayerOffset(layer, 0, 0, 2000).x).toBe(-20);
  });

  it('o balanço fica dentro da amplitude', () => {
    for (let t = 0; t < 20000; t += 700) {
      expect(Math.abs(skyLayerOffset({ ...layer, bob: 3 }, 0, 0, t).y)).toBeLessThanOrEqual(3);
    }
  });

  it('camadas vão do fundo quase parado para a frente mais rápida', () => {
    const parallax = SKY_LAYERS.map((l) => l.parallax);
    const wind = SKY_LAYERS.map((l) => l.wind.x);
    expect(parallax).toEqual([...parallax].sort((a, b) => a - b));
    expect(wind).toEqual([...wind].sort((a, b) => a - b));
    expect(parallax[0]).toBeLessThan(0.1);
  });
});

describe('puffExit', () => {
  it('detecta saída por cada lado', () => {
    expect(puffExit(100, 100, 50, 30, 960, 540)).toBe('none');
    expect(puffExit(1100, 100, 50, 30, 960, 540)).toBe('right');
    expect(puffExit(-400, 100, 50, 30, 960, 540)).toBe('left');
    expect(puffExit(100, 700, 50, 30, 960, 540)).toBe('vertical');
  });

  it('nuvem que acabou de nascer à esquerda (fora da tela) não é reciclada', () => {
    expect(puffExit(-200, 100, 160, 60, 960, 540)).toBe('none');
  });
});

describe('grupos de nuvens avulsas', () => {
  it('as de cima são poucas e bem transparentes', () => {
    expect(PUFFS_ABOVE.count).toBeLessThan(PUFFS_BELOW.count);
    expect(PUFFS_ABOVE.alpha).toBeLessThanOrEqual(0.3);
  });

  it('inRange respeita a faixa', () => {
    expect(inRange([2, 4], () => 0)).toBe(2);
    expect(inRange([2, 4], () => 0.5)).toBe(3);
  });
});

describe('cutoutCloudPixels', () => {
  it('apaga só as cores que aparecem no tile de nuvem', () => {
    // Imagem 2x1: pixel 0 = "nuvem" (branco), pixel 1 = grama (verde).
    const data = new Uint8ClampedArray([255, 255, 255, 255, 0, 200, 0, 255]);
    const out = cutoutCloudPixels(data, 2, { x: 0, y: 0, w: 1, h: 1 });
    expect(out[3]).toBe(0);
    expect(out[7]).toBe(255);
    expect(data[3]).toBe(255);
  });
});
