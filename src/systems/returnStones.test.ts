import { beforeEach, describe, expect, it } from 'vitest';
import { FOREST_MAP } from '../maps/forest';
import { FIELD_MAP } from '../maps/field';
import { TOWN_MAP } from '../maps/town';
import { activateStone, allReturnStones, isStoneActive, teleportDestinations } from './returnStoneState';
import { session } from './session';

const town = TOWN_MAP.returnStones![0]!;
const field = FIELD_MAP.returnStones![0]!;
const forest = FOREST_MAP.returnStones![0]!;

describe('Pedras de Retorno', () => {
  beforeEach(() => {
    session.activatedStones = [];
  });

  it('lista as pedras de todos os mapas', () => {
    expect(allReturnStones().map((r) => r.stone.id).sort()).toEqual(['field', 'forest', 'town']);
  });

  it('a da Vila já começa ativa; as outras só depois de usadas', () => {
    expect(isStoneActive(town)).toBe(true);
    expect(isStoneActive(forest)).toBe(false);
    expect(activateStone(forest)).toBe(true);
    expect(isStoneActive(forest)).toBe(true);
    expect(activateStone(forest)).toBe(false);
    expect(activateStone(town)).toBe(false);
    expect(session.activatedStones).toEqual(['forest']);
  });

  it('teleporte vai só para as outras pedras ativadas', () => {
    expect(teleportDestinations('forest').map((r) => r.stone.id)).toEqual(['town']);
    activateStone(field);
    activateStone(forest);
    expect(teleportDestinations('forest').map((r) => r.stone.id)).toEqual(['town', 'field']);
    const toTown = teleportDestinations('field').find((r) => r.stone.id === 'town')!;
    expect(toTown.mapId).toBe('town');
    expect(TOWN_MAP.spawns[toTown.stone.spawnId]).toBeDefined();
  });
});
