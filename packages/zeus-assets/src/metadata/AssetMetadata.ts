import type { AssetManifestRegistry } from "../AssetManifest";

export type AssetReviewStatus = "approved" | "needs-review" | "rejected";
export type AssetProvenance = "generated" | "authored" | "external";

export type AssetMetadataEntry = {
  assetId: string;
  provenance: AssetProvenance;
  source: string;
  promptId?: string;
  reviewer: string;
  reviewStatus: AssetReviewStatus;
  commercialUseReviewed: boolean;
};

export type AssetMetadataManifest = {
  version: number;
  metadata: AssetMetadataEntry[];
};

export function validateAssetMetadata(metadata: AssetMetadataManifest, assets: AssetManifestRegistry) {
  const errors: string[] = [];
  if (!Number.isInteger(metadata.version) || metadata.version <= 0) {
    errors.push("Asset metadata version must be a positive integer");
  }
  const ids = new Set<string>();
  for (const entry of metadata.metadata ?? []) {
    if (!entry.assetId) errors.push("Asset metadata missing assetId");
    if (entry.assetId && ids.has(entry.assetId)) errors.push(`Duplicate asset metadata: ${entry.assetId}`);
    if (entry.assetId) ids.add(entry.assetId);
    try {
      assets.get(entry.assetId);
    } catch {
      errors.push(`Asset metadata references unknown asset: ${entry.assetId}`);
    }
    if (!entry.source) errors.push(`Asset metadata '${entry.assetId}' missing source`);
    if (!entry.reviewer) errors.push(`Asset metadata '${entry.assetId}' missing reviewer`);
    if (entry.reviewStatus !== "approved") errors.push(`Asset metadata '${entry.assetId}' is not approved`);
    if (!entry.commercialUseReviewed) errors.push(`Asset metadata '${entry.assetId}' missing commercial-use review`);
    if (entry.provenance === "generated" && !entry.promptId) {
      errors.push(`Generated asset metadata '${entry.assetId}' missing promptId`);
    }
  }
  return errors;
}
