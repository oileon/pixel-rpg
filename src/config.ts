// Constantes globais da engine.

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Tamanho de um tile em pixels. */
export const TILE_SIZE = 32;

/** Velocidade padrão do jogador em px/s (o gameplay pode sobrescrever em `player.speed`). */
export const DEFAULT_PLAYER_SPEED = 140;

/** Intervalo (ms) para recalcular o caminho enquanto o botão do mouse fica pressionado no chão. */
export const HOLD_REPATH_MS = 150;

/** Céu além da borda do mapa que a câmera pode mostrar (px) — só visual, colisão fica no mapa. */
export const CAMERA_SKY_MARGIN = 64;

/** Cor de fundo (o "mar de nuvens" visto por baixo das ilhas). */
export const SKY_COLOR = '#9fd3f5';

/** Tecla para falar com o NPC / usar o objeto mais perto (dentro do alcance). */
export const INTERACT_KEY = 'E';

/** Alcance (px, dos pés do jogador) para falar com NPCs e usar objetos como a Pedra de Retorno. */
export const INTERACT_RANGE = 56;
