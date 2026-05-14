import type { Vec2 } from "@zeus/core";
import { distanceToPolyline } from "@zeus/core";
import { createSeededRng, randomPointInRect } from "@zeus/ai";

export type ZeusFoliagePlacementZone = {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  count: number;
  species: { id: string; weight: number }[];
  minSpacing?: number;
  excludeRadiusFromRoutes?: number;
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
};

export function generateFoliagePlacements(options: ZeusFoliagePlacementOptions) {
  const instances: ZeusFoliagePlacementInstance[] = [];
  for (const zone of options.zones) {
    const random = createSeededRng(hashNumber(options.seed, zone.id));
    const accepted: Vec2[] = [];
    let attempts = 0;
    while (accepted.length < zone.count && attempts < zone.count * 80) {
      attempts += 1;
      const point = randomPointInRect(zone.bounds, random);
      if (violatesRoutes(point, zone, options.routes ?? [])) continue;
      if (zone.minSpacing && accepted.some((item) => Math.hypot(item.x - point.x, item.y - point.y) < zone.minSpacing!)) continue;
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
  }
  return instances;
}

function violatesRoutes(point: Vec2, zone: ZeusFoliagePlacementZone, routes: ZeusFoliagePlacementRoute[]) {
  const extra = zone.excludeRadiusFromRoutes ?? 0;
  return routes.some((route) => distanceToPolyline(point, route.points) < (route.clearanceRadius ?? 0) + extra);
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
