export { runValidateCli } from "./cli/validate.js";
export { LastValidContent } from "./hot-reload/index.js";
export type { ValidationResult } from "./hot-reload/index.js";
export { validateContentSchema } from "./schema/index.js";
export type { ContentFieldRule, ContentSchema, FieldType } from "./schema/index.js";
export { createSpriteContactSheet, packSpriteAtlas, validateSpritePack, writeSpriteQaReport } from "./sprites/SpriteAtlasPacker.js";
export type { SpritePackConfig, SpritePackFrameConfig, SpritePackFrameResult, SpritePackResult } from "./sprites/SpriteAtlasPacker.js";
export { importChromaKeySpriteSheet, validateSpriteSheetImport } from "./sprites/SpriteSheetImporter.js";
export type { SpriteSheetCell, SpriteSheetImportConfig, SpriteSheetImportResult } from "./sprites/SpriteSheetImporter.js";
export {
  createPixelCanvas,
  drawDeterministicSpeckles,
  drawEllipse,
  drawLine,
  drawPolygon,
  drawRasterLine,
  drawRect,
  drawTriangle,
  fillPixelCanvas,
  pixelCanvasToPngBuffer,
  setPixel,
  writePixelCanvasPng,
} from "./sprites/PixelCanvas.js";
export type { PixelCanvas, PixelPoint, RgbaColor } from "./sprites/PixelCanvas.js";
export {
  generatePixelSprites,
  renderPixelSprite,
  validatePixelSpriteFrame,
  validatePixelSpriteGeneratorConfig,
} from "./sprites/PixelSpriteGenerator.js";
export type {
  GeneratedPixelSprite,
  PixelSpriteFrameConfig,
  PixelSpriteGeneratorConfig,
  PixelSpritePalette,
  PixelSpriteTemplate,
  PixelSpriteTemplateContext,
  PixelSpriteTemplateRegistry,
} from "./sprites/PixelSpriteGenerator.js";
export { builtinPixelSpriteTemplates, defaultPixelSpritePalette } from "./sprites/PixelSpriteTemplates.js";
export {
  deterministicRange,
  drawBarkLines,
  drawGroundShadow,
  drawInsetRect,
  drawPixelCluster,
  drawPixelNoise,
  mixColor,
  shadeColor,
  spriteHash,
} from "./sprites/PixelDetail.js";
export type { PixelBounds } from "./sprites/PixelDetail.js";
export { generateFoliagePlacementResult, generateFoliagePlacements } from "./foliage/FoliagePlacement.js";
export { validateChunkMap } from "./world/ChunkMapValidation.js";
export { countRouteClearanceViolations, validateWorldLayers } from "./world/WorldLayerValidation.js";
export { createWorldReviewReport } from "./world/WorldReviewReport.js";
export type {
  ZeusFoliagePlacementInstance,
  ZeusFoliagePlacementOptions,
  ZeusFoliagePlacementReport,
  ZeusFoliagePlacementResult,
  ZeusFoliagePlacementRoute,
  ZeusFoliagePlacementZoneReport,
  ZeusFoliagePlacementZone,
} from "./foliage/FoliagePlacement.js";
export type { ZeusChunkMapValidationChunk, ZeusChunkMapValidationOptions } from "./world/ChunkMapValidation.js";
export type { ZeusWorldLayerValidationOptions, ZeusWorldLayerValidationResult } from "./world/WorldLayerValidation.js";
export type { ZeusWorldReviewReport, ZeusWorldReviewReportOptions } from "./world/WorldReviewReport.js";
