import { describe, expect, it } from 'vitest';
import { EXP_TABLE, getItem } from '../data';
import { expToNextLevel } from '../systems/exp';
import { addItem } from '../systems/inventory';
import { createInitialPlayerState, playerDerived, type PlayerState } from './playerState';
import { createSave, parseSave, SAVE_VERSION, serializeSave, type KnownMaps, type Migration, type SaveLocation } from './save';
import { defaultSettings } from './settings';

const knownMaps: KnownMaps = { town: ['start', 'fromField'], field: ['start', 'fromTown'] };
const town: SaveLocation = { mapId: 'town', spawnId: 'start' };
const field: SaveLocation = { mapId: 'field', spawnId: 'fromTown' };
const options = { knownMaps, fallback: town };

function progressed(): PlayerState {
  const s = createInitialPlayerState();
  s.level = 4;
  s.exp = 17;
  s.stats = { ...s.stats, str: 10, vit: 5 };
  s.inventory = addItem(s.inventory, getItem('colete_lona'), 1).inventory;
  s.inventory = addItem(s.inventory, getItem('tonico_frutas'), 3).inventory;
  s.sealFragments = { seal_pomi: 40 };
  s.seals = { seal_pomi: [2, 1, 0], seal_cascudo: [0, 0, 1] };
  s.equipmentSeals = { weapon: [{ sealId: 'seal_plumito', grade: 2 }] };
  s.bestiary = { pomi: { kills: 60, sealObtained: true }, cascudo: { kills: 0, sealObtained: false } };
  s.currency = 321;
  s.hotbar = [null, { kind: 'item', itemId: 'tonico_frutas' }, null, null, null, null, null, null];
  s.fatigue = { until: 123456 };
  s.autoPickup = true;
  s.hp = 20;
  s.sp = 5;
  return s;
}

function roundTrip(state: PlayerState, location = field, safe = town) {
  return parseSave(serializeSave(createSave(state, location, safe, 999)), options);
}

describe('save: ida e volta', () => {
  it('preserva todo o progresso', () => {
    const s = progressed();
    const r = roundTrip(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const g = r.game;
    expect(g.warnings).toEqual([]);
    expect(g.location).toEqual(field);
    expect(g.lastSafePoint).toEqual(town);
    expect(g.savedAt).toBe(999);
    for (const key of ['classId', 'level', 'exp', 'stats', 'equipment', 'sealFragments', 'seals', 'equipmentSeals', 'bestiary', 'currency', 'hotbar', 'fatigue', 'autoPickup', 'hp', 'sp'] as const) {
      expect(g.state[key], key).toEqual(s[key]);
    }
    expect(g.state.inventory.slots).toEqual(s.inventory.slots);
    expect(g.state.lastCombatAt).toBeNull();
  });

  it('personagem novo também faz ida e volta', () => {
    const s = createInitialPlayerState();
    const r = roundTrip(s, town);
    expect(r.ok && r.game.state.hotbar).toEqual(s.hotbar);
  });

  it('salvo caído acorda no ponto seguro com HP cheio', () => {
    const s = progressed();
    s.hp = 0;
    s.downed = true;
    const r = roundTrip(s, field, town);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.location).toEqual(town);
    expect(r.game.state.downed).toBe(false);
    expect(r.game.state.hp).toBe(playerDerived(r.game.state).maxHp);
  });
});

describe('save: corrompido ou antigo não quebra', () => {
  const bad = ['', 'não é json', 'null', '[]', '42', '{}', '{"version":1}', '{"version":"1","player":{}}'];
  for (const raw of bad) {
    it(`recusa ${JSON.stringify(raw)}`, () => {
      const r = parseSave(raw, options);
      expect(r.ok).toBe(false);
    });
  }

  it('recusa versão mais nova e versão velha sem migração', () => {
    const data = createSave(progressed(), field, town, 1);
    expect(parseSave(JSON.stringify({ ...data, version: SAVE_VERSION + 1 }), options).ok).toBe(false);
    expect(parseSave(JSON.stringify({ ...data, version: 0 }), options).ok).toBe(false);
  });

  it('recusa campos com tipo errado', () => {
    const data = createSave(progressed(), field, town, 1);
    const cases: Array<(d: any) => void> = [
      (d) => (d.player.level = 0),
      (d) => (d.player.level = 999),
      (d) => (d.player.stats.str = 'dez'),
      (d) => (d.player.inventory = 'x'),
      (d) => (d.player.inventory[0] = { itemId: 'maca_do_ceu', quantity: -1 }),
      (d) => (d.player.currency = -5),
      (d) => (d.player.classId = 'dragao'),
      (d) => (d.player.hotbar = [{ kind: 'magia' }]),
      (d) => delete d.player,
    ];
    for (const mutate of cases) {
      const copy = JSON.parse(JSON.stringify(data));
      mutate(copy);
      expect(parseSave(JSON.stringify(copy), options).ok, mutate.toString()).toBe(false);
    }
  });

  it('corrige problemas pequenos com aviso', () => {
    const data = JSON.parse(serializeSave(createSave(progressed(), field, town, 1)));
    data.player.inventory[5] = { itemId: 'item_que_saiu', quantity: 2 };
    data.player.equipment.head = 'maca_do_ceu';
    data.player.hotbar[7] = { kind: 'item', itemId: 'item_que_saiu' };
    data.location = { mapId: 'mapa_apagado', spawnId: 'start' };
    const r = parseSave(JSON.stringify(data), options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.state.inventory.slots[5]).toBeNull();
    expect(r.game.state.equipment.head).toBeUndefined();
    expect(r.game.state.hotbar[7]).toBeNull();
    expect(r.game.location).toEqual(town);
    expect(r.game.warnings.length).toBe(4);
  });

  it('stats acima dos pontos do nível voltam ao padrão', () => {
    const data = JSON.parse(serializeSave(createSave(progressed(), field, town, 1)));
    data.player.level = 1;
    data.player.stats.str = 90;
    const r = parseSave(JSON.stringify(data), options);
    expect(r.ok && r.game.state.stats.str).toBe(1);
  });
});

