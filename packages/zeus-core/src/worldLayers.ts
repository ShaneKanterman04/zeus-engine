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

export type ZeusWorldRegionBlendOptions = {
  blendRadius?: number;
  maxRegions?: number;
};

export type ZeusWorldRegionInfluence = {
  region: ZeusWorldRegion;
  weight: number;
  distance: number;
  contains: boolean;
};

export type ZeusWorldRegionBlendCell = {
  bounds: ZeusRect;
  influences: ZeusWorldRegionInfluence[];
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
      kind: "ellipse";
      x: number;
      y: number;
      radiusX: number;
      radiusY: number;
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

export function zeusRegionInfluencesAtPoint(
  point: Vec2,
  regions: readonly ZeusWorldRegion[],
  options: ZeusWorldRegionBlendOptions = {},
): ZeusWorldRegionInfluence[] {
  const blendRadius = options.blendRadius ?? 640;
  const maxRegions = options.maxRegions ?? 3;
  const candidates = regions
    .map((region) => {
      const distance = zeusDistanceToRect(point, region.bounds);
      const contains = distance === 0 && zeusPointInRect(point, region.bounds);
      return {
        region,
        weight: contains ? 1 : Math.max(0, 1 - distance / blendRadius),
        distance,
        contains,
      };
    })
    .filter((candidate) => candidate.weight > 0)
    .sort(compareRegionInfluences);

  const selected =
    candidates.length > 0
      ? candidates.slice(0, maxRegions)
      : regions
          .map((region) => {
            const distance = zeusDistanceToRect(point, region.bounds);
            return {
              region,
              weight: 1 / Math.max(distance, 1),
              distance,
              contains: false,
            };
          })
          .sort(compareRegionInfluences)
          .slice(0, maxRegions);

  return normalizeRegionInfluences(selected);
}

export function zeusBuildRegionBlendCells(options: {
  bounds: { width: number; height: number };
  regions: readonly ZeusWorldRegion[];
  cellSize: number;
  blendOptions?: ZeusWorldRegionBlendOptions;
}): ZeusWorldRegionBlendCell[] {
  const cells: ZeusWorldRegionBlendCell[] = [];
  for (let y = 0; y < options.bounds.height; y += options.cellSize) {
    for (let x = 0; x < options.bounds.width; x += options.cellSize) {
      const width = Math.min(options.cellSize, options.bounds.width - x);
      const height = Math.min(options.cellSize, options.bounds.height - y);
      const center = { x: x + width / 2, y: y + height / 2 };
      cells.push({
        bounds: { x, y, width, height },
        influences: zeusRegionInfluencesAtPoint(center, options.regions, options.blendOptions),
      });
    }
  }
  return cells;
}

function zeusDistanceToRect(point: Vec2, rect: ZeusRect) {
  const dx = point.x < rect.x ? rect.x - point.x : point.x > rect.x + rect.width ? point.x - (rect.x + rect.width) : 0;
  const dy = point.y < rect.y ? rect.y - point.y : point.y > rect.y + rect.height ? point.y - (rect.y + rect.height) : 0;
  return Math.hypot(dx, dy);
}

function compareRegionInfluences(a: ZeusWorldRegionInfluence, b: ZeusWorldRegionInfluence) {
  return b.weight - a.weight || a.distance - b.distance || a.region.id.localeCompare(b.region.id);
}

function normalizeRegionInfluences(influences: ZeusWorldRegionInfluence[]) {
  const total = influences.reduce((sum, influence) => sum + influence.weight, 0);
  if (total <= 0) return influences;
  return influences.map((influence) => ({ ...influence, weight: influence.weight / total }));
}
