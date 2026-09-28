import { describe, expect, it } from 'vitest';
import { CURRENCY, getItem, getMonster, getStarterClass } from '../data';
import { FATIGUE_DURATION_MS } from '../systems/exp';
import { REGEN_COMBAT_COOLDOWN_MS, REGEN_INTERVAL_MS } from './config';
import { countItem } from '../systems/inventory';
import { createSeededRng } from '../systems/loot';
import { statPointsForLevel } from '../systems/stats';
import {
  addCurrency,
  applyAllocation,
  assignSlotToHotbar,
  clearHotbarSlot,
  previewEquip,
  replacePlayerState,
  spendCurrency,
  useHotbarSlot,
  createInitialPlayerState,
  equipFromSlot,
  grantKill,
  knockOutPlayer,
  markCombat,
  needsRevive,
  pickUp,
  playerCombat,
  playerDerived,
  regenTick,
  respecPlayer,
  revivePlayer,
  takeDamage,
  unequip,
  updateRegen,
  useSlot,
  fuseSealStock,
  previewSocket,
  removeSealFrom,
  seeMonster,
  socketSealInto,
} from './playerState';

describe('estado inicial', () => {
  it('classe inicial e kit vêm de classes.json', () => {
    const s = createInitialPlayerState();
    const kit = getStarterClass().startingKit;
    expect(s.classId).toBe('aprendiz');
    expect(kit?.items[0]).toEqual({ itemId: 'maca_do_ceu', quantity: 5 });
    expect(s.level).toBe(1);
    expect(s.equipment.weapon).toBe('adaga_treino');
    expect(countItem(s.inventory, 'maca_do_ceu')).toBe(5);
    expect(s.hp).toBe(playerDerived(s).maxHp);
    expect(playerCombat(s).atk).toBe(13);
  });
});

describe('dano, morte e regeneração', () => {
  it('golpe fatal aplica Fadiga na hora; HP volta só ao reviver', () => {
    const s = createInitialPlayerState();
    expect(takeDamage(s, 10)).toBe(false);
    expect(takeDamage(s, 999)).toBe(true);
    knockOutPlayer(s, 1000);
    expect(s.fatigue?.until).toBe(1000 + FATIGUE_DURATION_MS);
    expect(s.hp).toBe(0);
    expect(needsRevive(s)).toBe(true);
    revivePlayer(s);
    expect(needsRevive(s)).toBe(false);
    expect(s.hp).toBe(playerDerived(s).maxHp);
  });

  it('HP 0 sem estar marcado como caído também exige reviver', () => {
    const s = createInitialPlayerState();
    s.hp = 0;
    expect(needsRevive(s)).toBe(true);
  });

  it('regeneração respeita o tempo fora de combate e o intervalo (relógio no estado)', () => {
    const s = createInitialPlayerState();
    s.hp = 10;
    markCombat(s, 1000);
    const lastInCombat = 1000 + REGEN_COMBAT_COOLDOWN_MS - 1;
    expect(updateRegen(s, lastInCombat)).toBe(false);
    // O primeiro tick só vem um intervalo inteiro depois da última checagem em combate.
    expect(updateRegen(s, lastInCombat + 1)).toBe(false);
    expect(updateRegen(s, lastInCombat + REGEN_INTERVAL_MS - 1)).toBe(false);
    expect(updateRegen(s, lastInCombat + REGEN_INTERVAL_MS)).toBe(true);
    const start = lastInCombat;
    expect(s.hp).toBe(12);
    knockOutPlayer(s, 0);
    expect(updateRegen(s, start + 10 * REGEN_INTERVAL_MS)).toBe(false);
  });

  it('regenera sem passar do máximo', () => {
    const s = createInitialPlayerState();
    s.hp = 10;
    regenTick(s);
    expect(s.hp).toBe(12);
    s.hp = playerDerived(s).maxHp;
    regenTick(s);
    expect(s.hp).toBe(playerDerived(s).maxHp);
  });
});

describe('abates', () => {
  it('dá EXP, fragmentos e sobe de nível com cura', () => {
    const s = createInitialPlayerState();
    const pomi = getMonster('pomi');
    s.hp = 5;
    const rng = createSeededRng(1);
    let reward = grantKill(s, pomi, 0, rng);
    expect(reward.exp).toBe(6);
    expect(s.sealFragments.seal_pomi).toBe(2);
    for (let i = 0; i < 3; i++) reward = grantKill(s, pomi, 0, rng);
    expect(reward.levelsGained).toBe(1);
    expect(reward.statPointsGained).toBe(statPointsForLevel(2));
    expect(s.level).toBe(2);
    expect(s.exp).toBe(4);
    expect(s.hp).toBe(playerDerived(s).maxHp);
  });

  it('Fadiga reduz a EXP do abate', () => {
    const s = createInitialPlayerState();
    knockOutPlayer(s, 0);
    expect(grantKill(s, getMonster('cascudo'), 1000, createSeededRng(2)).exp).toBe(21);
  });
});

