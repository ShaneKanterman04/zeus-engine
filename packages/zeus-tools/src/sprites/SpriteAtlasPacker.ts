import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";

export type SpritePackFrameConfig = {
  id: string;
  source: string;
  width: number;
  height: number;
  anchor?: { x: number; y: number };
  tags?: string[];
};

export type SpritePackConfig = {
  atlasId: string;
  atlasPath: string;
  framesPath: string;
  frames: SpritePackFrameConfig[];
  padding?: number;
  background?: { r: number; g: number; b: number; alpha: number };
};

export type SpritePackFrameResult = SpritePackFrameConfig & {
  atlas: string;
  x: number;
  y: number;
  trimmedWidth: number;
  trimmedHeight: number;
};

export type SpritePackResult = {
  atlasId: string;
  atlasPath: string;
  framesPath: string;
  width: number;
  height: number;
  frames: SpritePackFrameResult[];
};

type PreparedFrame = SpritePackFrameConfig & {
  input: Buffer;
  x: number;
  y: number;
  trimmedWidth: number;
  trimmedHeight: number;
};

export function validateSpritePack(config: SpritePackConfig) {
  const errors: string[] = [];
  if (!config.atlasId) errors.push("Sprite pack missing atlasId");
  if (!config.atlasPath) errors.push("Sprite pack missing atlasPath");
  if (!config.framesPath) errors.push("Sprite pack missing framesPath");
  const ids = new Set<string>();
  for (const frame of config.frames ?? []) {
    if (!frame.id) errors.push("Sprite frame missing id");
    if (frame.id && ids.has(frame.id)) errors.push(`Duplicate sprite frame id: ${frame.id}`);
    if (frame.id) ids.add(frame.id);
    if (!frame.source) errors.push(`Sprite frame '${frame.id || "unknown"}' missing source`);
    if (!Number.isInteger(frame.width) || frame.width <= 0) errors.push(`Sprite frame '${frame.id}' has invalid width`);
    if (!Number.isInteger(frame.height) || frame.height <= 0) errors.push(`Sprite frame '${frame.id}' has invalid height`);
    if (frame.anchor && (frame.anchor.x < 0 || frame.anchor.x > 1 || frame.anchor.y < 0 || frame.anchor.y > 1)) {
      errors.push(`Sprite frame '${frame.id}' has invalid anchor`);
    }
  }
  if (!config.frames?.length) errors.push("Sprite pack must include at least one frame");
  return errors;
}

export async function packSpriteAtlas(config: SpritePackConfig): Promise<SpritePackResult> {
  const errors = validateSpritePack(config);
  if (errors.length) throw new Error(errors.join("\n"));

  const padding = config.padding ?? 2;
  const prepared = await Promise.all(config.frames.map((frame) => prepareFrame(frame)));
  const layout = layoutFrames(prepared, padding);
  const background = config.background ?? { r: 0, g: 0, b: 0, alpha: 0 };
  const composites = layout.frames.map((frame) => ({ input: frame.input, left: frame.x, top: frame.y }));

  await mkdir(dirname(config.atlasPath), { recursive: true });
  await sharp({
    create: {
      width: layout.width,
      height: layout.height,
      channels: 4,
      background,
    },
  })
    .composite(composites)
    .png()
    .toFile(config.atlasPath);

  const frames = layout.frames.map((frame) => ({
    id: frame.id,
    atlas: config.atlasId,
    source: frame.source,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    trimmedWidth: frame.trimmedWidth,
    trimmedHeight: frame.trimmedHeight,
    anchor: frame.anchor,
    tags: frame.tags,
  }));

  await mkdir(dirname(config.framesPath), { recursive: true });
  await writeFile(
    config.framesPath,
    `${JSON.stringify(
      {
        frames: frames.map(({ id, atlas, x, y, width, height, anchor }) => ({
          id,
          atlas,
          x,
          y,
          width,
          height,
          ...(anchor ? { anchor } : {}),
        })),
      },
      null,
      2,
    )}\n`,
  );

  return {
    atlasId: config.atlasId,
    atlasPath: config.atlasPath,
    framesPath: config.framesPath,
    width: layout.width,
    height: layout.height,
    frames,
  };
}

