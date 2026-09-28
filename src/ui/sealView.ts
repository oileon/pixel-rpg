// Textos (sem Phaser) da aba Selos do Inventário e do Bestiário.

import { BESTIARY, CURRENCY, getItem, getSeal, hasSeal, SEALS_DATA } from '../data';
import type { Element, MonsterBehavior, MonsterDef, SealGrade } from '../data/types';
import { bestiaryReveal, type BestiaryEntry } from '../systems/bestiary';
import {
  activeResonances,
  GRADE_NAMES,
  SEAL_GRADES,
  sealCount,
  socketedSeals,
  type ActiveResonance,
  type SealRef,
  type SealStock,
  type SocketMap,
} from '../systems/seals';
import { bonusParts, EQUIP_SLOT_NAMES, EQUIP_SLOTS } from './uiLogic';

export const ELEMENT_NAMES: Record<Element, string> = {
  neutral: 'Neutro',
  fire: 'Fogo',
  water: 'Água',
  earth: 'Terra',
  wind: 'Vento',
};

/** Cor do elemento (encaixes, nomes de Selo). */
export const ELEMENT_COLORS: Record<Element, number> = {
  neutral: 0xc9ced6,
  fire: 0xff7a4a,
  water: 0x5fb4ff,
  earth: 0xc7a257,
  wind: 0x8fe3b0,
};

export function elementCss(element: Element): string {
  return `#${ELEMENT_COLORS[element].toString(16).padStart(6, '0')}`;
}

const BEHAVIOR_NAMES: Record<MonsterBehavior, string> = {
  passive: 'Passivo',
  aggressive: 'Agressivo',
};

/** "Arma, Armadura". */
export function sealSlotsText(sealId: string): string {
  const seal = getSeal(sealId);
  return EQUIP_SLOTS.filter((s) => seal.slots.includes(s))
    .map((s) => EQUIP_SLOT_NAMES[s])
    .join(', ');
}

/** Tooltip de um Selo: nome e grau, elemento/família, efeito, onde encaixa e quantos tem. */
export function sealTooltipText(ref: SealRef, owned?: number): string {
  const seal = getSeal(ref.sealId);
  const lines = [`${seal.name} ${GRADE_NAMES[ref.grade]}${owned !== undefined ? ` (${owned})` : ''}`];
  lines.push(`${ELEMENT_NAMES[seal.element]} · ${SEALS_DATA.familyNames[seal.family]}`);
  lines.push(bonusParts(seal.grades[ref.grade - 1]).join(', '));
  lines.push(`Encaixa em: ${sealSlotsText(ref.sealId)}`);
  return lines.join('\n');
}

/** "Eco Elemental (Água): SP +10, MDEF +3". */
export function resonanceText(r: ActiveResonance): string {
  const group =
    r.rule.kind === 'element'
      ? ELEMENT_NAMES[r.group as Element]
      : (SEALS_DATA.familyNames as Record<string, string>)[r.group] ?? r.group;
  return `${r.rule.name} (${group}): ${bonusParts(r.bonus).join(', ')}`;
}

export function activeResonanceLines(sockets: SocketMap): string[] {
  return activeResonances(socketedSeals(sockets)).map(resonanceText);
}

/** Linhas do estojo: um Selo por linha, com a contagem de cada grau. Só Selos que o jogador tem. */
export function stockRows(stock: SealStock): { sealId: string; counts: Record<SealGrade, number> }[] {
  return Object.keys(stock)
    .filter((id) => hasSeal(id))
    .map((sealId) => ({
      sealId,
      counts: { 1: sealCount(stock, { sealId, grade: 1 }), 2: sealCount(stock, { sealId, grade: 2 }), 3: sealCount(stock, { sealId, grade: 3 }) },
    }))
    .filter((row) => SEAL_GRADES.some((g) => row.counts[g] > 0));
}

