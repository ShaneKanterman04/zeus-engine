import type { Entity, EntityId, Vec2, ZeusSystem } from "./types.js";
import { SystemRunner } from "./simulation/SystemRunner.js";

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

export function distanceToSegment(point: Vec2, start: Vec2, end: Vec2) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, start);

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
}

export function distanceToPolyline(point: Vec2, points: readonly Vec2[]) {
  if (points.length === 0) return Number.POSITIVE_INFINITY;
  if (points.length === 1) return distance(point, points[0]);

  let closest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    closest = Math.min(closest, distanceToSegment(point, points[index - 1], points[index]));
  }
  return closest;
}

export function polylineLength(points: readonly Vec2[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}

export function samplePolyline(points: readonly Vec2[], spacing: number) {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];

  const step = Math.max(1, spacing);
  const samples: Vec2[] = [{ ...points[0] }];
  let walked = 0;
  let nextSampleAt = step;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);
    if (segmentLength === 0) continue;

    while (walked + segmentLength >= nextSampleAt) {
      const t = (nextSampleAt - walked) / segmentLength;
      samples.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      });
      nextSampleAt += step;
    }
    walked += segmentLength;
  }

  const last = points[points.length - 1];
  if (distance(samples[samples.length - 1], last) > 0.01) {
    samples.push({ ...last });
  }
  return samples;
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
