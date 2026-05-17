import { describe, expect, it } from "vitest";
import {
  ZeusWorldLayerIndex,
  zeusBuildRegionBlendCells,
  zeusRegionInfluencesAtPoint,
} from "@zeus/core";
import type {
  ZeusWorldChunkManifestEntry,
  ZeusWorldFoliageInstance,
  ZeusWorldFoliageSpecies,
  ZeusWorldFoliageZone,
  ZeusWorldRegion,
  ZeusWorldRoute,
} from "@zeus/core";
import {
  countRouteClearanceViolations,
  generateFoliagePlacements,
  generateFoliagePlacementResult,
  validateWorldLayers,
} from "@zeus/tools";

const regions: ZeusWorldRegion[] = [
  {
    id: "homestead",
    role: "safe",
    bounds: { x: 0, y: 0, width: 100, height: 100 },
  },
  {
    id: "woodlot",
    role: "resource",
    bounds: { x: 120, y: 0, width: 100, height: 100 },
  },
];

const chunks: ZeusWorldChunkManifestEntry[] = [
  {
    key: "0,0",
    x: 0,
    y: 0,
    bounds: { x: 0, y: 0, width: 128, height: 128 },
    regions: ["homestead", "woodlot"],
    foliageZones: ["mixed"],
  },
];

const foliageSpecies: ZeusWorldFoliageSpecies[] = [
  {
    id: "pine",
    kind: "tree",
    frameId: "tree.pine",
    radius: 10,
    collisionRadius: 8,
  },
  {
    id: "grass",
    kind: "grass",
    frameId: "plant.grass",
    radius: 4,
    collisionRadius: 0,
  },
];

const foliageZones: ZeusWorldFoliageZone[] = [
  {
    id: "mixed",
    bounds: { x: 0, y: 0, width: 220, height: 120 },
    count: 12,
    species: [
      { id: "pine", weight: 1 },
      { id: "grass", weight: 1 },
    ],
  },
];

const routes: ZeusWorldRoute[] = [
  {
    id: "return-route",
    kind: "trail",
    points: [
      { x: 0, y: 50 },
      { x: 220, y: 50 },
    ],
    clearanceRadius: 12,
  },
];

describe("world layer regions", () => {
  it("normalizes nearby region influences and prefers containing regions", () => {
    const influences = zeusRegionInfluencesAtPoint({ x: 96, y: 50 }, regions, {
      blendRadius: 80,
      maxRegions: 2,
    });

    expect(influences).toHaveLength(2);
    expect(influences[0]?.region.id).toBe("homestead");
    expect(influences[0]?.contains).toBe(true);
    expect(influences[1]?.region.id).toBe("woodlot");
    expect(influences.reduce((sum, influence) => sum + influence.weight, 0)).toBeCloseTo(1);
  });

  it("builds blend cells that cover partial world edges", () => {
    const cells = zeusBuildRegionBlendCells({
      bounds: { width: 130, height: 70 },
      regions,
      cellSize: 64,
      blendOptions: { blendRadius: 96 },
    });

    expect(cells).toHaveLength(6);
    expect(cells.at(-1)?.bounds).toEqual({ x: 128, y: 64, width: 2, height: 6 });
    expect(cells.every((cell) => cell.influences.length > 0)).toBe(true);
  });
});

describe("ZeusWorldLayerIndex", () => {
  it("indexes chunks, regions, foliage zones, and scaled foliage instances", () => {
    const instances: ZeusWorldFoliageInstance[] = [
      {
        id: "pine.1",
        speciesId: "pine",
        x: 32,
        y: 40,
        variantSeed: 1,
        rotation: 0,
        scale: 2,
        zoneId: "mixed",
      },
    ];
    const index = new ZeusWorldLayerIndex({
      chunks,
      regions,
      foliageZones,
      foliageSpecies,
      foliageInstances: instances,
      foliageCellSize: 32,
    });

    expect(index.chunk("0,0")?.key).toBe("0,0");
    expect(index.regionsAt({ x: 10, y: 10 }).map((region) => region.id)).toEqual(["homestead"]);
    expect(index.primaryRegionAt({ x: 140, y: 10 })?.id).toBe("woodlot");
    expect(index.foliageZonesIntersecting({ x: 200, y: 100, width: 16, height: 16 }).map((zone) => zone.id)).toEqual(["mixed"]);
    expect(index.chunksIntersecting({ x: 120, y: 120, width: 16, height: 16 }).map((chunk) => chunk.key)).toEqual(["0,0"]);
    expect(index.regionsIntersecting({ x: 100, y: 0, width: 24, height: 24 }).map((region) => region.id)).toEqual([
      "woodlot",
    ]);
    expect(index.foliageInRect({ x: 20, y: 30, width: 8, height: 8 }).map((instance) => instance.id)).toEqual(["pine.1"]);
    expect(index.foliageInCircle({ x: 48, y: 40 }, 1).map((instance) => instance.id)).toEqual(["pine.1"]);
    expect(index.regionBlendCells({ bounds: { width: 128, height: 128 }, cellSize: 128 })).toHaveLength(1);
    expect(index.foliageSpecies("missing")).toBeUndefined();
    expect(index.foliageZone("missing")).toBeUndefined();
    expect(index.region("missing")).toBeUndefined();
  });
});

