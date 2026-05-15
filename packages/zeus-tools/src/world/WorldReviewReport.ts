import { zeusPointInRect, zeusRectIntersectsRect } from "@zeus/core";
import type {
  ZeusWorldChunkManifestEntry,
  ZeusWorldFoliageInstance,
  ZeusWorldFoliageSpecies,
  ZeusWorldFoliageZone,
  ZeusWorldRegion,
} from "@zeus/core";

export type ZeusWorldReviewReportOptions = {
  mapId: string;
  chunks: readonly ZeusWorldChunkManifestEntry[];
  regions: readonly ZeusWorldRegion[];
  foliageZones: readonly ZeusWorldFoliageZone[];
  foliageSpecies: readonly ZeusWorldFoliageSpecies[];
  foliageInstances: readonly ZeusWorldFoliageInstance[];
};

export type ZeusWorldReviewReport = {
  mapId: string;
  totals: {
    chunks: number;
    regions: number;
    foliageZones: number;
    foliageInstances: number;
    solidFoliageInstances: number;
  };
  chunks: {
    key: string;
    biome?: string;
    regions: number;
    foliageZones: number;
    foliageInstances: number;
    solidFoliageInstances: number;
  }[];
  regions: {
    id: string;
    role: string;
    foliageZones: number;
    foliageInstances: number;
    solidFoliageInstances: number;
  }[];
  foliageZones: {
    id: string;
    requested: number;
    placed: number;
    solidPlaced: number;
  }[];
};

export function createWorldReviewReport(options: ZeusWorldReviewReportOptions): ZeusWorldReviewReport {
  const speciesById = new Map(options.foliageSpecies.map((species) => [species.id, species]));
  const solidSpecies = new Set(options.foliageSpecies.filter((species) => species.kind === "tree" || (species.collisionRadius ?? 0) > 0).map((species) => species.id));
  const solidCount = (instances: readonly ZeusWorldFoliageInstance[]) => instances.filter((instance) => solidSpecies.has(instance.speciesId)).length;

  return {
    mapId: options.mapId,
    totals: {
      chunks: options.chunks.length,
      regions: options.regions.length,
      foliageZones: options.foliageZones.length,
      foliageInstances: options.foliageInstances.length,
      solidFoliageInstances: solidCount(options.foliageInstances),
    },
    chunks: options.chunks.map((chunk) => {
      const instances = options.foliageInstances.filter((instance) => zeusPointInRect(instance, chunk.bounds));
      return {
        key: chunk.key,
        biome: chunk.biome,
        regions: chunk.regions?.length ?? 0,
        foliageZones: chunk.foliageZones?.length ?? 0,
        foliageInstances: instances.length,
        solidFoliageInstances: solidCount(instances),
      };
    }),
    regions: options.regions.map((region) => {
      const zones = options.foliageZones.filter(
        (zone) => zone.regionId === region.id || zone.id.includes(region.id) || zeusRectIntersectsRect(zone.bounds, region.bounds),
      );
      const instances = options.foliageInstances.filter((instance) => zeusPointInRect(instance, region.bounds));
      return {
        id: region.id,
        role: region.role,
        foliageZones: zones.length,
        foliageInstances: instances.length,
        solidFoliageInstances: solidCount(instances),
      };
    }),
    foliageZones: options.foliageZones.map((zone) => {
      const instances = options.foliageInstances.filter((instance) => instance.zoneId === zone.id);
      return {
        id: zone.id,
        requested: zone.count,
        placed: instances.length,
        solidPlaced: instances.filter((instance) => speciesById.get(instance.speciesId)?.kind === "tree").length,
      };
    }),
  };
}
