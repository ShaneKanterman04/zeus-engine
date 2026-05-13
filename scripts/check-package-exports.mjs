const packages = [
  "@zeus/assets",
  "@zeus/audio",
  "@zeus/core",
  "@zeus/debug",
  "@zeus/input",
  "@zeus/net",
  "@zeus/net/web-socket-room-client",
  "@zeus/net/web-socket-room-server",
  "@zeus/net-colyseus",
  "@zeus/renderer-pixi",
  "@zeus/tools",
];

for (const packageName of packages) {
  await import(packageName);
}

const core = await import("@zeus/core");
const rendererPixi = await import("@zeus/renderer-pixi");

const expectedNamedExports = [
  [core, "ZeusFrameMetricsSampler"],
  [core, "createEmptyFrameMetricsSnapshot"],
  [rendererPixi, "ZeusPixiRuntime"],
];

for (const [module, exportName] of expectedNamedExports) {
  if (!(exportName in module)) {
    throw new Error(`Missing package export: ${exportName}`);
  }
}

const renderer = new rendererPixi.ZeusPixiRenderer();
if (typeof renderer.clearLayers !== "function") throw new Error("Missing ZeusPixiRenderer.clearLayers");
if (typeof renderer.layerStats !== "function") throw new Error("Missing ZeusPixiRenderer.layerStats");

console.log("package-exports-ok");