describe("world layer validation", () => {
  it("accepts valid layered maps with blended region coverage", () => {
    const result = validateWorldLayers({
      mapId: "test-map",
      bounds: { width: 220, height: 120 },
      regions,
      routes,
      chunks,
      foliageZones,
      foliageSpecies,
      foliageInstances: [
        {
          id: "pine.1",
          speciesId: "pine",
          x: 32,
          y: 40,
          variantSeed: 1,
          rotation: 0,
          scale: 1,
          zoneId: "mixed",
        },
      ],
      minFoliageInstancesPerChunk: 1,
      maxSolidFoliagePerChunk: 2,
      requireBlendedRegionCoverage: true,
      regionCoverageSampleSize: 64,
      regionBlendOptions: { blendRadius: 128 },
    });

    expect(result).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it("reports actionable errors for broken foliage references and chunk budgets", () => {
    const result = validateWorldLayers({
      mapId: "broken-map",
      bounds: { width: 128, height: 128 },
      regions: [regions[0]!],
      chunks,
      foliageZones: [
        {
          ...foliageZones[0]!,
          species: [{ id: "missing", weight: 1 }],
        },
      ],
      foliageSpecies,
      foliageInstances: [
        {
          id: "bad.1",
          speciesId: "missing",
          x: 32,
          y: 40,
          variantSeed: 1,
          rotation: 0,
          scale: 1,
          zoneId: "unknown-zone",
        },
      ],
      minFoliageInstancesPerChunk: 2,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Foliage zone 'mixed' references unknown species 'missing'",
        "Foliage instance 'bad.1' references unknown species 'missing'",
        "Foliage instance 'bad.1' references unknown zone 'unknown-zone'",
        "Chunk '0,0' has 1 foliage instances, below 2",
      ]),
    );
  });

  it("reports duplicate IDs, invalid routes, invalid zones, and geometry warnings", () => {
    const result = validateWorldLayers({
      mapId: "broken-geometry",
      bounds: { width: 128, height: 128 },
      regions: [
        {
          id: "duplicate",
          role: "",
          bounds: { x: -8, y: 0, width: 32, height: 32 },
        },
        {
          id: "duplicate",
          role: "resource",
          bounds: { x: 96, y: 96, width: 32, height: 32 },
        },
      ],
      routes: [
        {
          id: "bad-route",
          kind: "",
          points: [{ x: 999, y: 999 }],
        },
      ],
      chunks: [
        {
          key: "0,0",
          x: 0,
          y: 0,
          bounds: { x: 0, y: 0, width: 64, height: 64 },
          regions: ["not-geometry"],
          foliageZones: ["not-geometry"],
        },
      ],
      foliageZones: [
        {
          id: "outside",
          bounds: { x: 120, y: 120, width: 32, height: 32 },
          count: Number.NaN,
          species: [],
        },
      ],
      foliageSpecies,
      requireBlendedRegionCoverage: true,
      regionCoverageSampleSize: 256,
      regionBlendOptions: { blendRadius: 0 },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Duplicate region 'duplicate'",
        "Region 'duplicate' missing role",
        "Route 'bad-route' missing kind",
        "Route 'bad-route' needs at least two points",
        "Route 'bad-route' point 0 is outside world bounds",
        "Foliage zone 'outside' has invalid count",
        "Foliage zone 'outside' has no species weights",
      ]),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Region 'duplicate' extends outside world bounds",
        "Foliage zone 'outside' extends outside world bounds",
        "Chunk '0,0' region refs do not match geometry",
      ]),
    );
  });

  it("reports missing blended coverage and absent chunk coverage", () => {
    const result = validateWorldLayers({
      mapId: "empty-coverage",
      bounds: { width: 128, height: 128 },
      regions: [],
      chunks: [
        {
          key: "empty",
          x: 0,
          y: 0,
          bounds: { x: 0, y: 0, width: 64, height: 64 },
        },
        {
          key: "foliage-ref-mismatch",
          x: 1,
          y: 0,
          bounds: { x: 64, y: 0, width: 64, height: 64 },
          foliageZones: [],
        },
      ],
      foliageZones: [
        {
          id: "intersecting-zone",
          bounds: { x: 64, y: 0, width: 32, height: 32 },
          count: 0,
          species: [{ id: "pine", weight: 1 }],
        },
      ],
      foliageSpecies,
      requireBlendedRegionCoverage: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "World has no regions for blended coverage",
        "Chunk 'empty' has no region coverage",
        "Chunk 'empty' has no foliage zone coverage",
        "Chunk 'foliage-ref-mismatch' has no region coverage",
        "Chunk 'foliage-ref-mismatch' has no foliage zone coverage",
      ]),
    );
    expect(result.warnings).toEqual(expect.arrayContaining(["Chunk 'foliage-ref-mismatch' foliage zone refs do not match geometry"]));
  });

  it("counts route clearance violations only for collidable foliage", () => {
    const violations = countRouteClearanceViolations({
      routes,
      foliageSpecies,
      foliageInstances: [
        {
          id: "pine.blocking",
          speciesId: "pine",
          x: 80,
          y: 55,
          variantSeed: 1,
          rotation: 0,
          scale: 1,
          zoneId: "mixed",
        },
        {
          id: "grass.safe",
          speciesId: "grass",
          x: 90,
          y: 50,
          variantSeed: 1,
          rotation: 0,
          scale: 1,
          zoneId: "mixed",
        },
      ],
    });

    expect(violations).toBe(1);
  });
});

