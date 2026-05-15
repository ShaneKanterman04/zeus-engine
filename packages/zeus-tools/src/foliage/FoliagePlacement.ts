import type { Vec2 } from "@zeus/core";
import { distanceToPolyline } from "@zeus/core";
import { createSeededRng, randomPointInRect } from "@zeus/ai";
import type { ZeusWorldExclusion } from "@zeus/core";

export type ZeusFoliagePlacementZone = {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  count: number;
  species: { id: string; weight: number }[];
  minSpacing?: number;
  excludeRadiusFromRoutes?: number;
  exclusions?: readonly ZeusWorldExclusion[];
};

export type ZeusFoliagePlacementRoute = {
  id: string;
  points: Vec2[];
  clearanceRadius?: number;
};

export type ZeusFoliagePlacementInstance = {
  id: string;
  speciesId: string;
  x: number;
  y: number;
  variantSeed: number;
  rotation: number;
  scale: number;
  zoneId: string;
};

export type ZeusFoliagePlacementOptions = {
  seed: number;
  zones: ZeusFoliagePlacementZone[];
  routes?: ZeusFoliagePlacementRoute[];
  maxAttemptsPerInstance?: number;
};

export type ZeusFoliagePlacementZoneReport = {
  zoneId: string;
  requested: number;
  placed: number;
  attempts: number;
  rejectedByRoutes: number;
  rejectedByExclusions: number;
  rejectedBySpacing: number;
};

export type ZeusFoliagePlacementReport = {
  requested: number;
  placed: number;
  zones: ZeusFoliagePlacementZoneReport[];
};

export type ZeusFoliagePlacementResult = {
  instances: ZeusFoliagePlacementInstance[];
  report: ZeusFoliagePlacementReport;
};

export function generateFoliagePlacementResult(options: ZeusFoliagePlacementOptions): ZeusFoliagePlacementResult {
  const instances: ZeusFoliagePlacementInstance[] = [];
  const zoneReports: ZeusFoliagePlacementZoneReport[] = [];
  const attemptsPerInstance = options.maxAttemptsPerInstance ?? 80;
  for (const zone of options.zones) {
    const random = createSeededRng(hashNumber(options.seed, zone.id));
    const accepted: Vec2[] = [];
    let attempts = 0;
    let rejectedByRoutes = 0;
    let rejectedByExclusions = 0;
    let rejectedBySpacing = 0;
    while (accepted.length < zone.count && attempts < zone.count * attemptsPerInstance) {
      attempts += 1;
      const point = randomPointInRect(zone.bounds, random);
      if (violatesRoutes(point, zone, options.routes ?? [])) {
        rejectedByRoutes += 1;
        continue;
      }
      if (violatesExclusions(point, zone.exclusions ?? [])) {
        rejectedByExclusions += 1;
        continue;
      }
      if (zone.minSpacing && accepted.some((item) => Math.hypot(item.x - point.x, item.y - point.y) < zone.minSpacing!)) {
        rejectedBySpacing += 1;
        continue;
      }
      accepted.push(point);
      const speciesId = pickWeighted(zone.species, random);
      instances.push({
        id: `${zone.id}.${accepted.length}`,
        speciesId,
        x: Math.round(point.x),
        y: Math.round(point.y),
        variantSeed: Math.floor(random() * 0xffffffff),
        rotation: Math.round((random() * 0.18 - 0.09) * 1000) / 1000,
        scale: Math.round((0.88 + random() * 0.24) * 1000) / 1000,
        zoneId: zone.id,
      });
    }
    zoneReports.push({
      zoneId: zone.id,
      requested: zone.count,
      placed: accepted.length,
      attempts,
      rejectedByRoutes,
      rejectedByExclusions,
      rejectedBySpacing,
    });
  }
  return {
    instances,
    report: {
      requested: options.zones.reduce((sum, zone) => sum + zone.count, 0),
      placed: instances.length,
      zones: zoneReports,
    },
  };
}

export function generateFoliagePlacements(options: ZeusFoliagePlacementOptions) {
  return generateFoliagePlacementResult(options).instances;
}

function violatesRoutes(point: Vec2, zone: ZeusFoliagePlacementZone, routes: ZeusFoliagePlacementRoute[]) {
  const extra = zone.excludeRadiusFromRoutes ?? 0;
  return routes.some((route) => distanceToPolyline(point, route.points) < (route.clearanceRadius ?? 0) + extra);
}

function violatesExclusions(point: Vec2, exclusions: readonly ZeusWorldExclusion[]) {
  return exclusions.some((exclusion) => {
    if (exclusion.kind === "circle") return Math.hypot(point.x - exclusion.x, point.y - exclusion.y) < exclusion.radius;
    if (exclusion.kind === "rect") {
      return (
        point.x >= exclusion.bounds.x &&
        point.x <= exclusion.bounds.x + exclusion.bounds.width &&
        point.y >= exclusion.bounds.y &&
        point.y <= exclusion.bounds.y + exclusion.bounds.height
      );
    }
    return distanceToPolyline(point, exclusion.points) < exclusion.radius;
  });
}

function pickWeighted(items: { id: string; weight: number }[], random: () => number) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  let pick = random() * Math.max(1, total);
  for (const item of items) {
    pick -= Math.max(0, item.weight);
    if (pick <= 0) return item.id;
  }
  return items[0]?.id ?? "unknown";
}

function hashNumber(seed: number, value: string) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
