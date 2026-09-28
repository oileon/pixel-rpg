// Carrega os assets do manifesto, gera texturas provisórias, cria animações e abre a cidade.

import Phaser from 'phaser';
import { allVisuals, animKey, textureKey, type AnimState, type VisualDef } from '../assets/manifest';
import { allNpcVisuals } from '../assets/npcs';
import { DIRECTIONS_8 } from '../systems/directions';
import { preloadScenery } from '../systems/scenery';
import { generateSkyTextures, preloadSky } from '../systems/sky';
import { session } from '../systems/session';
import { generatePlaceholders, generateTileset } from '../systems/textures';
import type { TravelData } from './WorldScene';

/** Personagens/monstros do manifesto + NPCs. */
function bootVisuals(): VisualDef[] {
  return [...allVisuals(), ...allNpcVisuals()];
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'boot' });
  }

  preload(): void {
    const { width, height } = this.scale;
    const label = this.add.text(width / 2, height / 2, 'Carregando...', { fontFamily: 'monospace', fontSize: '16px' });
    label.setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => label.setText(`Carregando... ${Math.round(p * 100)}%`));
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[boot] falha ao carregar ${file.key} (${String(file.url)}) — usando placeholder`);
    });

    for (const visual of bootVisuals()) {
      const src = visual.source;
      if (src.kind === 'sheet') {
        this.load.spritesheet(textureKey.sheet(visual.key), src.url, {
          frameWidth: src.frameWidth,
          frameHeight: src.frameHeight,
        });
      } else if (src.kind === 'rotations') {
        for (const dir of DIRECTIONS_8) this.load.image(textureKey.rotation(visual.key, dir), src.urls[dir]);
      }
    }
    preloadScenery(this.load);
    preloadSky(this.load);
  }

  create(): void {
    generateTileset(this);
    generateSkyTextures(this);
    generatePlaceholders(this, bootVisuals());
    this.createAnimations();
    // Depuração: ?map=field&spawn=fromTown abre direto num mapa.
    const params = new URLSearchParams(window.location.search);
    const start = session.resumePoint ?? session.lastSafePoint;
    session.resumePoint = null;
    const mapId = params.get('map') ?? start.mapId;
    const data: TravelData = { spawnId: params.get('spawn') ?? start.spawnId };
    this.scene.start(this.scene.get(mapId) ? mapId : session.lastSafePoint.mapId, data);
  }

  private createAnimations(): void {
    for (const visual of bootVisuals()) {
      const src = visual.source;
      if (src.kind !== 'sheet') continue;
      const sheet = textureKey.sheet(visual.key);
      if (!this.textures.exists(sheet)) continue;
      for (const [state, anim] of Object.entries(src.animations) as [AnimState, (typeof src.animations)[AnimState]][]) {
        if (!anim) continue;
        src.directionOrder.forEach((dir, i) => {
          const start = (anim.firstRow + i) * src.columns;
          const frames = this.anims.generateFrameNumbers(sheet, { start, end: start + anim.frames - 1 });
          // Manifesto à frente do PNG (linhas ainda não coladas no sheet): sem animação, cai no fallback.
          if (frames.length < anim.frames) {
            console.warn(`[boot] ${visual.key}:${state}:${dir} sem frames no sheet (linha ${anim.firstRow + i}); ignorada.`);
            return;
          }
          this.anims.create({
            key: animKey(visual.key, state, dir),
            frames,
            frameRate: anim.frameRate,
            repeat: -1,
          });
        });
      }
    }
  }
}
