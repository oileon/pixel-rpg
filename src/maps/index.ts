import { FIELD_MAP } from './field';
import { FOREST_MAP } from './forest';
import { TOWN_MAP } from './town';
import type { MapDef } from './types';

export * from './types';

export const MAPS: Readonly<Record<string, MapDef>> = {
  [TOWN_MAP.id]: TOWN_MAP,
  [FIELD_MAP.id]: FIELD_MAP,
  [FOREST_MAP.id]: FOREST_MAP,
};

export function getMap(id: string): MapDef {
  const map = MAPS[id];
  if (!map) throw new Error(`Mapa desconhecido: ${id}`);
  return map;
}