describe('save: migração', () => {
  it('aplica a migração da versão anterior', () => {
    const current = JSON.parse(serializeSave(createSave(progressed(), field, town, 1)));
    // Simula um save "v0" sem moeda e uma migração que a adiciona.
    const old = { ...current, version: SAVE_VERSION - 1, player: { ...current.player } };
    delete old.player.currency;
    const migrations: Record<number, Migration> = {
      [SAVE_VERSION - 1]: (d) => ({ ...d, version: SAVE_VERSION, player: { ...(d.player as object), currency: 7 } }),
    };
    const r = parseSave(JSON.stringify(old), { ...options, migrations });
    expect(r.ok && r.game.state.currency).toBe(7);
  });

  it('migração que não sobe a versão é recusada', () => {
    const current = JSON.parse(serializeSave(createSave(progressed(), field, town, 1)));
    const old = { ...current, version: SAVE_VERSION - 1 };
    const r = parseSave(JSON.stringify(old), { ...options, migrations: { [SAVE_VERSION - 1]: (d) => d } });
    expect(r.ok).toBe(false);
  });
});

describe('save: preferências (v2)', () => {
  it('volume e mudo fazem ida e volta', () => {
    const prefs = { audio: { volume: 0.35, muted: true } };
    const r = parseSave(serializeSave(createSave(progressed(), field, town, 1, prefs)), options);
    expect(r.ok && r.game.settings).toEqual(prefs);
  });

  it('save v1 (sem preferências) migra para a versão atual com o padrão', () => {
    const current = JSON.parse(serializeSave(createSave(progressed(), field, town, 1)));
    delete current.settings;
    const r = parseSave(JSON.stringify({ ...current, version: 1 }), options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.settings).toEqual(defaultSettings());
    expect(r.game.warnings).toEqual([]);
    expect(r.game.state.currency).toBe(321);
  });

  it('preferências inválidas voltam ao padrão com aviso, sem perder o save', () => {
    const data = JSON.parse(serializeSave(createSave(progressed(), field, town, 1)));
    data.settings = { audio: { volume: 'alto', muted: 1 } };
    const r = parseSave(JSON.stringify(data), options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.settings).toEqual(defaultSettings());
    expect(r.game.warnings.length).toBe(1);
  });

  it('volume fora da faixa é limitado', () => {
    const data = JSON.parse(serializeSave(createSave(progressed(), field, town, 1)));
    data.settings = { audio: { volume: 7, muted: false } };
    const r = parseSave(JSON.stringify(data), options);
    expect(r.ok && r.game.settings.audio.volume).toBe(1);
  });
});