describe('inventário e equipamento', () => {
  it('usar maçã cura e consome; com vida cheia recusa', () => {
    const s = createInitialPlayerState();
    expect(useSlot(s, 0).ok).toBe(false);
    s.hp = 10;
    expect(useSlot(s, 0).ok).toBe(true);
    expect(s.hp).toBe(25);
    expect(countItem(s.inventory, 'maca_do_ceu')).toBe(4);
  });

  it('equipar exige nível e troca com o equipado', () => {
    const s = createInitialPlayerState();
    pickUp(s, 'colete_lona', 1);
    const slot = s.inventory.slots.findIndex((x) => x?.itemId === 'colete_lona');
    expect(equipFromSlot(s, slot).ok).toBe(false); // requer nível 3
    s.level = 3;
    const defBefore = playerDerived(s).def;
    expect(equipFromSlot(s, slot).ok).toBe(true);
    expect(s.equipment.armor).toBe('colete_lona');
    expect(playerDerived(s).def).toBe(defBefore + 7); // DEF 6 + VIT 1 → floor(2/2)
    expect(countItem(s.inventory, 'colete_lona')).toBe(0);
    expect(unequip(s, 'armor').ok).toBe(true);
    expect(countItem(s.inventory, 'colete_lona')).toBe(1);
  });
});

describe('stats', () => {
  it('distribuir aumenta o HP máximo já preenchido e redistribuir devolve', () => {
    const s = createInitialPlayerState();
    const hpBefore = s.hp;
    expect(applyAllocation(s, { vit: 10 })).toBe(true);
    expect(s.stats.vit).toBe(11);
    expect(s.hp).toBeGreaterThan(hpBefore);
    expect(s.hp).toBe(playerDerived(s).maxHp);
    expect(applyAllocation(s, { str: 50 })).toBe(false);
    expect(respecPlayer(s)).toBe(true);
    expect(s.stats.vit).toBe(1);
    expect(s.hp).toBe(playerDerived(s).maxHp);
    s.level = 21;
    expect(respecPlayer(s)).toBe(false);
  });
});

describe('moeda', () => {
  it('soma com limite e gasta só com saldo', () => {
    const s = createInitialPlayerState();
    expect(addCurrency(s, 50)).toBe(50);
    expect(spendCurrency(s, 60)).toBe(false);
    expect(spendCurrency(s, 20)).toBe(true);
    expect(s.currency).toBe(30);
    s.currency = CURRENCY.max - 5;
    expect(addCurrency(s, 100)).toBe(5);
    expect(s.currency).toBe(CURRENCY.max);
  });

  it('abate de Cascudo rende moeda na faixa dos dados', () => {
    const s = createInitialPlayerState();
    const cascudo = getMonster('cascudo');
    const reward = grantKill(s, cascudo, 0, () => 0);
    expect(reward.currency).toBe(cascudo.currency!.min);
    expect(s.currency).toBe(reward.currency);
  });
});

describe('barra de atalhos', () => {
  it('consumíveis do kit já vêm na barra', () => {
    const s = createInitialPlayerState();
    expect(s.hotbar[0]).toEqual({ kind: 'item', itemId: 'maca_do_ceu' });
  });

  it('atribui consumível do inventário e recusa equipamento', () => {
    const s = createInitialPlayerState();
    pickUp(s, 'tonico_frutas', 2);
    const idx = s.inventory.slots.findIndex((x) => x?.itemId === 'tonico_frutas');
    expect(assignSlotToHotbar(s, idx).ok).toBe(true);
    expect(s.hotbar[1]).toEqual({ kind: 'item', itemId: 'tonico_frutas' });
    pickUp(s, 'colete_lona', 1);
    const vest = s.inventory.slots.findIndex((x) => x?.itemId === 'colete_lona');
    expect(assignSlotToHotbar(s, vest).ok).toBe(false);
  });

  it('usar atalho consome a primeira pilha; sem item avisa', () => {
    const s = createInitialPlayerState();
    s.hp = 1;
    const before = countItem(s.inventory, 'maca_do_ceu');
    expect(useHotbarSlot(s, 0).ok).toBe(true);
    expect(countItem(s.inventory, 'maca_do_ceu')).toBe(before - 1);
    clearHotbarSlot(s, 0);
    expect(useHotbarSlot(s, 0).ok).toBe(false);
    s.hotbar = [{ kind: 'item', itemId: 'tonico_frutas' }, ...s.hotbar.slice(1)];
    expect(useHotbarSlot(s, 0)).toMatchObject({ ok: false });
  });

  it('desmaiado não usa itens', () => {
    const s = createInitialPlayerState();
    knockOutPlayer(s, 0);
    expect(useHotbarSlot(s, 0).ok).toBe(false);
    expect(s.hp).toBe(0);
  });
});

