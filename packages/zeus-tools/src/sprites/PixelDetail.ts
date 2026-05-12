import { drawEllipse, drawLine, drawRect, setPixel, type PixelCanvas, type RgbaColor } from "./PixelCanvas.js";

export type PixelBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function spriteHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deterministicRange(seed: string, index: number, min: number, max: number) {
  const value = spriteHash(`${seed}:${index}`) / 0xffffffff;
  return Math.max(min, Math.min(max, Math.floor(min + value * (max - min + 1))));
}

export function shadeColor(color: RgbaColor, amount: number): RgbaColor {
  return [
    clampChannel(color[0] + amount),
    clampChannel(color[1] + amount),
    clampChannel(color[2] + amount),
    color[3],
  ];
}

export function mixColor(a: RgbaColor, b: RgbaColor, t: number): RgbaColor {
  const amount = Math.max(0, Math.min(1, t));
  return [
    clampChannel(a[0] + (b[0] - a[0]) * amount),
    clampChannel(a[1] + (b[1] - a[1]) * amount),
    clampChannel(a[2] + (b[2] - a[2]) * amount),
    clampChannel(a[3] + (b[3] - a[3]) * amount),
  ];
}

export function drawInsetRect(canvas: PixelCanvas, bounds: PixelBounds, fill: RgbaColor, outline: RgbaColor, highlight?: RgbaColor) {
  drawRect(canvas, bounds.x, bounds.y, bounds.width, bounds.height, outline);
  drawRect(canvas, bounds.x + 1, bounds.y + 1, Math.max(0, bounds.width - 2), Math.max(0, bounds.height - 2), fill);
  if (highlight) {
    drawLine(canvas, bounds.x + 2, bounds.y + 2, bounds.x + bounds.width - 3, bounds.y + 2, highlight);
    drawLine(canvas, bounds.x + 2, bounds.y + 2, bounds.x + 2, bounds.y + bounds.height - 3, highlight);
  }
}

export function drawPixelNoise(canvas: PixelCanvas, bounds: PixelBounds, colors: RgbaColor[], count: number, seed: string) {
  if (colors.length === 0) return;
  for (let index = 0; index < count; index += 1) {
    const x = bounds.x + deterministicRange(seed, index * 3, 0, Math.max(0, bounds.width - 1));
    const y = bounds.y + deterministicRange(seed, index * 3 + 1, 0, Math.max(0, bounds.height - 1));
    const color = colors[deterministicRange(seed, index * 3 + 2, 0, colors.length - 1)] ?? colors[0];
    setPixel(canvas, x, y, color);
  }
}

export function drawPixelCluster(canvas: PixelCanvas, x: number, y: number, color: RgbaColor, pattern: readonly PixelBounds[]) {
  for (const part of pattern) drawRect(canvas, x + part.x, y + part.y, part.width, part.height, color);
}

export function drawGroundShadow(canvas: PixelCanvas, cx: number, cy: number, rx: number, ry: number, alpha = 46) {
  drawEllipse(canvas, cx, cy, rx, ry, [0, 0, 0, alpha]);
}

export function drawBarkLines(canvas: PixelCanvas, x: number, y: number, height: number, dark: RgbaColor, light: RgbaColor, seed: string) {
  const lines = Math.max(2, Math.floor(height / 12));
  for (let index = 0; index < lines; index += 1) {
    const yy = y + deterministicRange(seed, index, 1, Math.max(1, height - 2));
    drawLine(canvas, x, yy, x + deterministicRange(seed, index + 20, -2, 2), yy + deterministicRange(seed, index + 40, 4, 9), index % 2 ? dark : light);
  }
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
