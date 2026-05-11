import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

export type SpriteSheetCell = {
  id: string;
  column?: number;
  row?: number;
  rect?: { x: number; y: number; width: number; height: number };
  output: string;
};

export type SpriteSheetImportConfig = {
  sheetPath: string;
  outputDir: string;
  columns: number;
  rows: number;
  cells: SpriteSheetCell[];
  keyColor?: { r: number; g: number; b: number };
  keyTolerance?: number;
  trimThreshold?: number;
};

export type SpriteSheetImportResult = {
  id: string;
  output: string;
  width: number;
  height: number;
};

export async function importChromaKeySpriteSheet(config: SpriteSheetImportConfig) {
  const errors = validateSpriteSheetImport(config);
  if (errors.length) throw new Error(errors.join("\n"));

  const metadata = await sharp(config.sheetPath).metadata();
  const sheetWidth = metadata.width ?? 0;
  const sheetHeight = metadata.height ?? 0;
  const cellWidth = Math.floor(sheetWidth / config.columns);
  const cellHeight = Math.floor(sheetHeight / config.rows);
  const results: SpriteSheetImportResult[] = [];
  await mkdir(config.outputDir, { recursive: true });

  for (const cell of config.cells) {
    const rect = cell.rect ?? {
      left: (cell.column ?? 0) * cellWidth,
      top: (cell.row ?? 0) * cellHeight,
      width: cellWidth,
      height: cellHeight,
    };
    const crop = await sharp(config.sheetPath)
      .extract({
        left: "left" in rect ? rect.left : rect.x,
        top: "top" in rect ? rect.top : rect.y,
        width: rect.width,
        height: rect.height,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const keyed = removeChromaKey(crop.data, crop.info.width, crop.info.height, config.keyColor ?? { r: 0, g: 255, b: 0 }, config.keyTolerance ?? 60);
    const outputPath = join(config.outputDir, cell.output);
    await mkdir(dirname(outputPath), { recursive: true });
    const outputBuffer = await sharp(keyed, { raw: { width: crop.info.width, height: crop.info.height, channels: 4 } })
      .trim({ threshold: config.trimThreshold ?? 8 })
      .png()
      .toBuffer();
    await sharp(outputBuffer).toFile(outputPath);
    const outputMetadata = await sharp(outputPath).metadata();
    results.push({ id: cell.id, output: outputPath, width: outputMetadata.width ?? 0, height: outputMetadata.height ?? 0 });
  }

  return results;
}

export function validateSpriteSheetImport(config: SpriteSheetImportConfig) {
  const errors: string[] = [];
  if (!config.sheetPath) errors.push("Sprite sheet import missing sheetPath");
  if (!config.outputDir) errors.push("Sprite sheet import missing outputDir");
  if (!Number.isInteger(config.columns) || config.columns <= 0) errors.push("Sprite sheet import has invalid columns");
  if (!Number.isInteger(config.rows) || config.rows <= 0) errors.push("Sprite sheet import has invalid rows");
  const ids = new Set<string>();
  for (const cell of config.cells ?? []) {
    if (!cell.id) errors.push("Sprite sheet cell missing id");
    if (cell.id && ids.has(cell.id)) errors.push(`Duplicate sprite sheet cell id: ${cell.id}`);
    if (cell.id) ids.add(cell.id);
    if (cell.rect) {
      if (!Number.isInteger(cell.rect.x) || cell.rect.x < 0) errors.push(`Sprite sheet cell '${cell.id}' has invalid rect x`);
      if (!Number.isInteger(cell.rect.y) || cell.rect.y < 0) errors.push(`Sprite sheet cell '${cell.id}' has invalid rect y`);
      if (!Number.isInteger(cell.rect.width) || cell.rect.width <= 0) errors.push(`Sprite sheet cell '${cell.id}' has invalid rect width`);
      if (!Number.isInteger(cell.rect.height) || cell.rect.height <= 0) errors.push(`Sprite sheet cell '${cell.id}' has invalid rect height`);
    } else {
      const column = cell.column;
      const row = cell.row;
      if (!Number.isInteger(column) || column === undefined || column < 0 || column >= config.columns) errors.push(`Sprite sheet cell '${cell.id}' has invalid column`);
      if (!Number.isInteger(row) || row === undefined || row < 0 || row >= config.rows) errors.push(`Sprite sheet cell '${cell.id}' has invalid row`);
    }
    if (!cell.output) errors.push(`Sprite sheet cell '${cell.id || "unknown"}' missing output`);
  }
  if (!config.cells?.length) errors.push("Sprite sheet import must include at least one cell");
  return errors;
}

function removeChromaKey(input: Buffer, width: number, height: number, key: { r: number; g: number; b: number }, tolerance: number) {
  const output = Buffer.from(input);
  for (let offset = 0; offset < width * height * 4; offset += 4) {
    const distance = Math.hypot(output[offset] - key.r, output[offset + 1] - key.g, output[offset + 2] - key.b);
    if (distance < tolerance) {
      output[offset + 3] = 0;
      continue;
    }
    if (distance < tolerance * 1.8) {
      output[offset + 3] = Math.min(output[offset + 3], Math.round(((distance - tolerance) / (tolerance * 0.8)) * 255));
    }
  }
  return output;
}
