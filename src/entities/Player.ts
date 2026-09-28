import { getVisual } from '../assets/manifest';
import { DEFAULT_PLAYER_SPEED } from '../config';
import type { Direction8 } from '../systems/directions';
import { gameEvents } from '../systems/events';
import type { WorldScene } from '../scenes/WorldScene';
import { Entity } from './Entity';

export class Player extends Entity {
  private lastTileX = -1;
  private lastTileY = -1;

  constructor(world: WorldScene, x: number, y: number, facing: Direction8 = 'south') {
    super(world, 'player', getVisual('aprendiz'), x, y, { facing, speed: DEFAULT_PLAYER_SPEED });
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    if (this.dead) return;
    if (this.tileX !== this.lastTileX || this.tileY !== this.lastTileY) {
      this.lastTileX = this.tileX;
      this.lastTileY = this.tileY;
      gameEvents.emit('playerMoved', {
        x: this.x,
        y: this.y,
        tileX: this.tileX,
        tileY: this.tileY,
        facing: this.facing,
      });
    }
  }

  protected override onMovingChanged(moving: boolean): void {
    if (!moving) gameEvents.emit('playerStopped', { x: this.x, y: this.y });
  }
}
