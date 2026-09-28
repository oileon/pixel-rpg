import monstersJson from './monsters.json';
import itemsJson from './items.json';
import classesJson from './classes.json';
import expTableJson from './expTable.json';
import currencyJson from './currency.json';
import feelJson from './feel.json';
import sfxJson from './sfx.json';
import sealsJson from './seals.json';
import bestiaryJson from './bestiary.json';
import type {
  BestiaryConfig,
  ClassDef,
  CurrencyDef,
  ExpTable,
  FeelConfig,
  ItemDef,
  MonsterDef,
  SealDef,
  SealsData,
  SfxBank,
} from './types';

export * from './types';

export const MONSTERS = monstersJson as MonsterDef[];
export const ITEMS = itemsJson as ItemDef[];
export const CLASSES = classesJson as ClassDef[];
export const EXP_TABLE = expTableJson as ExpTable;
export const CURRENCY = currencyJson as CurrencyDef;
/** Parâmetros de "sensação" do combate (durações, intensidades, destinos do loot voando). */
export const FEEL = feelJson as FeelConfig;
export const SFX = sfxJson as SfxBank;
/** Selos, fusão e Ressonâncias (seals.json). */
// `grades` é tupla [I, II, III]: o JSON vira array, então o tamanho é conferido em data.test.ts.
export const SEALS_DATA = sealsJson as unknown as SealsData;
export const SEALS: readonly SealDef[] = SEALS_DATA.seals;
/** Abates para revelar cada parte do bestiário. */
export const BESTIARY = bestiaryJson as BestiaryConfig;

function indexById<T extends { id: string }>(list: T[]): ReadonlyMap<string, T> {
  return new Map(list.map((entry) => [entry.id, entry]));
}

const monstersById = indexById(MONSTERS);
const itemsById = indexById(ITEMS);
const classesById = indexById(CLASSES);
const sealsById = indexById([...SEALS]);

export function getMonster(id: string): MonsterDef {
  const monster = monstersById.get(id);
  if (!monster) throw new Error(`Monstro desconhecido: ${id}`);
  return monster;
}

export function getItem(id: string): ItemDef {
  const item = itemsById.get(id);
  if (!item) throw new Error(`Item desconhecido: ${id}`);
  return item;
}

/** Classe inicial de um personagem novo (`starter: true` em classes.json). */
export function getStarterClass(): ClassDef {
  const starter = CLASSES.find((c) => c.starter);
  if (!starter) throw new Error('Nenhuma classe inicial em classes.json');
  return starter;
}

export function getClass(id: string): ClassDef {
  const classDef = classesById.get(id);
  if (!classDef) throw new Error(`Classe desconhecida: ${id}`);
  return classDef;
}

export function getSeal(id: string): SealDef {
  const seal = sealsById.get(id);
  if (!seal) throw new Error(`Selo desconhecido: ${id}`);
  return seal;
}

export function hasSeal(id: string): boolean {
  return sealsById.has(id);
}
