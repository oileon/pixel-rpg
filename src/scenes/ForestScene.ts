import { FOREST_MAP } from '../maps/forest';
import { FieldScene } from './FieldScene';

/** Bosque Sussurrante (campo nível 6–12, com chefe). */
export class ForestScene extends FieldScene {
  constructor() {
    super(FOREST_MAP);
  }
}
