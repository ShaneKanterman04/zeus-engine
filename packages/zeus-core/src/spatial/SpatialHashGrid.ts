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
    const result: T[] = [];
    this.forEachRect(rect, (item) => {
      result.push(item);
    });
    return result;
  }

  forEachRect(rect: ZeusSpatialQueryRect, visit: (item: T) => void) {
    const visited = new Set<string>();
    this.forEachCellKeyInRect(rect, (key) => {
      const bucket = this.cells.get(key);
      if (!bucket) return;
      for (const id of bucket) {
        if (visited.has(id)) continue;
        const item = this.items.get(id);
        if (!item) continue;
        if (!circleIntersectsRect(item.position, item.radius, rect)) continue;
        visited.add(id);
        visit(item);
      }
    });
  }

  queryCircle(position: Vec2, radius: number) {
    const result: T[] = [];
    this.forEachCircle(position, radius, (item) => {
      result.push(item);
    });
    return result;
  }

  forEachCircle(position: Vec2, radius: number, visit: (item: T) => void) {
    const visited = new Set<string>();
    const radiusSquared = radius * radius;
    this.forEachCellKeyInRect({ x: position.x - radius, y: position.y - radius, width: radius * 2, height: radius * 2 }, (key) => {
      const bucket = this.cells.get(key);
      if (!bucket) return;
      for (const id of bucket) {
        if (visited.has(id)) continue;
        const item = this.items.get(id);
        if (!item) continue;
        const dx = item.position.x - position.x;
        const dy = item.position.y - position.y;
        const reach = radius + item.radius;
        if (dx * dx + dy * dy > Math.max(radiusSquared, reach * reach)) continue;
        visited.add(id);
        visit(item);
      }
    });
  }

  nearest(position: Vec2, radius: number, predicate: (item: T) => boolean = () => true) {
    let nearest: T | undefined;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    this.forEachCircle(position, radius, (item) => {
      if (!predicate(item)) return;
      const dx = item.position.x - position.x;
      const dy = item.position.y - position.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < nearestDistanceSquared) {
        nearest = item;
        nearestDistanceSquared = distanceSquared;
      }
    });
    return nearest;
  }

  private cellsForCircle(position: Vec2, radius: number) {
    return this.cellsForRect({ x: position.x - radius, y: position.y - radius, width: radius * 2, height: radius * 2 });
  }

  private cellsForRect(rect: ZeusSpatialQueryRect) {
    const keys: string[] = [];
    this.forEachCellKeyInRect(rect, (key) => keys.push(key));
    return keys;
  }

  private forEachCellKeyInRect(rect: ZeusSpatialQueryRect, visit: (key: string) => void) {
    const minX = Math.floor(rect.x / this.cellSize);
    const minY = Math.floor(rect.y / this.cellSize);
    const maxX = Math.floor((rect.x + rect.width) / this.cellSize);
    const maxY = Math.floor((rect.y + rect.height) / this.cellSize);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) visit(`${x}:${y}`);
    }
  }
}

function circleIntersectsRect(position: Vec2, radius: number, rect: ZeusSpatialQueryRect) {
  const closestX = Math.max(rect.x, Math.min(position.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(position.y, rect.y + rect.height));
  const dx = position.x - closestX;
  const dy = position.y - closestY;
  return dx * dx + dy * dy <= radius * radius;
}
