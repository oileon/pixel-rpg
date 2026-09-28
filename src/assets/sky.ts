// Manifesto do mar de nuvens: camadas tileáveis com parallax/vento, nuvens avulsas e o tileset da borda
// da ilha com a nuvem recortada. Arquivo ausente → placeholder procedural (ver src/systems/sky.ts).

export interface SkyLayerDef {
  key: string;
  url: string;
  /** Quanto a camada acompanha a câmera (0 = parada na tela, 1 = presa ao mundo). */
  parallax: number;
  /** Deriva do vento em px/s (positivo = para leste/sul). */
  wind: { x: number; y: number };
  alpha: number;
  /** Amplitude (px) do balanço vertical lento — só o fundo se mexe, o mapa lógico fica parado. */
  bob: number;
}

/** Do fundo para a frente; todas ficam atrás da ilha. */
export const SKY_LAYERS: readonly SkyLayerDef[] = [
  { key: 'sky:far', url: 'assets/sky/sky-far.png', parallax: 0.05, wind: { x: 2, y: 0 }, alpha: 1, bob: 0 },
  { key: 'sky:mid', url: 'assets/sky/clouds-mid.png', parallax: 0.25, wind: { x: 7, y: 0.5 }, alpha: 1, bob: 1.5 },
  { key: 'sky:near', url: 'assets/sky/clouds-near.png', parallax: 0.5, wind: { x: 14, y: 1 }, alpha: 0.9, bob: 3 },
];

/** Nuvens avulsas (fundo transparente), usadas por baixo e por cima da ilha. */
export const SKY_PUFFS: readonly { key: string; url: string }[] = [1, 2, 3, 4].map((i) => ({
  key: `sky:cloud-${i}`,
  url: `assets/sky/cloud-${i}.png`,
}));

export interface PuffGroupDef {
  count: number;
  /** Faixas sorteadas por nuvem. */
  parallax: [number, number];
  speed: [number, number];
  scale: [number, number];
  alpha: number;
}

/** Por baixo: atrás da ilha, bem visíveis sobre o céu. */
export const PUFFS_BELOW: PuffGroupDef = { count: 7, parallax: [0.55, 0.85], speed: [10, 26], scale: [1, 2], alpha: 0.95 };
/** Por cima: poucas, grandes e bem transparentes, acima dos personagens (não atrapalham a leitura). */
export const PUFFS_ABOVE: PuffGroupDef = { count: 2, parallax: [1.2, 1.35], speed: [22, 34], scale: [2.5, 3.5], alpha: 0.2 };

/** Recorte da nuvem de cada tema: `THEMES[...].cutout` em src/assets/scenery.ts. */

/** Frame de nuvem pura (LLLL) do tileset base: fonte da paleta a recortar e célula que fica vazia. */
export const PURE_CLOUD_FRAME = 6;

/** Sombra da ilha projetada nas nuvens (px de deslocamento, cor, alfa). */
export const ISLAND_SHADOW = { dx: 6, dy: 20, color: 0x3b4f8a, alpha: 0.3 };
