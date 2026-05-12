import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { deflateSync } from "node:zlib";

export type RgbaColor = readonly [number, number, number, number];

export type PixelPoint = readonly [number, number];

export type PixelCanvas = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

export function createPixelCanvas(width: number, height: number, background?: RgbaColor): PixelCanvas {
  assertPositiveInteger(width, "width");
  assertPositiveInteger(height, "height");
  const canvas = { width, height, pixels: new Uint8ClampedArray(width * height * 4) };
  if (background) fillPixelCanvas(canvas, background);
  return canvas;
}

export function fillPixelCanvas(canvas: PixelCanvas, color: RgbaColor) {
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) setPixel(canvas, x, y, color);
  }
}

export function setPixel(canvas: PixelCanvas, x: number, y: number, color: RgbaColor) {
  const pixelX = Math.floor(x);
  const pixelY = Math.floor(y);
  if (pixelX < 0 || pixelY < 0 || pixelX >= canvas.width || pixelY >= canvas.height) return;
  const offset = (pixelY * canvas.width + pixelX) * 4;
  canvas.pixels[offset] = color[0];
  canvas.pixels[offset + 1] = color[1];
  canvas.pixels[offset + 2] = color[2];
  canvas.pixels[offset + 3] = color[3];
}

export function drawRect(canvas: PixelCanvas, x: number, y: number, width: number, height: number, color: RgbaColor) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) setPixel(canvas, xx, yy, color);
  }
}

export function drawEllipse(canvas: PixelCanvas, cx: number, cy: number, rx: number, ry: number, color: RgbaColor) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      if (((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) <= 1) setPixel(canvas, x, y, color);
    }
  }
}

export function drawLine(canvas: PixelCanvas, x0: number, y0: number, x1: number, y1: number, color: RgbaColor) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    setPixel(canvas, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), color);
  }
}

export function drawRasterLine(canvas: PixelCanvas, x0: number, y0: number, x1: number, y1: number, color: RgbaColor) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);
  const dx = Math.abs(endX - x);
  const sx = x < endX ? 1 : -1;
  const dy = -Math.abs(endY - y);
  const sy = y < endY ? 1 : -1;
  let error = dx + dy;
  while (true) {
    setPixel(canvas, x, y, color);
    if (x === endX && y === endY) break;
    const e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y += sy;
    }
  }
}

export function drawTriangle(
  canvas: PixelCanvas,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  color: RgbaColor,
) {
  const minX = Math.floor(Math.min(ax, bx, cx));
  const maxX = Math.ceil(Math.max(ax, bx, cx));
  const minY = Math.floor(Math.min(ay, by, cy));
  const maxY = Math.ceil(Math.max(ay, by, cy));
  const area = edge(ax, ay, bx, by, cx, cy);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w0 = edge(bx, by, cx, cy, x, y);
      const w1 = edge(cx, cy, ax, ay, x, y);
      const w2 = edge(ax, ay, bx, by, x, y);
      if ((area >= 0 && w0 >= 0 && w1 >= 0 && w2 >= 0) || (area < 0 && w0 <= 0 && w1 <= 0 && w2 <= 0)) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

export function drawPolygon(canvas: PixelCanvas, points: PixelPoint[], color: RgbaColor) {
  if (points.length < 3) return;
  const minX = Math.floor(Math.min(...points.map(([x]) => x)));
  const maxX = Math.ceil(Math.max(...points.map(([x]) => x)));
  const minY = Math.floor(Math.min(...points.map(([, y]) => y)));
  const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) setPixel(canvas, x, y, color);
    }
  }
}

export function drawDeterministicSpeckles(canvas: PixelCanvas, color: RgbaColor, count: number, seed: number) {
  for (let i = 0; i < count; i += 1) {
    const x = (seed * 17 + i * 29) % canvas.width;
    const y = (seed * 31 + i * 19) % canvas.height;
    drawRect(canvas, x, y, 2, 1 + (i % 2), color);
  }
}

export async function writePixelCanvasPng(path: string, canvas: PixelCanvas) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, pixelCanvasToPngBuffer(canvas));
}

export function pixelCanvasToPngBuffer(canvas: PixelCanvas) {
  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    const rowStart = y * (canvas.width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < canvas.width * 4; x += 1) {
      raw[rowStart + 1 + x] = canvas.pixels[y * canvas.width * 4 + x] ?? 0;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", Buffer.concat([uint32(canvas.width), uint32(canvas.height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function assertPositiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`Pixel canvas ${name} must be a positive integer`);
}

function edge(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  return (cx - ax) * (by - ay) - (cy - ay) * (bx - ax);
}

function pointInPolygon(x: number, y: number, points: PixelPoint[]) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i] ?? [0, 0];
    const [xj, yj] = points[j] ?? [0, 0];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type);
  return Buffer.concat([uint32(data.length), typeBuffer, data, uint32(crc32(Buffer.concat([typeBuffer, data])))]);
}

function uint32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
