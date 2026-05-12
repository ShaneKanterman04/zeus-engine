import type { ComponentMap } from "./ecs/index.js";
import type { Entity, EntityId, Vec2 } from "./types.js";

export type ZeusLightSource = {
  radius: number;
  color: string;
  intensity: number;
  enabled?: boolean;
  offset?: Vec2;
};

export type ZeusAmbientLight = {
  color: string;
  alpha: number;
};

export type ZeusResolvedLightSource = ZeusLightSource & {
  entityId: EntityId;
  position: Vec2;
};

export function resolveEntityLightSources(
  entities: readonly Entity[],
  lightSources: ComponentMap<ZeusLightSource>,
): ZeusResolvedLightSource[] {
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const resolved: ZeusResolvedLightSource[] = [];

  for (const [entityId, light] of lightSources) {
    if (light.enabled === false || light.radius <= 0 || light.intensity <= 0) continue;
    const entity = entitiesById.get(entityId);
    if (!entity) continue;
    resolved.push({
      ...light,
      entityId,
      position: {
        x: entity.position.x + (light.offset?.x ?? 0),
        y: entity.position.y + (light.offset?.y ?? 0),
      },
    });
  }

  return resolved;
}
