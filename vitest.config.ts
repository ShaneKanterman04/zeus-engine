import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@zeus/ai": resolve(root, "packages/zeus-ai/src/index.ts"),
      "@zeus/assets": resolve(root, "packages/zeus-assets/src/index.ts"),
      "@zeus/audio": resolve(root, "packages/zeus-audio/src/index.ts"),
      "@zeus/core": resolve(root, "packages/zeus-core/src/index.ts"),
      "@zeus/debug": resolve(root, "packages/zeus-debug/src/index.ts"),
      "@zeus/input": resolve(root, "packages/zeus-input/src/index.ts"),
      "@zeus/net": resolve(root, "packages/zeus-net/src/index.ts"),
      "@zeus/net-colyseus": resolve(root, "packages/zeus-net-colyseus/src/index.ts"),
      "@zeus/renderer-pixi": resolve(root, "packages/zeus-renderer-pixi/src/index.ts"),
      "@zeus/tools": resolve(root, "packages/zeus-tools/src/index.ts"),
    },
  },
  test: {
    coverage: {
      include: [
        "packages/zeus-assets/src/AssetManifest.ts",
        "packages/zeus-core/src/chunks/ChunkStreamer.ts",
        "packages/zeus-core/src/simulation/FixedStepLoop.ts",
        "packages/zeus-core/src/worldLayerIndex.ts",
        "packages/zeus-core/src/worldLayers.ts",
        "packages/zeus-input/src/InputContext.ts",
        "packages/zeus-tools/src/foliage/FoliagePlacement.ts",
        "packages/zeus-tools/src/world/WorldLayerValidation.ts",
      ],
      provider: "v8",
      reporter: ["text", "json"],
      reportsDirectory: "coverage",
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    include: ["tests/**/*.test.ts"],
  },
});
