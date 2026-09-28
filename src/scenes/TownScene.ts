import { TOWN_MAP } from '../maps/town';
import { WorldScene } from './WorldScene';

/** Ilha-cidade (mapa seguro). */
export class TownScene extends WorldScene {
  constructor() {
    super(TOWN_MAP);
  }
}
