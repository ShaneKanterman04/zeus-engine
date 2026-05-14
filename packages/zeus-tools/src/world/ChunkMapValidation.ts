export type ZeusChunkMapValidationChunk = {
  key: string;
  x: number;
  y: number;
  bounds: { x: number; y: number; width: number; height: number };
};

export type ZeusChunkMapValidationOptions = {
  bounds: { width: number; height: number };
  chunkSize: number;
  chunks: readonly ZeusChunkMapValidationChunk[];
};

export function validateChunkMap(options: ZeusChunkMapValidationOptions) {
  const errors: string[] = [];
  if (!Number.isFinite(options.chunkSize) || options.chunkSize <= 0) errors.push("chunkSize must be positive");
  const expectedWidth = Math.ceil(options.bounds.width / options.chunkSize);
  const expectedHeight = Math.ceil(options.bounds.height / options.chunkSize);
  const expectedCount = expectedWidth * expectedHeight;
  if (options.chunks.length !== expectedCount) errors.push(`expected ${expectedCount} chunks, found ${options.chunks.length}`);

  const keys = new Set<string>();
  for (const chunk of options.chunks) {
    const expectedKey = `${chunk.x}:${chunk.y}`;
    if (chunk.key !== expectedKey) errors.push(`chunk '${chunk.key}' should be keyed '${expectedKey}'`);
    if (keys.has(chunk.key)) errors.push(`duplicate chunk '${chunk.key}'`);
    keys.add(chunk.key);
    if (
      chunk.bounds.x !== chunk.x * options.chunkSize ||
      chunk.bounds.y !== chunk.y * options.chunkSize ||
      chunk.bounds.width !== options.chunkSize ||
      chunk.bounds.height !== options.chunkSize
    ) {
      errors.push(`chunk '${chunk.key}' bounds do not match chunkSize`);
    }
  }

  for (let y = 0; y < expectedHeight; y += 1) {
    for (let x = 0; x < expectedWidth; x += 1) {
      const key = `${x}:${y}`;
      if (!keys.has(key)) errors.push(`missing chunk '${key}'`);
    }
  }

  return { ok: errors.length === 0, errors };
}
