import { distanceToPolyline, zeusPointInRect, zeusRectContainsRect, zeusRectIntersectsRect, zeusRegionInfluencesAtPoint } from "@zeus/core";
import type {
  ZeusWorldChunkManifestEntry,
  ZeusWorldFoliageInstance,
  ZeusWorldFoliageSpecies,
  ZeusWorldFoliageZone,
  ZeusWorldLayerManifest,
  ZeusWorldRegionBlendOptions,
} from "@zeus/core";

export type ZeusWorldLayerValidationOptions = ZeusWorldLayerManifest & {
  foliageSpecies?: readonly ZeusWorldFoliageSpecies[];
  foliageInstances?: readonly ZeusWorldFoliageInstance[];
  minFoliageInstancesPerChunk?: number;
  maxSolidFoliagePerChunk?: number;
  requireBlendedRegionCoverage?: boolean;
  requireDirectRegionCoverage?: boolean;
  regionCoverageSampleSize?: number;
  regionBlendOptions?: ZeusWorldRegionBlendOptions;
};

export type ZeusWorldLayerValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export function validateWorldLayers(options: ZeusWorldLayerValidationOptions): ZeusWorldLayerValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const worldBounds = { x: 0, y: 0, width: options.bounds.width, height: options.bounds.height };
  const regions = options.regions ?? [];
  const routes = options.routes ?? [];
  const chunks = options.chunks ?? [];
  const zones = options.foliageZones ?? [];
  const speciesById = new Map((options.foliageSpecies ?? []).map((species) => [species.id, species]));
  const zoneIds = new Set(zones.map((zone) => zone.id));

  collectDuplicateIds("region", regions, errors);
  collectDuplicateIds("route", routes, errors);
  collectDuplicateKeys("chunk", chunks, errors);
  collectDuplicateIds("foliage zone", zones, errors);
  collectDuplicateIds("foliage species", options.foliageSpecies ?? [], errors);
  collectDuplicateIds("foliage instance", options.foliageInstances ?? [], errors);

  for (const region of regions) {
    if (!region.role) errors.push(`Region '${region.id}' missing role`);
    if (!zeusRectContainsRect(worldBounds, region.bounds)) warnings.push(`Region '${region.id}' extends outside world bounds`);
  }
  for (const route of routes) {
    if (!route.kind) errors.push(`Route '${route.id}' missing kind`);
    if (route.points.length < 2) errors.push(`Route '${route.id}' needs at least two points`);
    for (const [index, point] of route.points.entries()) {
      if (!zeusPointInRect(point, worldBounds)) errors.push(`Route '${route.id}' point ${index} is outside world bounds`);
    }
  }
  for (const zone of zones) validateZone(zone, worldBounds, speciesById, errors, warnings);
  for (const chunk of chunks) validateChunk(chunk, regions, zones, errors, warnings);
  validateDirectRegionCoverage(options, errors);
  validateBlendedRegionCoverage(options, errors);
  validateFoliageInstances(options, speciesById, zoneIds, errors);
  validateChunkDensities(options, speciesById, errors);

  return { ok: errors.length === 0, errors, warnings };
}

function validateDirectRegionCoverage(options: ZeusWorldLayerValidationOptions, errors: string[]) {
  if (!options.requireDirectRegionCoverage) return;
  const regions = options.regions ?? [];
  if (regions.length === 0) {
    errors.push("World has no regions for direct coverage");
    return;
  }
  const sampleSize = options.regionCoverageSampleSize ?? 128;
  for (let y = sampleSize / 2; y < options.bounds.height; y += sampleSize) {
    for (let x = sampleSize / 2; x < options.bounds.width; x += sampleSize) {
      if (!regions.some((region) => zeusPointInRect({ x, y }, region.bounds))) {
        errors.push(`World has no direct region coverage near ${Math.round(x)},${Math.round(y)}`);
        return;
      }
    }
  }
}

function validateBlendedRegionCoverage(options: ZeusWorldLayerValidationOptions, errors: string[]) {
  if (!options.requireBlendedRegionCoverage) return;
  const regions = options.regions ?? [];
  if (regions.length === 0) {
    errors.push("World has no regions for blended coverage");
    return;
  }
  const sampleSize = options.regionCoverageSampleSize ?? 128;
  for (let y = sampleSize / 2; y < options.bounds.height; y += sampleSize) {
    for (let x = sampleSize / 2; x < options.bounds.width; x += sampleSize) {
      if (zeusRegionInfluencesAtPoint({ x, y }, regions, options.regionBlendOptions).length === 0) {
        errors.push(`World has no blended region coverage near ${Math.round(x)},${Math.round(y)}`);
        return;
      }
    }
  }
}

function validateZone(
  zone: ZeusWorldFoliageZone,
  worldBounds: { x: number; y: number; width: number; height: number },
  speciesById: ReadonlyMap<string, ZeusWorldFoliageSpecies>,
  errors: string[],
  warnings: string[],
) {
  if (zone.count < 0 || !Number.isFinite(zone.count)) errors.push(`Foliage zone '${zone.id}' has invalid count`);
  if (!zeusRectContainsRect(worldBounds, zone.bounds)) warnings.push(`Foliage zone '${zone.id}' extends outside world bounds`);
  if (zone.species.length === 0) errors.push(`Foliage zone '${zone.id}' has no species weights`);
  for (const species of zone.species) {
    if (!speciesById.has(species.id)) errors.push(`Foliage zone '${zone.id}' references unknown species '${species.id}'`);
    if (!Number.isFinite(species.weight) || species.weight < 0) errors.push(`Foliage zone '${zone.id}' has invalid weight for '${species.id}'`);
  }
}

