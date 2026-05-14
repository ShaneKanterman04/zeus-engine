export type ZeusChunkCoord = {
  x: number;
  y: number;
};

export type ZeusChunkKey = string;

export type ZeusChunkRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ZeusChunkGridOptions = {
  chunkSize: number;
};

export type ZeusActiveChunkOptions = ZeusChunkGridOptions & {
  viewport: ZeusChunkRect;
  margin?: number;
};

export function zeusChunkKey(coord: ZeusChunkCoord): ZeusChunkKey {
  return `${coord.x}:${coord.y}`;
}

export function zeusChunkCoordFromKey(key: ZeusChunkKey): ZeusChunkCoord {
  const [x, y] = key.split(":").map((value) => Number.parseInt(value, 10));
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Invalid Zeus chunk key: ${key}`);
  return { x, y };
}

export function zeusWorldToChunkCoord(position: { x: number; y: number }, chunkSize: number): ZeusChunkCoord {
  return {
    x: Math.floor(position.x / chunkSize),
    y: Math.floor(position.y / chunkSize),
  };
}

export function zeusChunkBounds(coord: ZeusChunkCoord, chunkSize: number): ZeusChunkRect {
  return {
    x: coord.x * chunkSize,
    y: coord.y * chunkSize,
    width: chunkSize,
    height: chunkSize,
  };
}

export function zeusActiveChunkKeys(options: ZeusActiveChunkOptions): ZeusChunkKey[] {
  const margin = options.margin ?? 0;
  const min = zeusWorldToChunkCoord({ x: options.viewport.x - margin, y: options.viewport.y - margin }, options.chunkSize);
  const max = zeusWorldToChunkCoord(
    {
      x: options.viewport.x + options.viewport.width + margin,
      y: options.viewport.y + options.viewport.height + margin,
    },
    options.chunkSize,
  );
  const keys: ZeusChunkKey[] = [];
  for (let y = min.y; y <= max.y; y += 1) {
    for (let x = min.x; x <= max.x; x += 1) keys.push(zeusChunkKey({ x, y }));
  }
  return keys;
}

export function zeusRectIntersectsChunk(rect: ZeusChunkRect, coord: ZeusChunkCoord, chunkSize: number) {
  const bounds = zeusChunkBounds(coord, chunkSize);
  return (
    rect.x < bounds.x + bounds.width &&
    rect.x + rect.width > bounds.x &&
    rect.y < bounds.y + bounds.height &&
    rect.y + rect.height > bounds.y
  );
}