describe('save: Selos e bestiário (v3)', () => {
  function v2Save(): Record<string, any> {
    const data = JSON.parse(serializeSave(createSave(progressed(), field, town, 1)));
    data.version = 2;
    data.player.seals = { seal_pomi: 1 };
    data.player.sealFragments = { seal_pomi: 40, seal_cascudo: 7 };
    delete data.player.equipmentSeals;
    delete data.player.bestiary;
    return data;
  }

  it('save v2 migra: Selos viram grau I e o bestiário é deduzido dos fragmentos', () => {
    const r = parseSave(JSON.stringify(v2Save()), options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.warnings).toEqual([]);
    expect(r.game.state.seals).toEqual({ seal_pomi: [1, 0, 0] });
    expect(r.game.state.equipmentSeals).toEqual({});
    // Pomi: (1 × 100 + 40) / 2 por abate = 70; Cascudo: 7 / 1 = 7.
    expect(r.game.state.bestiary).toEqual({
      pomi: { kills: 70, sealObtained: true },
      cascudo: { kills: 7, sealObtained: false },
    });
  });

  it('Selo encaixado conta nos atributos depois de carregar', () => {
    const s = progressed();
    const r = roundTrip(s);
    expect(r.ok && playerDerived(r.game.state)).toEqual(playerDerived(s));
  });

  it('Selo em slot que não aceita ou sem encaixe volta ao estojo com aviso', () => {
    const data = JSON.parse(serializeSave(createSave(progressed(), field, town, 1)));
    // Cascudo não encaixa em arma; a Adaga só tem 1 encaixe.
    data.player.equipmentSeals.weapon = [{ sealId: 'seal_plumito', grade: 2 }, { sealId: 'seal_cascudo', grade: 1 }];
    const r = parseSave(JSON.stringify(data), options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.state.equipmentSeals.weapon).toEqual([{ sealId: 'seal_plumito', grade: 2 }]);
    expect(r.game.state.seals.seal_cascudo).toEqual([1, 0, 1]);
    expect(r.game.warnings.length).toBe(1);
  });

  it('Selo e monstro removidos do jogo são descartados com aviso', () => {
    const data = JSON.parse(serializeSave(createSave(progressed(), field, town, 1)));
    data.player.seals.seal_sumiu = [1, 0, 0];
    data.player.bestiary.dragao = { kills: 3, sealObtained: false };
    const r = parseSave(JSON.stringify(data), options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.state.seals.seal_sumiu).toBeUndefined();
    expect(r.game.state.bestiary.dragao).toBeUndefined();
    expect(r.game.warnings.length).toBe(2);
  });

  it('recusa Selos e bestiário com formato errado', () => {
    const data = createSave(progressed(), field, town, 1);
    const cases: Array<(d: any) => void> = [
      (d) => (d.player.seals = { seal_pomi: 3 }),
      (d) => (d.player.seals = { seal_pomi: [1, -1, 0] }),
      (d) => (d.player.equipmentSeals = { weapon: [{ sealId: 'seal_pomi', grade: 4 }] }),
      (d) => (d.player.bestiary = { pomi: { kills: 'muitos', sealObtained: false } }),
      (d) => delete d.player.bestiary,
    ];
    for (const mutate of cases) {
      const copy = JSON.parse(JSON.stringify(data));
      mutate(copy);
      expect(parseSave(JSON.stringify(copy), options).ok, mutate.toString()).toBe(false);
    }
  });
});

describe('save: correções do QA', () => {
  const base = () => JSON.parse(serializeSave(createSave(progressed(), field, town, 1)));

  it('atalhos repetidos: fica o primeiro, com aviso', () => {
    const data = base();
    data.player.hotbar[5] = { kind: 'item', itemId: 'tonico_frutas' };
    const r = parseSave(JSON.stringify(data), options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.state.hotbar[1]).toEqual({ kind: 'item', itemId: 'tonico_frutas' });
    expect(r.game.state.hotbar[5]).toBeNull();
    expect(r.game.warnings).toEqual(['Atalho repetido removido (tecla 6).']);
  });

  it('skill desconhecida na barra é descartada com aviso', () => {
    const data = base();
    data.player.hotbar[3] = { kind: 'skill', skillId: 'futura' };
    const r = parseSave(JSON.stringify(data), options);
    expect(r.ok && r.game.state.hotbar[3]).toBeNull();
    expect(r.ok && r.game.warnings.length).toBe(1);
  });

  it('EXP acima do necessário para o nível é limitada, com aviso', () => {
    const data = base();
    data.player.exp = 999_999;
    const r = parseSave(JSON.stringify(data), options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.state.exp).toBe(expToNextLevel(4, EXP_TABLE)! - 1);
    expect(r.game.warnings.length).toBe(1);
  });

  it('no nível máximo a EXP fica em 0', () => {
    const data = base();
    data.player.level = EXP_TABLE.maxLevel;
    data.player.exp = 50;
    const r = parseSave(JSON.stringify(data), options);
    expect(r.ok && r.game.state.exp).toBe(0);
  });

  it('pilha acima do máximo avisa e descarta o excedente', () => {
    const data = base();
    data.player.inventory[0] = { itemId: 'colete_lona', quantity: 3 };
    const r = parseSave(JSON.stringify(data), options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.state.inventory.slots[0]).toEqual({ itemId: 'colete_lona', quantity: 1 });
    expect(r.game.warnings.length).toBe(1);
  });

  it('save de versão mais nova é recusado marcando a versão (para não ser sobrescrito)', () => {
    const r = parseSave(JSON.stringify({ ...base(), version: SAVE_VERSION + 2 }), options);
    expect(r).toMatchObject({ ok: false, newerVersion: SAVE_VERSION + 2 });
    const broken = parseSave('não é json', options);
    expect(!broken.ok && broken.newerVersion).toBeUndefined();
  });
});
