import type { Vec2 } from "./types.js";

export type ZeusRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ZeusWorldLayerRef = {
  id: string;
};

export type ZeusWorldRegion = {
  id: string;
  role: string;
  bounds: ZeusRect;
  biome?: string;
  danger?: number;
  tags?: readonly string[];
};

export type ZeusWorldRoute = {
  id: string;
  kind: string;
  points: readonly Vec2[];
  clearanceRadius?: number;
  tags?: readonly string[];
};

export type ZeusWorldExclusion =
  | {
      id?: string;
      kind: "circle";
      x: number;
      y: number;
      radius: number;
    }
  | {
      id?: string;
      kind: "rect";
      bounds: ZeusRect;
    }
  | {
      id?: string;
      kind: "polyline";
      points: readonly Vec2[];
      radius: number;
    };

export type ZeusWorldFoliageSpecies = {
  id: string;
  kind: string;
  frameId: string;
  radius: number;
  collisionRadius?: number;
  layer?: string;
  tags?: readonly string[];
};

export type ZeusWorldFoliageZoneSpecies = {
  id: string;
  weight: number;
};

export type ZeusWorldFoliageZone = {
  id: string;
  bounds: ZeusRect;
  count: number;
  species: readonly ZeusWorldFoliageZoneSpecies[];
  minSpacing?: number;
  excludeRadiusFromRoutes?: number;
  exclusions?: readonly ZeusWorldExclusion[];
  biome?: string;
  regionId?: string;
  tags?: readonly string[];
};

export type ZeusWorldFoliageInstance = {
  id: string;
  speciesId: string;
  x: number;
  y: number;
  variantSeed: number;
  rotation: number;
  scale: number;
  zoneId: string;
};

export type ZeusWorldChunkManifestEntry = {
  key: string;
  x: number;
  y: number;
  bounds: ZeusRect;
  biome?: string;
  regions?: readonly string[];
  routes?: readonly string[];
  objects?: readonly string[];
  spawns?: readonly string[];
  foliageZones?: readonly string[];
  resourceNodes?: readonly string[];
  animalSpawns?: readonly string[];
};

export type ZeusWorldChunkManifest = {
  mapId: string;
  chunkSize: number;
  chunks: readonly ZeusWorldChunkManifestEntry[];
};

export type ZeusWorldLayerManifest = {
  mapId: string;
  bounds: { width: number; height: number };
  chunkSize?: number;
  regions?: readonly ZeusWorldRegion[];
  routes?: readonly ZeusWorldRoute[];
  chunks?: readonly ZeusWorldChunkManifestEntry[];
  foliageZones?: readonly ZeusWorldFoliageZone[];
};

export function zeusRectIntersectsRect(a: ZeusRect, b: ZeusRect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function zeusPointInRect(point: Vec2, rect: ZeusRect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function zeusRectContainsRect(outer: ZeusRect, inner: ZeusRect) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}