export async function createSpriteContactSheet(
  result: SpritePackResult,
  outputPath: string,
  options: { columns?: number; cellWidth?: number; cellHeight?: number; background?: string } = {},
) {
  const columns = options.columns ?? 6;
  const cellWidth = options.cellWidth ?? 128;
  const cellHeight = options.cellHeight ?? 112;
  const rows = Math.ceil(result.frames.length / columns);
  const composites = await Promise.all(result.frames.map(async (frame, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = column * cellWidth + Math.floor((cellWidth - frame.width) / 2);
    const top = row * cellHeight + 10;
    return {
      input: await sharp(result.atlasPath)
        .extract({ left: frame.x, top: frame.y, width: frame.width, height: frame.height })
        .png()
        .toBuffer(),
      left,
      top,
    };
  }));

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp({
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 4,
      background: options.background ?? "#263026",
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

export async function writeSpriteQaReport(result: SpritePackResult, outputPath: string) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        atlasId: result.atlasId,
        atlasPath: result.atlasPath,
        framesPath: result.framesPath,
        width: result.width,
        height: result.height,
        frameCount: result.frames.length,
        frames: result.frames.map((frame) => ({
          id: frame.id,
          source: frame.source,
          width: frame.width,
          height: frame.height,
          trimmedWidth: frame.trimmedWidth,
          trimmedHeight: frame.trimmedHeight,
          anchor: frame.anchor,
          tags: frame.tags ?? [],
        })),
      },
      null,
      2,
    )}\n`,
  );
}

async function prepareFrame(frame: SpritePackFrameConfig): Promise<PreparedFrame> {
  const source = await readFile(frame.source);
  const trimmed = await sharp(source, { failOn: "none" }).trim({ threshold: 8 }).png().toBuffer();
  const metadata = await sharp(trimmed).metadata();
  const scale = Math.min(frame.width / Math.max(1, metadata.width ?? frame.width), frame.height / Math.max(1, metadata.height ?? frame.height));
  const trimmedWidth = Math.max(1, Math.round((metadata.width ?? frame.width) * scale));
  const trimmedHeight = Math.max(1, Math.round((metadata.height ?? frame.height) * scale));
  const resized = await sharp(trimmed)
    .resize({ width: trimmedWidth, height: trimmedHeight, fit: "contain" })
    .extend({
      left: Math.floor((frame.width - trimmedWidth) / 2),
      right: Math.ceil((frame.width - trimmedWidth) / 2),
      top: Math.floor((frame.height - trimmedHeight) / 2),
      bottom: Math.ceil((frame.height - trimmedHeight) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return {
    ...frame,
    input: resized,
    x: 0,
    y: 0,
    trimmedWidth,
    trimmedHeight,
  };
}

function layoutFrames(frames: PreparedFrame[], padding: number) {
  const columns = Math.ceil(Math.sqrt(frames.length));
  const columnWidths = new Array(columns).fill(0);
  const rowHeights: number[] = [];
  for (let index = 0; index < frames.length; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column], frames[index]?.width ?? 0);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, frames[index]?.height ?? 0);
  }
  const columnX = columnWidths.map((_, index) => columnWidths.slice(0, index).reduce((sum, width) => sum + width + padding, padding));
  const rowY = rowHeights.map((_, index) => rowHeights.slice(0, index).reduce((sum, height) => sum + height + padding, padding));
  const laidOut = frames.map((frame, index) => ({
    ...frame,
    x: columnX[index % columns] ?? padding,
    y: rowY[Math.floor(index / columns)] ?? padding,
  }));
  return {
    width: nextPowerOfTwo(columnWidths.reduce((sum, width) => sum + width + padding, padding)),
    height: nextPowerOfTwo(rowHeights.reduce((sum, height) => sum + height + padding, padding)),
    frames: laidOut,
  };
}

function nextPowerOfTwo(value: number) {
  return 2 ** Math.ceil(Math.log2(Math.max(1, value)));
}
