import { isAbsolute, join } from "node:path";
import { createPixelCanvas, writePixelCanvasPng, type PixelCanvas, type RgbaColor } from "./PixelCanvas.js";
import { builtinPixelSpriteTemplates } from "./PixelSpriteTemplates.js";

export type PixelSpritePalette = Record<string, RgbaColor>;

export type PixelSpriteFrameConfig = {
  id: string;
  width: number;
  height: number;
  output: string;
  template: string;
  variant?: string;
  palette?: PixelSpritePalette;
  options?: Record<string, unknown>;
  anchor?: { x: number; y: number };
  tags?: string[];
};

export type PixelSpriteGeneratorConfig = {
  outputDir?: string;
  palette?: PixelSpritePalette;
  frames: PixelSpriteFrameConfig[];
  templates?: PixelSpriteTemplateRegistry;
};

export type PixelSpriteTemplateContext = {
  canvas: PixelCanvas;
  frame: PixelSpriteFrameConfig;
  palette: PixelSpritePalette;
  options: Record<string, unknown>;
};

export type PixelSpriteTemplate = (context: PixelSpriteTemplateContext) => void;

export type PixelSpriteTemplateRegistry = Record<string, PixelSpriteTemplate>;

export type GeneratedPixelSprite = {
  id: string;
  output: string;
  width: number;
  height: number;
  template: string;
  variant?: string;
};

export async function generatePixelSprites(config: PixelSpriteGeneratorConfig): Promise<GeneratedPixelSprite[]> {
  const errors = validatePixelSpriteGeneratorConfig(config);
  if (errors.length) throw new Error(errors.join("\n"));

  const templates = { ...builtinPixelSpriteTemplates, ...config.templates };
  const results: GeneratedPixelSprite[] = [];
  for (const frame of config.frames) {
    const canvas = renderPixelSprite(frame, templates, config.palette);
    const output = resolveOutputPath(config.outputDir, frame.output);
    await writePixelCanvasPng(output, canvas);
    results.push({
      id: frame.id,
      output,
      width: frame.width,
      height: frame.height,
      template: frame.template,
      ...(frame.variant ? { variant: frame.variant } : {}),
    });
  }
  return results;
}

export function renderPixelSprite(
  frame: PixelSpriteFrameConfig,
  templates: PixelSpriteTemplateRegistry = builtinPixelSpriteTemplates,
  basePalette: PixelSpritePalette = {},
) {
  const errors = validatePixelSpriteFrame(frame, templates);
  if (errors.length) throw new Error(errors.join("\n"));

  const canvas = createPixelCanvas(frame.width, frame.height);
  const template = resolveTemplate(frame, templates);
  template({
    canvas,
    frame,
    palette: { ...basePalette, ...frame.palette },
    options: frame.options ?? {},
  });
  return canvas;
}

export function validatePixelSpriteGeneratorConfig(config: PixelSpriteGeneratorConfig) {
  const errors: string[] = [];
  const ids = new Set<string>();
  const outputs = new Set<string>();
  const templates = { ...builtinPixelSpriteTemplates, ...config.templates };
  for (const frame of config.frames ?? []) {
    if (frame.id && ids.has(frame.id)) errors.push(`Duplicate pixel sprite id: ${frame.id}`);
    if (frame.id) ids.add(frame.id);
    if (frame.output && outputs.has(frame.output)) errors.push(`Duplicate pixel sprite output: ${frame.output}`);
    if (frame.output) outputs.add(frame.output);
    errors.push(...validatePixelSpriteFrame(frame, templates));
  }
  if (!config.frames?.length) errors.push("Pixel sprite generator must include at least one frame");
  return errors;
}

export function validatePixelSpriteFrame(frame: PixelSpriteFrameConfig, templates: PixelSpriteTemplateRegistry = builtinPixelSpriteTemplates) {
  const errors: string[] = [];
  if (!frame.id) errors.push("Pixel sprite frame missing id");
  if (!frame.output) errors.push(`Pixel sprite frame '${frame.id || "unknown"}' missing output`);
  if (!Number.isInteger(frame.width) || frame.width <= 0) errors.push(`Pixel sprite frame '${frame.id}' has invalid width`);
  if (!Number.isInteger(frame.height) || frame.height <= 0) errors.push(`Pixel sprite frame '${frame.id}' has invalid height`);
  if (!frame.template) {
    errors.push(`Pixel sprite frame '${frame.id || "unknown"}' missing template`);
  } else if (!hasTemplate(frame, templates)) {
    errors.push(`Pixel sprite frame '${frame.id}' references unknown template '${templateKey(frame)}'`);
  }
  if (frame.anchor && (frame.anchor.x < 0 || frame.anchor.x > 1 || frame.anchor.y < 0 || frame.anchor.y > 1)) {
    errors.push(`Pixel sprite frame '${frame.id}' has invalid anchor`);
  }
  return errors;
}

function resolveTemplate(frame: PixelSpriteFrameConfig, templates: PixelSpriteTemplateRegistry) {
  const template = templates[templateKey(frame)] ?? templates[frame.template];
  if (!template) throw new Error(`Unknown pixel sprite template: ${templateKey(frame)}`);
  return template;
}

function hasTemplate(frame: PixelSpriteFrameConfig, templates: PixelSpriteTemplateRegistry) {
  return Boolean(templates[templateKey(frame)] ?? templates[frame.template]);
}

function templateKey(frame: PixelSpriteFrameConfig) {
  return frame.variant ? `${frame.template}.${frame.variant}` : frame.template;
}

function resolveOutputPath(outputDir: string | undefined, output: string) {
  if (!outputDir || isAbsolute(output)) return output;
  return join(outputDir, output);
}
