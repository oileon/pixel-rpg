// Constantes de gameplay (alcances, tempos, regeneração, teclas). Fórmulas em docs/design.md.

// ---------- Combate do jogador ----------
/** Alcance do ataque corpo a corpo (px, pé a pé). */
export const PLAYER_ATTACK_RANGE = 44;
/** Intervalo para recalcular o caminho ao perseguir um alvo. */
export const CHASE_REPATH_MS = 250;
/** Tempo entre o golpe fatal e a volta ao ponto seguro (efeito visual). */
export const DEATH_DELAY_MS = 1200;
/** Espera ao chegar num mapa antes de mandar um jogador caído ao ponto seguro (deixa o fade terminar). */
export const DOWNED_ARRIVAL_DELAY_MS = 300;

// ---------- Monstros ----------
/** Espera antes do primeiro golpe de um monstro que acabou de alcançar o jogador. */
export const MONSTER_WINDUP_MS = 300;
/** Coleira: raio da área de origem + isto (em tiles). */
export const LEASH_EXTRA_TILES = 6;
/** Perde o interesse se o jogador ficar mais longe que isto (px). */
export const LOSE_TARGET_RANGE = 360;
/** Considera que chegou em casa (px). */
export const HOME_ARRIVAL_RANGE = 24;
/** Intervalo mínimo entre tentativas de caminho de volta para casa. */
export const RETURN_REPATH_MS = 1000;
/** Prazo para chegar em casa: distância/velocidade × fator + folga. Depois disso teleporta (fora da câmera). */
export const RETURN_TIMEOUT_FACTOR = 1.5;
export const RETURN_TIMEOUT_SLACK_MS = 2000;
/** Passado o prazo por mais este tempo, teleporta mesmo à vista (monstro realmente preso). */
export const RETURN_FORCE_TELEPORT_MS = 6000;
/** Fração do HP máximo recuperada por segundo enquanto volta para casa. */
export const RETURN_REGEN_PER_SEC = 0.25;

// ---------- Regeneração do jogador ----------
/** Tempo sem combate antes de começar a regenerar. */
export const REGEN_COMBAT_COOLDOWN_MS = 5000;
/** Intervalo entre ticks de regeneração. */
export const REGEN_INTERVAL_MS = 3000;
/** HP por tick: max(REGEN_HP_MIN, floor(HPmáx / REGEN_HP_DIVISOR) + floor(VIT / REGEN_HP_VIT_DIVISOR)). */
export const REGEN_HP_MIN = 2;
export const REGEN_HP_DIVISOR = 30;
export const REGEN_HP_VIT_DIVISOR = 5;
/** SP por tick: max(REGEN_SP_MIN, floor(SPmáx / REGEN_SP_DIVISOR) + floor(INT / REGEN_SP_INT_DIVISOR)). */
export const REGEN_SP_MIN = 1;
export const REGEN_SP_DIVISOR = 50;
export const REGEN_SP_INT_DIVISOR = 6;

// ---------- Itens no chão ----------
/** Distância para pegar um item clicado. */
export const PICKUP_RANGE = 22;
/** Raio em volta do clique que conta como "clicou no item". */
export const PICKUP_CLICK_RADIUS = 20;
/** Idade mínima de um drop antes do auto-pegar (deixa a animação de queda aparecer). */
export const AUTO_PICKUP_DELAY_MS = 500;
/** Intervalo das varreduras do auto-pegar. */
export const AUTO_PICKUP_INTERVAL_MS = 500;
/** Raio (px) em volta do jogador que o auto-pegar alcança. */
export const AUTO_PICKUP_RADIUS = 320;
export const GROUND_ITEM_LIFETIME_MS = 60_000;

// ---------- Bestiário ----------
/** Intervalo da checagem de monstros na tela (contam como "vistos"). */
export const SEEN_CHECK_MS = 500;

// ---------- Save ----------
/** Autosave periódico (além de trocar de mapa e fechar a aba). */
export const AUTOSAVE_INTERVAL_MS = 30_000;

// ---------- Teclas (única fonte para handlers e dicas) ----------
export const KEYS = {
  stats: 'C', // S é o "baixo" do WASD
  inventory: 'I',
  /** Bestiário (monstros vistos, abates, Selos). */
  bestiary: 'B',
  autoPickup: 'P',
  /** Liga/desliga o som (preferência salva no save). */
  mute: 'M',
  /** Volume global −/+ (caracteres, vale teclado principal e numérico). */
  volumeDown: ['-'],
  volumeUp: ['=', '+'],
  close: 'ESC',
  /** Apertar duas vezes em 3 s apaga o save e recomeça. */
  newGame: 'F10',
} as const;

/** Teclas da barra de atalhos (nomes do Phaser) e o rótulo mostrado em cada slot. */
export const HOTBAR_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'] as const;
export const HOTBAR_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
/** Janela para confirmar o Novo jogo. */
export const NEW_GAME_CONFIRM_MS = 3000;
