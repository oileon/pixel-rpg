// Pedra de Retorno: clicar leva o jogador até ela; ao usar, ela é ativada (runa acesa), vira o ponto seguro
// (`session.lastSafePoint`, destino ao cair) e abre a lista de pedras ativadas para teletransporte.
// PENDENTE: `session.activatedStones` ainda não vai para o save (src/gameplay/save.ts).

import Phaser from 'phaser';
import { RETURN_STONE_ACTIVE, SCENERY_OBJECTS } from '../assets/scenery';
import { INTERACT_RANGE, TILE_SIZE } from '../config';
import type { ReturnStonePlacement } from '../maps/types';
import type { WorldScene } from '../scenes/WorldScene';
import { openDialog, type DialogChoice } from './dialog';
import { gameEvents } from './events';
import type { Interactions } from './interaction';
import { activateStone, isStoneActive, teleportDestinations } from './returnStoneState';
import { objectOrigin } from './scenery';
import { session } from './session';

const STONE_NAME = 'Pedra de Retorno';

function useStone(world: WorldScene, stone: ReturnStonePlacement, image: Phaser.GameObjects.Image | null): void {
  const firstTime = activateStone(stone);
  if (firstTime && image) {
    if (world.textures.exists(RETURN_STONE_ACTIVE.key)) image.setTexture(RETURN_STONE_ACTIVE.key);
    world.tweens.add({ targets: image, scaleX: 1.08, scaleY: 1.08, yoyo: true, duration: 140 });
  }
  session.lastSafePoint = { mapId: world.mapDef.id, spawnId: stone.spawnId };
  gameEvents.emit('returnStoneUsed', { stoneId: stone.id, mapId: world.mapDef.id, firstTime });

  const lines = firstTime
    ? ['A runa da pedra se acende com um brilho azul.', `Ponto de retorno salvo aqui: ${stone.name}.`]
    : [`Ponto de retorno salvo aqui: ${stone.name}.`];
  const destinations = teleportDestinations(stone.id);
  const choices: DialogChoice[] = destinations.map((d) => ({
    label: `Ir para ${d.stone.name}`,
    onSelect: () => world.travel(d.mapId, d.stone.spawnId),
  }));
  lines.push(destinations.length > 0 ? 'Para onde quer viajar?' : 'Ative outras pedras para viajar entre elas.');
  choices.push({ label: 'Ficar aqui' });
  openDialog({ speaker: STONE_NAME, lines, choices });
}

/** Desenha as pedras do mapa (ativa/inativa) e as registra para interação. */
export function spawnReturnStones(world: WorldScene, interactions: Interactions): void {
  for (const stone of world.mapDef.returnStones ?? []) {
    const { x, y, w, h } = stone.rect;
    // Pivô na base centrada do footprint (mesma regra dos objetos de cenário); depth = y do pivô.
    const px = (x + w / 2) * TILE_SIZE;
    const py = (y + h) * TILE_SIZE;
    const inactiveKey = SCENERY_OBJECTS['return-stone'].key;
    let image: Phaser.GameObjects.Image | null = null;
    let clickable: Phaser.GameObjects.GameObject;
    if (world.textures.exists(inactiveKey)) {
      const origin = objectOrigin(world, 'return-stone');
      const key = isStoneActive(stone) && world.textures.exists(RETURN_STONE_ACTIVE.key) ? RETURN_STONE_ACTIVE.key : inactiveKey;
      image = world.add.image(px, py, key).setOrigin(origin.x, origin.y).setDepth(py);
      clickable = image;
    } else {
      // Sem arte: um obelisco provisório.
      clickable = world.add.rectangle(px, py, w * TILE_SIZE - 20, TILE_SIZE * 2, 0x5a6d8c).setOrigin(0.5, 1).setDepth(py);
    }
    interactions.add(
      { x: px, y: py - TILE_SIZE / 2, range: INTERACT_RANGE, interact: () => useStone(world, stone, image) },
      clickable,
    );
  }
}
