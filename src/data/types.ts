// Tipos dos dados de jogo (src/data/*.json).

export type Element = 'neutral' | 'fire' | 'water' | 'earth' | 'wind';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type MonsterBehavior = 'passive' | 'aggressive';

export type StatKey = 'str' | 'agi' | 'vit' | 'int' | 'dex' | 'luk';

export type BaseStats = Record<StatKey, number>;

/** Gerador de números aleatórios em [0, 1). Injetável para testes determinísticos. */
export type Rng = () => number;

export interface DropEntry {
  itemId: string;
  /** Probabilidade por abate, 0..1. */
  chance: number;
  /** Quantidade fixa (padrão 1). */
  quantity?: number;
}

export interface CurrencyDrop {
  min: number;
  max: number;
  /** Probabilidade por abate, 0..1. */
  chance: number;
}

/** Moeda do jogo (currency.json). O nome ainda é provisório: nunca escrever o nome no código. */
export interface CurrencyDef {
  /** Id interno fixo: "currency". */
  id: string;
  /** Nome exibido ao jogador. */
  name: string;
  iconColor: string;
  /** Limite da bolsa. */
  max: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  /** Descrição visual/lore — referência para a arte. */
  description: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  hit: number;
  flee: number;
  /** ASPD na escala estilo RO (maior = mais rápido); ver attackDelayMs em stats.ts. */
  aspd: number;
  /** Velocidade de movimento em pixels/segundo. */
  moveSpeed: number;
  exp: number;
  element: Element;
  sealId: string;
  fragmentsPerKill: number;
  /** Moeda que cai por abate (vai direto para a bolsa). */
  currency?: CurrencyDrop;
  drops: DropEntry[];
  behavior: MonsterBehavior;
  /** Raio de detecção em pixels (usado por agressivos; passivos só reagem quando atacados). */
  aggroRange: number;
  /** Alcance de ataque em pixels. */
  attackRange: number;
}

export type ItemType = 'consumable' | 'material' | 'equipment';

export type EquipSlot = 'weapon' | 'armor' | 'head' | 'accessory';

export type WeaponType = 'melee' | 'ranged';

export interface EquipBonus {
  /** HP/SP máximos somados depois do multiplicador de VIT/INT. */
  maxHp?: number;
  maxSp?: number;
  atk?: number;
  def?: number;
  matk?: number;
  mdef?: number;
  hit?: number;
  flee?: number;
  crit?: number;
  stats?: Partial<BaseStats>;
}

export interface EquipInfo extends EquipBonus {
  slot: EquipSlot;
  weaponType?: WeaponType;
  /** Elemento do ataque, só para armas (padrão neutral). */
  element?: Element;
  /** Nível mínimo para equipar. */
  requiredLevel?: number;
  /** Quantidade de encaixes para Selos (0 a 3). */
  sealSlots?: number;
}

export interface ConsumableEffect {
  hp?: number;
  sp?: number;
}

export interface ItemDef {
  id: string;
  /** Cor do ícone provisório (a forma vem do tipo) até existir arte própria. */
  iconColor: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: Rarity;
  /** Máximo por slot do inventário (equipamentos = 1). */
  maxStack: number;
  /** Preço de venda para NPC. */
  sellPrice: number;
  effect?: ConsumableEffect;
  equip?: EquipInfo;
}

export interface StartingKit {
  equipment: Partial<Record<EquipSlot, string>>;
  items: { itemId: string; quantity: number }[];
}

export interface ClassDef {
  id: string;
  name: string;
  description: string;
  /** 0 = Aprendiz, 1 = Pacto, 2 = especialização. */
  tier: number;
  /** Classe de origem (null para Aprendiz). */
  parent: string | null;
  /** Espírito animal do Pacto (null para Aprendiz). */
  spirit: string | null;
  /** Nível necessário para firmar o Pacto. */
  requiredLevel: number;
  /** Ainda não jogável quando false (esqueleto para marcos futuros). */
  available: boolean;
  /** Classe com que um personagem novo começa (exatamente uma). */
  starter?: boolean;
  /** Equipamentos e itens de um personagem novo desta classe. */
  startingKit?: StartingKit;
  baseHp: number;
  hpPerLevel: number;
  baseSp: number;
  spPerLevel: number;
  /** ASPD base (escala estilo RO) antes de AGI/DEX. */
  baseAspd: number;
  /** Velocidade de movimento em pixels/segundo. */
  moveSpeed: number;
  /** Bônus fixos de stats concedidos pela classe. */
  statBonus: Partial<BaseStats>;
  /** Ids de skills (Marco 2+). */
  skills: string[];
}