function validateChunk(
  chunk: ZeusWorldChunkManifestEntry,
  regions: readonly { id: string; bounds: { x: number; y: number; width: number; height: number } }[],
  zones: readonly ZeusWorldFoliageZone[],
  errors: string[],
  warnings: string[],
) {
  const intersectingRegions = regions.filter((region) => zeusRectIntersectsRect(chunk.bounds, region.bounds)).map((region) => region.id);
  const intersectingZones = zones.filter((zone) => zeusRectIntersectsRect(chunk.bounds, zone.bounds)).map((zone) => zone.id);
  if (chunk.regions && missingRefs(chunk.regions, intersectingRegions).length > 0) {
    warnings.push(`Chunk '${chunk.key}' region refs do not match geometry`);
  }
  if (chunk.foliageZones && missingRefs(chunk.foliageZones, intersectingZones).length > 0) {
    warnings.push(`Chunk '${chunk.key}' foliage zone refs do not match geometry`);
  }
  if ((chunk.regions ?? intersectingRegions).length === 0) errors.push(`Chunk '${chunk.key}' has no region coverage`);
  if ((chunk.foliageZones ?? intersectingZones).length === 0) errors.push(`Chunk '${chunk.key}' has no foliage zone coverage`);
}

function validateFoliageInstances(
  options: ZeusWorldLayerValidationOptions,
  speciesById: ReadonlyMap<string, ZeusWorldFoliageSpecies>,
  zoneIds: ReadonlySet<string>,
  errors: string[],
) {
  const worldBounds = { x: 0, y: 0, width: options.bounds.width, height: options.bounds.height };
  for (const instance of options.foliageInstances ?? []) {
    if (!speciesById.has(instance.speciesId)) errors.push(`Foliage instance '${instance.id}' references unknown species '${instance.speciesId}'`);
    if (!zoneIds.has(instance.zoneId)) errors.push(`Foliage instance '${instance.id}' references unknown zone '${instance.zoneId}'`);
    if (!zeusPointInRect(instance, worldBounds)) errors.push(`Foliage instance '${instance.id}' is outside world bounds`);
    if (!Number.isFinite(instance.scale) || instance.scale <= 0) errors.push(`Foliage instance '${instance.id}' has invalid scale`);
  }
}

function validateChunkDensities(
  options: ZeusWorldLayerValidationOptions,
  speciesById: ReadonlyMap<string, ZeusWorldFoliageSpecies>,
  errors: string[],
) {
  if (!options.chunks || !options.foliageInstances) return;
  const minInstances = options.minFoliageInstancesPerChunk ?? 0;
  const maxSolid = options.maxSolidFoliagePerChunk ?? Number.POSITIVE_INFINITY;
  for (const chunk of options.chunks) {
    const instances = options.foliageInstances.filter((instance) => zeusPointInRect(instance, chunk.bounds));
    const solid = instances.filter((instance) => speciesById.get(instance.speciesId)?.collisionRadius !== 0 && speciesById.get(instance.speciesId)?.kind === "tree");
    if (instances.length < minInstances) errors.push(`Chunk '${chunk.key}' has ${instances.length} foliage instances, below ${minInstances}`);
    if (solid.length > maxSolid) errors.push(`Chunk '${chunk.key}' has ${solid.length} solid foliage instances, above ${maxSolid}`);
  }
}

export function countRouteClearanceViolations(options: {
  routes: readonly { points: readonly { x: number; y: number }[]; clearanceRadius?: number }[];
  foliageInstances: readonly ZeusWorldFoliageInstance[];
  foliageSpecies: readonly ZeusWorldFoliageSpecies[];
}) {
  const speciesById = new Map(options.foliageSpecies.map((species) => [species.id, species]));
  let violations = 0;
  for (const instance of options.foliageInstances) {
    const species = speciesById.get(instance.speciesId);
    if (!species || species.collisionRadius === 0) continue;
    const radius = (species.collisionRadius ?? species.radius) * instance.scale;
    if (options.routes.some((route) => distanceToPolyline(instance, route.points) <= radius + (route.clearanceRadius ?? 0))) violations += 1;
  }
  return violations;
}

function collectDuplicateIds(label: string, items: readonly { id: string }[], errors: string[]) {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id) errors.push(`${label} missing id`);
    if (ids.has(item.id)) errors.push(`Duplicate ${label} '${item.id}'`);
    ids.add(item.id);
  }
}

function collectDuplicateKeys(label: string, items: readonly { key: string }[], errors: string[]) {
  const keys = new Set<string>();
  for (const item of items) {
    if (!item.key) errors.push(`${label} missing key`);
    if (keys.has(item.key)) errors.push(`Duplicate ${label} '${item.key}'`);
    keys.add(item.key);
  }
}

function missingRefs(actual: readonly string[], expected: readonly string[]) {
  const actualSet = new Set(actual);
  return expected.filter((id) => !actualSet.has(id));
}
