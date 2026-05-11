import type { AssetManifestRegistry } from "@zeus/assets";

export type AtlasFrame = {
  id: string;
  atlas: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchor?: { x: number; y: number };
};

export type AtlasManifest = {
  frames: AtlasFrame[];
};

export class AtlasFrameRegistry {
  private readonly frames = new Map<string, AtlasFrame>();

  constructor(manifest: AtlasManifest, assets: AssetManifestRegistry) {
    const errors = validateAtlasManifest(manifest, assets);
    if (errors.length) throw new Error(errors.join("\n"));
    for (const frame of manifest.frames) {
      this.frames.set(frame.id, frame);
    }
  }

  get(id: string) {
    const frame = this.frames.get(id);
    if (!frame) throw new Error(`Unknown atlas frame: ${id}`);
    return frame;
  }
}

export function validateAtlasManifest(manifest: AtlasManifest, assets: AssetManifestRegistry) {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const frame of manifest.frames ?? []) {
    if (!frame.id) errors.push("Atlas frame missing id");
    if (frame.id && ids.has(frame.id)) errors.push(`Duplicate atlas frame id: ${frame.id}`);
    if (frame.id) ids.add(frame.id);
    try {
      const asset = assets.get(frame.atlas);
      if (asset.kind !== "atlas") errors.push(`Atlas frame '${frame.id}' references non-atlas asset '${frame.atlas}'`);
    } catch {
      errors.push(`Atlas frame '${frame.id}' references unknown atlas '${frame.atlas}'`);
    }
    if (frame.x < 0 || frame.y < 0 || frame.width <= 0 || frame.height <= 0) {
      errors.push(`Atlas frame '${frame.id}' has invalid rectangle`);
    }
    if (frame.anchor && (frame.anchor.x < 0 || frame.anchor.x > 1 || frame.anchor.y < 0 || frame.anchor.y > 1)) {
      errors.push(`Atlas frame '${frame.id}' has invalid anchor`);
    }
  }
  return errors;
}
