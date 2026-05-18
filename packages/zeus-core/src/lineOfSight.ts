import type { Vec2 } from "./types.js";
import type { ZeusRect } from "./worldLayers.js";
import { distanceToSegment } from "./world.js";
import { zeusPointInRect } from "./worldLayers.js";

export type ZeusCircleBlocker = {
  kind: "circle";
  center: Vec2;
  radius: number;
  id?: string;
};

export type ZeusRectBlocker = {
  kind: "rect";
  bounds: ZeusRect;
  id?: string;
};

export type ZeusLineOfSightBlocker = ZeusCircleBlocker | ZeusRectBlocker;

export type ZeusLineOfSightResult = {
  blocked: boolean;
  blocker?: ZeusLineOfSightBlocker;
};

export function zeusSegmentIntersectsCircle(start: Vec2, end: Vec2, center: Vec2, radius: number) {
  return distanceToSegment(center, start, end) <= Math.max(0, radius);
}

export function zeusSegmentsIntersect(aStart: Vec2, aEnd: Vec2, bStart: Vec2, bEnd: Vec2) {
  const a = orientation(aStart, aEnd, bStart);
  const b = orientation(aStart, aEnd, bEnd);
  const c = orientation(bStart, bEnd, aStart);
  const d = orientation(bStart, bEnd, aEnd);

  if (a === 0 && pointOnSegment(bStart, aStart, aEnd)) return true;
  if (b === 0 && pointOnSegment(bEnd, aStart, aEnd)) return true;
  if (c === 0 && pointOnSegment(aStart, bStart, bEnd)) return true;
  if (d === 0 && pointOnSegment(aEnd, bStart, bEnd)) return true;

  return a !== b && c !== d;
}

export function zeusSegmentIntersectsRect(start: Vec2, end: Vec2, rect: ZeusRect) {
  if (zeusPointInRect(start, rect) || zeusPointInRect(end, rect)) return true;

  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const corners = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];

  for (let index = 0; index < corners.length; index += 1) {
    if (zeusSegmentsIntersect(start, end, corners[index], corners[(index + 1) % corners.length])) {
      return true;
    }
  }
  return false;
}

export function zeusLineOfSight(start: Vec2, end: Vec2, blockers: readonly ZeusLineOfSightBlocker[]): ZeusLineOfSightResult {
  for (const blocker of blockers) {
    const blocked =
      blocker.kind === "circle"
        ? zeusSegmentIntersectsCircle(start, end, blocker.center, blocker.radius)
        : zeusSegmentIntersectsRect(start, end, blocker.bounds);
    if (blocked) return { blocked: true, blocker };
  }
  return { blocked: false };
}

function orientation(a: Vec2, b: Vec2, c: Vec2) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < Number.EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

function pointOnSegment(point: Vec2, start: Vec2, end: Vec2) {
  return (
    point.x <= Math.max(start.x, end.x) &&
    point.x >= Math.min(start.x, end.x) &&
    point.y <= Math.max(start.y, end.y) &&
    point.y >= Math.min(start.y, end.y)
  );
}