describe("foliage placement", () => {
  it("keeps placements out of route clearances and explicit exclusions", () => {
    const result = generateFoliagePlacementResult({
      seed: 42,
      routes,
      maxAttemptsPerInstance: 200,
      zones: [
        {
          id: "safe-zone",
          bounds: { x: 0, y: 0, width: 220, height: 120 },
          count: 8,
          species: [{ id: "pine", weight: 1 }],
          minSpacing: 8,
          excludeRadiusFromRoutes: 8,
          exclusions: [
            {
              kind: "rect",
              bounds: { x: 160, y: 80, width: 40, height: 40 },
            },
          ],
        },
      ],
    });

    expect(result.instances).toHaveLength(8);
    expect(result.report).toMatchObject({ requested: 8, placed: 8 });
    expect(
      countRouteClearanceViolations({
        routes,
        foliageSpecies,
        foliageInstances: result.instances,
      }),
    ).toBe(0);
    expect(
      result.instances.some(
        (instance) => instance.x >= 160 && instance.x <= 200 && instance.y >= 80 && instance.y <= 120,
      ),
    ).toBe(false);
    expect(result.report.zones[0]?.rejectedByRoutes).toBeGreaterThan(0);
    expect(result.report.zones[0]?.rejectedByExclusions).toBeGreaterThan(0);
  });

  it("handles circle, ellipse, and polyline exclusions and falls back for empty species weights", () => {
    const result = generateFoliagePlacementResult({
      seed: 7,
      maxAttemptsPerInstance: 300,
      zones: [
        {
          id: "exclusions",
          bounds: { x: 0, y: 0, width: 160, height: 120 },
          count: 6,
          species: [{ id: "fallback", weight: 0 }],
          exclusions: [
            { kind: "circle", x: 24, y: 24, radius: 20 },
            { kind: "ellipse", x: 80, y: 60, radiusX: 24, radiusY: 12 },
            {
              kind: "polyline",
              points: [
                { x: 120, y: 0 },
                { x: 120, y: 120 },
              ],
              radius: 10,
            },
          ],
        },
      ],
    });

    expect(result.instances).toHaveLength(6);
    expect(result.instances.every((instance) => instance.speciesId === "fallback")).toBe(true);
    expect(result.report.zones[0]?.rejectedByExclusions).toBeGreaterThan(0);
    expect(result.instances.some((instance) => Math.hypot(instance.x - 24, instance.y - 24) < 20)).toBe(false);
    expect(
      result.instances.some((instance) => ((instance.x - 80) / 24) ** 2 + ((instance.y - 60) / 12) ** 2 < 1),
    ).toBe(false);
    expect(result.instances.some((instance) => Math.abs(instance.x - 120) < 10)).toBe(false);
  });

  it("exposes simple placement output and reports spacing pressure", () => {
    const result = generateFoliagePlacementResult({
      seed: 9,
      maxAttemptsPerInstance: 10,
      zones: [
        {
          id: "tight",
          bounds: { x: 0, y: 0, width: 8, height: 8 },
          count: 3,
          species: [],
          minSpacing: 100,
        },
      ],
    });

    expect(result.instances).toHaveLength(1);
    expect(result.instances[0]?.speciesId).toBe("unknown");
    expect(result.report.zones[0]?.rejectedBySpacing).toBeGreaterThan(0);
    expect(generateFoliagePlacements({ seed: 10, zones: [] })).toEqual([]);
  });
});