export interface ExpTable {
  maxLevel: number;
  /** expToNext[i] = EXP necessária para ir do nível i+1 para i+2. Tamanho = maxLevel - 1. */
  expToNext: number[];
}

// ---------- Sensação de combate (feel.json) ----------

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface AttackFeel {
  /** Nome da animação de ataque no manifesto; sem ela, o jogador dá um avanço ("lunge") procedural. */
  animation: string;
  /** Fração da animação em que o golpe acerta (0..1). */
  impactFraction: number;
  /** A animação nunca passa desta fração do intervalo de ataque (ASPD). */
  maxSwingFraction: number;
  minSwingMs: number;
  maxSwingMs: number;
  /** Folga de alcance no impacto: o alvo pode ter se afastado um pouco durante o golpe. */
  rangeLeewayPx: number;
  lungePx: number;
  lungeOutMs: number;
  lungeBackMs: number;
}

export interface FeelConfig {
  attack: AttackFeel;
  hitStop: { normalMs: number; critMs: number; killBonusMs: number; maxMs: number };
  flash: { monsterColor: string; monsterMs: number; playerColor: string; playerMs: number };
  knockback: { normalPx: number; critPx: number; outMs: number; backMs: number };
  shake: { critMs: number; critIntensity: number; heavyHitFraction: number; heavyMs: number; heavyIntensity: number };
  lootFly: {
    durationMs: number;
    staggerMs: number;
    arcPx: number;
    coinsPerParticle: number;
    maxCoinParticles: number;
    fragmentParticles: number;
    endScale: number;
    /** Destinos na tela (UIScene, 960×540): contador de moeda, HUD do jogador (fragmentos) e a bolsa. */
    coinTarget: ScreenPoint;
    fragmentTarget: ScreenPoint;
    bagTarget: ScreenPoint;
  };
  audio: { defaultVolume: number; volumeStep: number };
}

// ---------- Efeitos sonoros sintetizados (sfx.json) ----------

export type SfxId = 'hit' | 'crit' | 'miss' | 'hurt' | 'monsterDeath' | 'pickupItem' | 'coin' | 'levelUp';

export type SfxWave = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'noise';

/** Uma camada de som: oscilador (ou ruído) com envelope de ataque rápido e decaimento exponencial. */
export interface SfxLayer {
  wave: SfxWave;
  /** Frequência inicial e final (Hz); ignorada no ruído. */
  freq?: [number, number];
  ms: number;
  gain: number;
  delayMs?: number;
  attackMs?: number;
  filter?: { type: 'lowpass' | 'highpass' | 'bandpass'; freq: number };
}

export type SfxBank = Record<SfxId, SfxLayer[]>;

// ---------- Selos (seals.json) e bestiário (bestiary.json) ----------

/** Grau de um Selo: I, II ou III. */
export type SealGrade = 1 | 2 | 3;

/** Família de monstro (para a Ressonância de família). */
export type MonsterFamily = 'gosma' | 'alada' | 'casco' | 'flora';

export interface SealDef {
  /** Id do Selo (igual ao `sealId` do monstro). */
  id: string;
  /** Monstro que dá os fragmentos (pode ainda não existir em monsters.json: conteúdo de marcos futuros). */
  monsterId: string;
  name: string;
  element: Element;
  family: MonsterFamily;
  /** Slots de equipamento em que o Selo pode ser encaixado. */
  slots: EquipSlot[];
  /** Fragmentos para completar um Selo de grau I. */
  fragmentsRequired: number;
  /** Bônus por grau: [I, II, III]. */
  grades: [EquipBonus, EquipBonus, EquipBonus];
  /** Lore curta revelada no bestiário ao obter o Selo. */
  lore: string;
}

export interface ResonanceRule {
  id: string;
  name: string;
  description: string;
  /** Agrupa os Selos encaixados por elemento ou por família. */
  kind: 'element' | 'family';
  /** Selos no mesmo grupo para ativar. */
  minCount: number;
  /** true = só conta Selos diferentes (espécies distintas). */
  distinct: boolean;
  /** Bônus por grupo (elemento ou família); grupos sem entrada não ressoam. */
  bonuses: Partial<Record<string, EquipBonus>>;
}

export interface SealsData {
  /** Selos de um grau fundidos para formar 1 do grau seguinte. */
  fusionCost: number;
  familyNames: Record<MonsterFamily, string>;
  seals: SealDef[];
  resonances: ResonanceRule[];
}

export interface BestiaryConfig {
  /** Abates para revelar os stats básicos. */
  statsKills: number;
  /** Abates para revelar os drops. */
  dropsKills: number;
}
