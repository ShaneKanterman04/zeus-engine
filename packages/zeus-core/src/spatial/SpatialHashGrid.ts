import type { Vec2 } from "../types.js";

export type ZeusSpatialItem = {
  id: string;
  position: Vec2;
  radius: number;
};

export type ZeusSpatialQueryRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export class ZeusSpatialHashGrid<T extends ZeusSpatialItem> {
  private readonly cells = new Map<string, Set<string>>();
  private readonly items = new Map<string, T>();
  private readonly itemCells = new Map<string, string[]>();

  constructor(readonly cellSize = 256) {}

  clear() {
    this.cells.clear();
    this.items.clear();
    this.itemCells.clear();
  }

  set(item: T) {
    this.remove(item.id);
    this.items.set(item.id, item);
    const cells = this.cellsForCircle(item.position, item.radius);
    this.itemCells.set(item.id, cells);
    for (const cell of cells) {
      let bucket = this.cells.get(cell);
      if (!bucket) {
        bucket = new Set();
        this.cells.set(cell, bucket);
      }
      bucket.add(item.id);
    }
  }

  remove(id: string) {
    const cells = this.itemCells.get(id);
    if (cells) {
      for (const cell of cells) {
        const bucket = this.cells.get(cell);
        bucket?.delete(id);
        if (bucket?.size === 0) this.cells.delete(cell);
      }
    }
    this.itemCells.delete(id);
    return this.items.delete(id);
  }

  get(id: string) {
    return this.items.get(id);
  }

  values() {
    return this.items.values();
  }

  queryRect(rect: ZeusSpatialQueryRect) {
    const result = new Map<string, T>();
    for (const key of this.cellsForRect(rect)) {
      const bucket = this.cells.get(key);
      if (!bucket) continue;
      for (const id of bucket) {
        const item = this.items.get(id);
        if (!item) continue;
        if (circleIntersectsRect(item.position, item.radius, rect)) result.set(id, item);
      }
    }
    return [...result.values()];
  }

  queryCircle(position: Vec2, radius: number) {
    const result = new Map<string, T>();
    const radiusSquared = radius * radius;
    for (const key of this.cellsForCircle(position, radius)) {
      const bucket = this.cells.get(key);
      if (!bucket) continue;
      for (const id of bucket) {
        const item = this.items.get(id);
        if (!item) continue;
        const dx = item.position.x - position.x;
        const dy = item.position.y - position.y;
        const reach = radius + item.radius;
        if (dx * dx + dy * dy <= Math.max(radiusSquared, reach * reach)) result.set(id, item);
      }
    }
    return [...result.values()];
  }

  nearest(position: Vec2, radius: number, predicate: (item: T) => boolean = () => true) {
    let nearest: T | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const item of this.queryCircle(position, radius)) {
      if (!predicate(item)) continue;
      const distance = Math.hypot(item.position.x - position.x, item.position.y - position.y);
      if (distance < nearestDistance) {
        nearest = item;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private cellsForCircle(position: Vec2, radius: number) {
    return this.cellsForRect({ x: position.x - radius, y: position.y - radius, width: radius * 2, height: radius * 2 });
  }

  private cellsForRect(rect: ZeusSpatialQueryRect) {
    const minX = Math.floor(rect.x / this.cellSize);
    const minY = Math.floor(rect.y / this.cellSize);
    const maxX = Math.floor((rect.x + rect.width) / this.cellSize);
    const maxY = Math.floor((rect.y + rect.height) / this.cellSize);
    const keys: string[] = [];
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) keys.push(`${x}:${y}`);
    }
    return keys;
  }
}

function circleIntersectsRect(position: Vec2, radius: number, rect: ZeusSpatialQueryRect) {
  const closestX = Math.max(rect.x, Math.min(position.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(position.y, rect.y + rect.height));
  const dx = position.x - closestX;
  const dy = position.y - closestY;
  return dx * dx + dy * dy <= radius * radius;
}