/** Muda quando algo mostrado na aba Selos muda. */
export function sealsSignature(stock: SealStock, sockets: SocketMap): string {
  const s = Object.entries(stock)
    .map(([id, c]) => `${id}:${c.join('.')}`)
    .sort()
    .join(',');
  const k = EQUIP_SLOTS.map((slot) => (sockets[slot] ?? []).map((r) => (r ? `${r.sealId}.${r.grade}` : '-')).join('+')).join(',');
  return `${s}|${k}`;
}

// ---------- Bestiário ----------

export interface BestiaryLine {
  text: string;
  color?: string;
}

export interface BestiaryDetail {
  title: string;
  /** Sprite em silhueta (ainda não visto). */
  silhouette: boolean;
  lines: BestiaryLine[];
}

const MUTED = '#9aa6b8';
const LOCKED = '#6f7a8c';
const GOLD = '#ffd76a';

/** Nome na lista do bestiário. */
export function bestiaryListName(monster: MonsterDef, entry: BestiaryEntry | undefined): string {
  return entry ? monster.name : '???';
}

/** Chance de drop legível: "70%", "2%", "0,5%". */
export function chanceText(chance: number): string {
  const pct = chance * 100;
  return `${pct >= 1 ? Math.round(pct) : pct.toFixed(1).replace('.', ',')}%`;
}

/**
 * Detalhe de uma entrada, revelada aos poucos: visto (nome, descrição, progresso do Selo),
 * 1 abate (stats), 10 abates (drops), Selo obtido (lore e efeitos por grau).
 */
export function bestiaryDetail(
  monster: MonsterDef,
  entry: BestiaryEntry | undefined,
  fragments: number,
  config = BESTIARY,
): BestiaryDetail {
  const reveal = bestiaryReveal(entry, config);
  if (!reveal.seen) {
    return { title: '???', silhouette: true, lines: [{ text: 'Ainda não encontrado.', color: MUTED }] };
  }
  const kills = entry?.kills ?? 0;
  const seal = hasSeal(monster.sealId) ? getSeal(monster.sealId) : null;
  const lines: BestiaryLine[] = [{ text: monster.description, color: MUTED }, { text: `Abates: ${kills}` }];
  if (seal) lines.push({ text: `${seal.name}: ${fragments}/${seal.fragmentsRequired} fragmentos`, color: GOLD });

  if (reveal.stats) {
    lines.push({
      text: `Nv ${monster.level} · ${ELEMENT_NAMES[monster.element]} · ${BEHAVIOR_NAMES[monster.behavior]}`,
    });
    lines.push({ text: `HP ${monster.hp}  ATK ${monster.atk}  DEF ${monster.def}  FLEE ${monster.flee}  EXP ${monster.exp}` });
  } else {
    lines.push({ text: `Stats: derrote ${config.statsKills}× para revelar.`, color: LOCKED });
  }

  if (reveal.drops) {
    const drops = monster.drops.map((d) => `${getItem(d.itemId).name} ${chanceText(d.chance)}`);
    if (monster.currency) drops.push(`${CURRENCY.name} ${monster.currency.min}–${monster.currency.max}`);
    lines.push({ text: `Drops: ${drops.join(', ')}` });
  } else {
    lines.push({ text: `Drops: derrote ${config.dropsKills}× para revelar (${Math.min(kills, config.dropsKills)}/${config.dropsKills}).`, color: LOCKED });
  }

  if (seal && reveal.lore) {
    lines.push({ text: seal.lore, color: '#c8e6ff' });
    const grades = SEAL_GRADES.map((g) => `${GRADE_NAMES[g]}: ${bonusParts(seal.grades[g - 1]).join(', ')}`);
    lines.push({ text: `Selo (${sealSlotsText(seal.id)}) — ${grades.join(' · ')}`, color: GOLD });
  } else if (seal) {
    lines.push({ text: 'Lore: obtenha o Selo para revelar.', color: LOCKED });
  }
  return { title: monster.name, silhouette: false, lines };
}