describe('previewEquip', () => {
  it('mostra os atributos com o item no lugar do equipado', () => {
    const s = createInitialPlayerState();
    const vest = getItem('colete_lona');
    const after = previewEquip(s, vest.id);
    expect(after.def - playerDerived(s).def).toBeGreaterThanOrEqual(vest.equip!.def ?? 0);
    // Trocar a arma pela mesma não muda nada.
    expect(previewEquip(s, 'adaga_treino')).toEqual(playerDerived(s));
  });
});

describe('replacePlayerState', () => {
  it('troca o conteúdo mantendo a referência', () => {
    const target = createInitialPlayerState();
    const source = createInitialPlayerState();
    source.level = 7;
    replacePlayerState(target, source);
    expect(target.level).toBe(7);
  });
});

describe('Selos e bestiário no estado do jogador', () => {
  const pomi1 = { sealId: 'seal_pomi', grade: 1 } as const;

  it('50 abates de Pomi completam um Selo I e marcam o bestiário', () => {
    const s = createInitialPlayerState();
    const rng = createSeededRng(3);
    let completed = 0;
    for (let i = 0; i < 50; i++) completed += grantKill(s, getMonster('pomi'), 0, rng).sealsCompleted;
    expect(completed).toBe(1);
    expect(s.seals.seal_pomi).toEqual([1, 0, 0]);
    expect(s.sealFragments.seal_pomi).toBe(0);
    expect(s.bestiary.pomi).toEqual({ kills: 50, sealObtained: true });
  });

  it('encaixar soma nos atributos; remover devolve ao estojo', () => {
    const s = createInitialPlayerState();
    s.seals = { seal_pomi: [1, 0, 0] };
    const before = playerDerived(s).maxHp;
    const preview = previewSocket(s, pomi1, 'weapon');
    expect(preview?.maxHp).toBe(before + 15);
    expect(socketSealInto(s, pomi1, 'weapon').ok).toBe(true);
    expect(playerDerived(s).maxHp).toBe(before + 15);
    expect(s.seals.seal_pomi).toEqual([0, 0, 0]);
    expect(removeSealFrom(s, 'weapon', 0).ok).toBe(true);
    expect(playerDerived(s).maxHp).toBe(before);
    expect(s.seals.seal_pomi).toEqual([1, 0, 0]);
  });

  it('recusa slot sem equipamento', () => {
    const s = createInitialPlayerState();
    s.seals = { seal_pomi: [1, 0, 0] };
    expect(socketSealInto(s, pomi1, 'armor').ok).toBe(false);
  });

  it('tirar ou trocar o equipamento devolve os Selos ao estojo', () => {
    const s = createInitialPlayerState();
    s.seals = { seal_pomi: [1, 0, 0] };
    socketSealInto(s, pomi1, 'weapon');
    const r = unequip(s, 'weapon');
    expect(r.ok).toBe(true);
    expect(r.message).toContain('Selo');
    expect(s.equipmentSeals.weapon).toBeUndefined();
    expect(s.seals.seal_pomi).toEqual([1, 0, 0]);
  });

  it('comparação de equipamento considera os Selos que saem com o item', () => {
    const s = createInitialPlayerState();
    s.seals = { seal_pomi: [1, 0, 0] };
    socketSealInto(s, pomi1, 'weapon');
    pickUp(s, 'adaga_treino', 1);
    // Outra Adaga igual: perde o HP do Selo.
    expect(previewEquip(s, 'adaga_treino').maxHp).toBe(playerDerived(s).maxHp - 15);
  });

  it('fundir 3 Selos I dá 1 Selo II', () => {
    const s = createInitialPlayerState();
    s.seals = { seal_pomi: [3, 0, 0] };
    expect(fuseSealStock(s, 'seal_pomi', 1).ok).toBe(true);
    expect(s.seals.seal_pomi).toEqual([0, 1, 0]);
  });

  it('ver um monstro registra no bestiário uma vez', () => {
    const s = createInitialPlayerState();
    expect(seeMonster(s, 'plumito')).toBe(true);
    expect(seeMonster(s, 'plumito')).toBe(false);
    expect(s.bestiary.plumito.kills).toBe(0);
  });
});
