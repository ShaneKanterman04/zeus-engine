import type { Vec2 } from "./types.js";
import { distance } from "./world.js";

export type ZeusProjectileCircle = {
  id: string;
  position: Vec2;
  radius: number;
  kind?: string;
};

export type ZeusProjectileRayHit<TCircle extends ZeusProjectileCircle = ZeusProjectileCircle> = {
  item: TCircle;
  point: Vec2;
  distance: number;
};

export function zeusRaycastCircle<TCircle extends ZeusProjectileCircle>(
  origin: Vec2,
  direction: Vec2,
  circle: TCircle,
): ZeusProjectileRayHit<TCircle> | undefined {
  const length = Math.hypot(direction.x, direction.y);
  if (length === 0 || circle.radius <= 0) return undefined;
  const dx = direction.x / length;
  const dy = direction.y / length;
  const ox = origin.x - circle.position.x;
  const oy = origin.y - circle.position.y;
  const b = 2 * (ox * dx + oy * dy);
  const c = ox * ox + oy * oy - circle.radius * circle.radius;
  const discriminant = b * b - 4 * c;
  if (discriminant < 0) return undefined;

  const root = Math.sqrt(discriminant);
  const t0 = (-b - root) / 2;
  const t1 = (-b + root) / 2;
  const rayDistance = t0 >= 0 ? t0 : t1 >= 0 ? t1 : undefined;
  if (rayDistance === undefined) return undefined;
  return {
    item: circle,
    point: { x: origin.x + dx * rayDistance, y: origin.y + dy * rayDistance },
    distance: rayDistance,
  };
}

export function zeusRaycastCircles<TCircle extends ZeusProjectileCircle>(
  origin: Vec2,
  target: Vec2,
  circles: readonly TCircle[],
  options: { maxDistance?: number; ignoreContainingOrigin?: boolean } = {},
): ZeusProjectileRayHit<TCircle> | undefined {
  const ray = { x: target.x - origin.x, y: target.y - origin.y };
  const rayLength = Math.hypot(ray.x, ray.y);
  const maxDistance = Math.min(options.maxDistance ?? rayLength, rayLength);
  if (maxDistance <= 0) return undefined;

  let closest: ZeusProjectileRayHit<TCircle> | undefined;
  for (const circle of circles) {
    if (options.ignoreContainingOrigin && distance(origin, circle.position) <= circle.radius) continue;
    const hit = zeusRaycastCircle(origin, ray, circle);
    if (!hit || hit.distance > maxDistance) continue;
    if (!closest || hit.distance < closest.distance) closest = hit;
  }
  return closest;
}
