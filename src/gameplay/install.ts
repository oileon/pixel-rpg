// Ponto de entrada do gameplay: liga cada cena de mapa ao SceneGameplay e mantém a UIScene ativa.

import Phaser from 'phaser';
import { installSfx } from '../audio/sfx';
import { gameEvents } from '../systems/events';
import { FeedbackLayer } from '../ui/FeedbackLayer';
import { UI_SCENE_KEY } from '../ui/UIScene';
import { SceneGameplay } from './SceneGameplay';

let installed = false;
let feedbackAttached = false;

export function installGameplay(): void {
  if (installed) return;
  installed = true;
  installSfx();
  gameEvents.on('mapEntered', ({ scene }) => {
    new SceneGameplay(scene);
    if (!scene.scene.isActive(UI_SCENE_KEY)) {
      // Loot voando, contador de moeda e teclas de som, por cima do HUD.
      const ui = scene.scene.get(UI_SCENE_KEY);
      if (!feedbackAttached) {
        feedbackAttached = true;
        ui.events.once(Phaser.Scenes.Events.CREATE, () => new FeedbackLayer(ui));
      }
      scene.scene.launch(UI_SCENE_KEY);
    }
    scene.scene.bringToTop(UI_SCENE_KEY);
  });
}
