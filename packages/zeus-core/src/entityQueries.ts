import type { Entity, Vec2 } from "./types.js";
import { distance } from "./world.js";

export type ZeusEntityPredicate<TEntity extends Entity = Entity> = (entity: TEntity) => boolean;

export type ZeusEntityDistanceResult<TEntity extends Entity = Entity> = {
  entity: TEntity;
  distance: number;
};

export type ZeusEntityRadiusQueryOptions<TEntity extends Entity = Entity> = {
  predicate?: ZeusEntityPredicate<TEntity>;
  includeSolidRadius?: boolean;
  sort?: "nearest" | false;
};

export type ZeusNearestEntityOptions<TEntity extends Entity = Entity> = {
  predicate?: ZeusEntityPredicate<TEntity>;
  maxDistance?: number;
  includeSolidRadius?: boolean;
};

export function zeusEntityDistanceFromPoint(entity: Entity, point: Vec2, includeSolidRadius = false) {
  const centerDistance = distance(entity.position, point);
  return includeSolidRadius ? Math.max(0, centerDistance - entity.radius) : centerDistance;
}

export function zeusEntitiesWithinRadius<TEntity extends Entity>(
  entities: readonly TEntity[],
  point: Vec2,
  radius: number,
  options: ZeusEntityRadiusQueryOptions<TEntity> = {},
): ZeusEntityDistanceResult<TEntity>[] {
  const results: ZeusEntityDistanceResult<TEntity>[] = [];
  const maxDistance = Math.max(0, radius);

  for (const entity of entities) {
    if (options.predicate && !options.predicate(entity)) continue;
    const entityDistance = zeusEntityDistanceFromPoint(entity, point, options.includeSolidRadius);
    if (entityDistance <= maxDistance) {
      results.push({ entity, distance: entityDistance });
    }
  }

  if (options.sort === "nearest") {
    results.sort((a, b) => a.distance - b.distance);
  }
  return results;
}

export function zeusNearestEntity<TEntity extends Entity>(
  entities: readonly TEntity[],
  point: Vec2,
  options: ZeusNearestEntityOptions<TEntity> = {},
): ZeusEntityDistanceResult<TEntity> | undefined {
  let nearest: ZeusEntityDistanceResult<TEntity> | undefined;
  const maxDistance = options.maxDistance ?? Number.POSITIVE_INFINITY;

  for (const entity of entities) {
    if (options.predicate && !options.predicate(entity)) continue;
    const entityDistance = zeusEntityDistanceFromPoint(entity, point, options.includeSolidRadius);
    if (entityDistance > maxDistance) continue;
    if (!nearest || entityDistance < nearest.distance) {
      nearest = { entity, distance: entityDistance };
    }
  }

  return nearest;
}
