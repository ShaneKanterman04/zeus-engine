export type ZeusAssetKind = "image" | "audio" | "json" | "atlas";

export type ZeusAssetEntry = {
  id: string;
  src: string;
  kind: ZeusAssetKind;
  width?: number;
  height?: number;
  tags?: string[];
};

export type ZeusAssetManifest = {
  version: number;
  assets: ZeusAssetEntry[];
};

export class AssetManifestRegistry {
  private readonly assets = new Map<string, ZeusAssetEntry>();

  constructor(manifest: ZeusAssetManifest) {
    const errors = validateAssetManifest(manifest);
    if (errors.length) throw new Error(errors.join("\n"));
    for (const asset of manifest.assets) {
      this.assets.set(asset.id, asset);
    }
  }

  get(id: string) {
    const asset = this.assets.get(id);
    if (!asset) throw new Error(`Unknown asset: ${id}`);
    return asset;
  }

  resolve(id: string, basePath = "") {
    const asset = this.get(id);
    return `${basePath}${asset.src}`;
  }

  byTag(tag: string) {
    return [...this.assets.values()].filter((asset) => asset.tags?.includes(tag));
  }
}

export function validateAssetManifest(manifest: ZeusAssetManifest) {
  const errors: string[] = [];
  if (!Number.isInteger(manifest.version) || manifest.version <= 0) {
    errors.push("Asset manifest version must be a positive integer");
  }
  const ids = new Set<string>();
  for (const asset of manifest.assets ?? []) {
    if (!asset.id) errors.push("Asset missing id");
    if (!asset.src) errors.push(`Asset '${asset.id || "unknown"}' missing src`);
    if (!asset.kind) errors.push(`Asset '${asset.id || "unknown"}' missing kind`);
    if (asset.id && ids.has(asset.id)) errors.push(`Duplicate asset id: ${asset.id}`);
    if (asset.id) ids.add(asset.id);
    if (asset.width !== undefined && asset.width <= 0) errors.push(`Asset '${asset.id}' has invalid width`);
    if (asset.height !== undefined && asset.height <= 0) errors.push(`Asset '${asset.id}' has invalid height`);
  }
  return errors;
}
