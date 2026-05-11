import { Graphics } from "pixi.js";
import { samplePolyline } from "@zeus/core";
import type { Vec2 } from "@zeus/core";

export type PixiWaterway = {
  id?: string;
  points: readonly Vec2[];
  width: number;
  seed?: number;
};

export type PixiCreekStyle = {
  bankColor?: string;
  edgeColor?: string;
  waterColor?: string;
  deepColor?: string;
  highlightColor?: string;
  rockColor?: string;
  bankWidth?: number;
  detail?: "standard" | "low";
};

export function createPixiCreekGraphics(waterway: PixiWaterway, style: PixiCreekStyle = {}) {
  const creek = new Graphics();
  const points = waterway.points.filter(isFinitePoint);
  if (points.length === 0) return creek;

  const width = Math.max(2, waterway.width);
  const bankWidth = style.bankWidth ?? Math.max(8, width * 0.18);
  const edgeWidth = Math.max(4, width * 0.08);

  drawRoundedStroke(creek, points, width + bankWidth * 2, style.bankColor ?? "#596f63", 0.72);
  drawRoundedStroke(creek, points, width + edgeWidth * 2, style.edgeColor ?? "#c8d8cc", 0.62);
  drawRoundedStroke(creek, points, width, style.waterColor ?? "#587f8d", 0.92);
  drawRoundedStroke(creek, points, Math.max(8, width * 0.46), style.deepColor ?? "#315866", 0.28);

  if (style.detail !== "low" && points.length > 1) {
    drawCreekDetails(creek, waterway, points, width, bankWidth, style);
  }

  return creek;
}

function drawRoundedStroke(graphics: Graphics, points: readonly Vec2[], width: number, color: string, alpha: number) {
  const radius = width / 2;
  if (points.length === 1) {
    graphics.circle(points[0].x, points[0].y, radius).fill({ color, alpha });
    return;
  }

  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
  }
  graphics.stroke({ color, alpha, width });

  for (const point of points) {
    graphics.circle(point.x, point.y, radius).fill({ color, alpha });
  }
}

function drawCreekDetails(
  graphics: Graphics,
  waterway: PixiWaterway,
  points: readonly Vec2[],
  width: number,
  bankWidth: number,
  style: PixiCreekStyle,
) {
  const random = seededRandom(waterway.seed ?? hashString(waterway.id ?? "waterway"));
  const samples = samplePolyline(points, Math.max(84, width * 1.2));
  const highlightWidth = Math.max(1.5, width * 0.024);

  for (let index = 1; index < samples.length - 1; index += 1) {
    const tangent = nearestTangent(points, samples[index]);
    const normal = { x: -tangent.y, y: tangent.x };
    const side = random() > 0.5 ? 1 : -1;
    const offset = (random() - 0.5) * width * 0.45;
    const length = width * (0.16 + random() * 0.16);
    const center = {
      x: samples[index].x + normal.x * offset,
      y: samples[index].y + normal.y * offset,
    };

    graphics
      .moveTo(center.x - tangent.x * length, center.y - tangent.y * length)
      .lineTo(center.x + tangent.x * length, center.y + tangent.y * length)
      .stroke({ color: style.highlightColor ?? "#d9ecee", alpha: 0.25, width: highlightWidth });

    if (index % 2 === 0) {
      const bankOffset = side * (width * 0.55 + bankWidth * (0.35 + random() * 0.65));
      const rock = {
        x: samples[index].x + normal.x * bankOffset,
        y: samples[index].y + normal.y * bankOffset,
      };
      graphics
        .ellipse(rock.x, rock.y, 3 + random() * 5, 2 + random() * 3)
        .fill({ color: style.rockColor ?? "#4f5c4f", alpha: 0.42 });
    }
  }
}

function nearestTangent(points: readonly Vec2[], point: Vec2) {
  let bestStart = points[0];
  let bestEnd = points[1];
  let closest = Number.POSITIVE_INFINITY;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) continue;
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    const projected = { x: start.x + dx * t, y: start.y + dy * t };
    const distanceSquared = (point.x - projected.x) ** 2 + (point.y - projected.y) ** 2;
    if (distanceSquared < closest) {
      closest = distanceSquared;
      bestStart = start;
      bestEnd = end;
    }
  }

  const dx = bestEnd.x - bestStart.x;
  const dy = bestEnd.y - bestStart.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isFinitePoint(point: Vec2) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}
