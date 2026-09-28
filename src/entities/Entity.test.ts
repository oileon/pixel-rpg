import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phaser não roda em Node: substitui só o que Entity/events usam em runtime.
vi.mock('phaser', () => {
  class EventEmitter {
    private handlers = new Map<string, { fn: (p: unknown) => void; once: boolean }[]>();
    on(ev: string, fn: (p: unknown) => void) {
      this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), { fn, once: false }]);
      return this;
    }
    once(ev: string, fn: (p: unknown) => void) {
      this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), { fn, once: true }]);
      return this;
    }
    off(ev: string, fn?: (p: unknown) => void) {
      this.handlers.set(ev, (this.handlers.get(ev) ?? []).filter((h) => fn && h.fn !== fn));
      return this;
    }
    emit(ev: string, payload: unknown) {
      const list = this.handlers.get(ev) ?? [];
      this.handlers.set(ev, list.filter((h) => !h.once));
      for (const h of list) h.fn(payload);
    }
  }
  const Phaser = {
    Events: { EventEmitter },
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
  };
  return { default: Phaser };
});

const { Entity } = await import('./Entity');
const { gameEvents } = await import('../systems/events');
const { getVisual } = await import('../assets/manifest');

function fakeSprite() {
  const sprite = {
    scene: {} as unknown,
    x: 0,
    y: 0,
    body: { enable: true, setSize() {}, setOffset() {}, setCollideWorldBounds() {} },
    anims: { stop() {}, play() {} },
    setOrigin: () => sprite,
    setTexture: () => sprite,
    setFlipX: () => sprite,
    setDepth: () => sprite,
    setScale: () => sprite,
    setVelocity: () => sprite,
    disableInteractive: () => sprite,
    destroy: vi.fn(() => {
      sprite.scene = undefined;
    }),
  };
  return sprite;
}

function fakeWorld() {
  const registered = new Set<unknown>();
  const tweens: { onComplete?: () => void }[] = [];
  const world = {
    registered,
    tweens: { add: (cfg: { onComplete?: () => void }) => tweens.push(cfg) },
    runTweens: () => tweens.splice(0).forEach((t) => t.onComplete?.()),
    physics: { add: { sprite: (x: number, y: number) => Object.assign(fakeSprite(), { x, y }) } },
    textures: { exists: () => false },
    anims: { exists: () => false },
    registerEntity: (e: unknown) => registered.add(e),
    unregisterEntity: (e: unknown) => registered.delete(e),
  };
  return world;
}

type AnyWorld = ConstructorParameters<typeof Entity>[0];

describe('Entity.destroy', () => {
  let removed: unknown[];
  let died: unknown[];
  const onRemoved = ({ entity }: { entity: unknown }) => removed.push(entity);
  const onDied = ({ entity }: { entity: unknown }) => died.push(entity);

  beforeEach(() => {
    removed = [];
    died = [];
    gameEvents.off('entityRemoved', onRemoved as never);
    gameEvents.off('entityDied', onDied as never);
    gameEvents.on('entityRemoved', onRemoved as never);
    gameEvents.on('entityDied', onDied as never);
  });

  function spawn() {
    const world = fakeWorld();
    const entity = new Entity(world as unknown as AnyWorld, 'monster', getVisual('pomi'), 10, 20);
    return { world, entity };
  }

  it('emite entityRemoved uma vez, marca dead/removed e sai do registro', () => {
    const { world, entity } = spawn();
    expect(world.registered.has(entity)).toBe(true);
    entity.destroy();
    entity.destroy();
    expect(removed).toEqual([entity]);
    expect(entity.dead).toBe(true);
    expect(entity.removed).toBe(true);
    expect(world.registered.has(entity)).toBe(false);
  });

  it('funciona mesmo se o Phaser já destruiu o sprite (shutdown da cena)', () => {
    const { world, entity } = spawn();
    entity.sprite.destroy(); // simula o DisplayList no SHUTDOWN
    entity.destroy();
    expect(removed).toEqual([entity]);
    expect(entity.dead).toBe(true);
    expect(world.registered.has(entity)).toBe(false);
  });

  it('die() emite entityDied e depois entityRemoved, cada um uma vez', () => {
    const { world, entity } = spawn();
    entity.die();
    entity.die();
    expect(died).toEqual([entity]);
    expect(removed).toEqual([]);
    world.runTweens();
    entity.destroy();
    expect(removed).toEqual([entity]);
  });
});
