import type { ZeusAssetEntry } from "./AssetManifest.js";

export function runtimeAssetPath(asset: ZeusAssetEntry, runtimeRoot = "assets_game") {
  return asset.src.replace(/^\/assets/, runtimeRoot);
}

export function expectedRuntimeSignature(asset: ZeusAssetEntry) {
  if (asset.kind === "image" || asset.kind === "atlas") return "PNG";
  if (asset.kind === "audio") return asset.src.endsWith(".wav") ? "RIFF" : "OggS";
  return "";
}
