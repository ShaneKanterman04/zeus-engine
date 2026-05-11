import type { Entity, EntityId, Vec2, ZeusSystem } from "./types";
import { SystemRunner } from "./simulation/SystemRunner";

export class ZeusWorld<TState extends { entities: Entity[] }> {
  private readonly runner = new SystemRunner<TState>();

  constructor(public state: TState) {}

  addSystem(system: ZeusSystem<TState>) {
    this.runner.add(system);
  }

  update(dt: number) {
    this.runner.update(this.state, dt);
  }

  entity(id: EntityId) {
    return this.state.entities.find((entity) => entity.id === id);
  }
}

export function distance(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function moveToward(current: Vec2, target: Vec2, maxDelta: number): Vec2 {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const length = Math.hypot(dx, dy);
  if (length <= maxDelta || length === 0) return { ...target };
  return {
    x: current.x + (dx / length) * maxDelta,
    y: current.y + (dy / length) * maxDelta,
  };
}
