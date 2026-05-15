import { ZeusSpatialHashGrid } from "./spatial/SpatialHashGrid.js";
import { zeusPointInRect, zeusRectIntersectsRect } from "./worldLayers.js";
import type {
  ZeusRect,
  ZeusWorldChunkManifestEntry,
  ZeusWorldFoliageInstance,
  ZeusWorldFoliageSpecies,
  ZeusWorldFoliageZone,
  ZeusWorldRegion,
} from "./worldLayers.js";

export type ZeusWorldLayerIndexOptions = {
  chunks?: readonly ZeusWorldChunkManifestEntry[];
  regions?: readonly ZeusWorldRegion[];
  foliageZones?: readonly ZeusWorldFoliageZone[];
  foliageSpecies?: readonly ZeusWorldFoliageSpecies[];
  foliageInstances?: readonly ZeusWorldFoliageInstance[];
  foliageCellSize?: number;
};

type IndexedFoliageInstance = ZeusWorldFoliageInstance & {
  position: { x: number; y: number };
  radius: number;
};

export class ZeusWorldLayerIndex {
  private readonly chunksByKey: ReadonlyMap<string, ZeusWorldChunkManifestEntry>;
  private readonly regionsById: ReadonlyMap<string, ZeusWorldRegion>;
  private readonly foliageZonesById: ReadonlyMap<string, ZeusWorldFoliageZone>;
  private readonly foliageSpeciesById: ReadonlyMap<string, ZeusWorldFoliageSpecies>;
  private readonly foliageIndex: ZeusSpatialHashGrid<IndexedFoliageInstance>;

  constructor(options: ZeusWorldLayerIndexOptions) {
    this.chunksByKey = new Map((options.chunks ?? []).map((chunk) => [chunk.key, chunk]));
    this.regionsById = new Map((options.regions ?? []).map((region) => [region.id, region]));
    this.foliageZonesById = new Map((options.foliageZones ?? []).map((zone) => [zone.id, zone]));
    this.foliageSpeciesById = new Map((options.foliageSpecies ?? []).map((species) => [species.id, species]));
    this.foliageIndex = new ZeusSpatialHashGrid<IndexedFoliageInstance>(options.foliageCellSize ?? 192);
    for (const instance of options.foliageInstances ?? []) {
      const species = this.foliageSpeciesById.get(instance.speciesId);
      this.foliageIndex.set({
        ...instance,
        position: { x: instance.x, y: instance.y },
        radius: (species?.radius ?? 16) * instance.scale,
      });
    }
  }

  chunk(key: string) {
    return this.chunksByKey.get(key);
  }

  region(id: string) {
    return this.regionsById.get(id);
  }

  foliageZone(id: string) {
    return this.foliageZonesById.get(id);
  }

  foliageSpecies(id: string) {
    return this.foliageSpeciesById.get(id);
  }

  chunksIntersecting(rect: ZeusRect) {
    return [...this.chunksByKey.values()].filter((chunk) => zeusRectIntersectsRect(chunk.bounds, rect));
  }

  regionsAt(point: { x: number; y: number }) {
    return [...this.regionsById.values()].filter((region) => zeusPointInRect(point, region.bounds));
  }

  regionsIntersecting(rect: ZeusRect) {
    return [...this.regionsById.values()].filter((region) => zeusRectIntersectsRect(region.bounds, rect));
  }

  foliageZonesIntersecting(rect: ZeusRect) {
    return [...this.foliageZonesById.values()].filter((zone) => zeusRectIntersectsRect(zone.bounds, rect));
  }

  foliageInRect(rect: ZeusRect) {
    return this.foliageIndex.queryRect(rect);
  }

  foliageInCircle(position: { x: number; y: number }, radius: number) {
    return this.foliageIndex.queryCircle(position, radius);
  }
}
