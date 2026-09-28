import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SKY_COLOR } from './config';
import { BootScene } from './scenes/BootScene';
import { FieldScene } from './scenes/FieldScene';
import { ForestScene } from './scenes/ForestScene';
import { TownScene } from './scenes/TownScene';
import { installGameplay } from './gameplay/install';
import { playerState } from './gameplay/playerState';
import { installAutosave, loadGameAtBoot, newGame, saveGame } from './gameplay/saveGame';
import { DialogScene } from './ui/DialogScene';
import { UIScene } from './ui/UIScene';

// O save precisa entrar antes das cenas: o boot usa o ponto onde ele parou.
loadGameAtBoot();
installGameplay();
installAutosave();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: SKY_COLOR,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, TownScene, FieldScene, ForestScene, UIScene, DialogScene],
});

// Acesso para depuração no console do navegador (só em desenvolvimento).
if (import.meta.env.DEV) Object.assign(window, { game, playerState, saveGame, newGame });
