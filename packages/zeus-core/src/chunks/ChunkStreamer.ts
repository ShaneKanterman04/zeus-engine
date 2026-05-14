import { zeusActiveChunkKeys, type ZeusActiveChunkOptions, type ZeusChunkKey } from "./ChunkGrid.js";

export type ZeusChunkProvider<TChunk> = (key: ZeusChunkKey) => TChunk | Promise<TChunk | undefined> | undefined;

export type ZeusChunkStreamerOptions<TChunk> = {
  provider: ZeusChunkProvider<TChunk>;
  cacheLimit?: number;
};

export type ZeusChunkStreamerState<TChunk> = {
  active: ReadonlyMap<ZeusChunkKey, TChunk>;
  loading: ReadonlySet<ZeusChunkKey>;
  failed: ReadonlyMap<ZeusChunkKey, Error>;
  entering: ReadonlySet<ZeusChunkKey>;
  exiting: ReadonlySet<ZeusChunkKey>;
};

export class ZeusChunkStreamer<TChunk> {
  private readonly active = new Map<ZeusChunkKey, TChunk>();
  private readonly cache = new Map<ZeusChunkKey, TChunk>();
  private readonly loading = new Map<ZeusChunkKey, Promise<void>>();
  private readonly failed = new Map<ZeusChunkKey, Error>();
  private entering = new Set<ZeusChunkKey>();
  private exiting = new Set<ZeusChunkKey>();

  constructor(private readonly options: ZeusChunkStreamerOptions<TChunk>) {}

  updateActiveKeys(keys: readonly ZeusChunkKey[]) {
    const next = new Set(keys);
    this.entering = new Set();
    this.exiting = new Set();

    for (const key of this.active.keys()) {
      if (!next.has(key)) {
        const chunk = this.active.get(key);
        if (chunk) this.cache.set(key, chunk);
        this.active.delete(key);
        this.exiting.add(key);
      }
    }

    for (const key of next) {
      if (this.active.has(key)) continue;
      this.entering.add(key);
      const cached = this.cache.get(key);
      if (cached) {
        this.active.set(key, cached);
        this.cache.delete(key);
        continue;
      }
      this.load(key);
    }

    this.trimCache(next);
    return this.snapshot();
  }

  updateViewport(options: ZeusActiveChunkOptions) {
    return this.updateActiveKeys(zeusActiveChunkKeys(options));
  }

  snapshot(): ZeusChunkStreamerState<TChunk> {
    return {
      active: this.active,
      loading: new Set(this.loading.keys()),
      failed: this.failed,
      entering: this.entering,
      exiting: this.exiting,
    };
  }

  clear() {
    this.active.clear();
    this.cache.clear();
    this.loading.clear();
    this.failed.clear();
    this.entering.clear();
    this.exiting.clear();
  }

  private load(key: ZeusChunkKey) {
    if (this.loading.has(key)) return;
    this.failed.delete(key);
    const loaded = this.options.provider(key);
    if (isPromiseLike(loaded)) {
      const promise = loaded
        .then((chunk) => {
          if (chunk) this.active.set(key, chunk);
        })
        .catch((error: unknown) => {
          this.failed.set(key, error instanceof Error ? error : new Error(String(error)));
        })
        .finally(() => {
          this.loading.delete(key);
        });
      this.loading.set(key, promise);
      return;
    }
    if (loaded) this.active.set(key, loaded);
  }

  private trimCache(activeKeys: ReadonlySet<ZeusChunkKey>) {
    const limit = this.options.cacheLimit ?? 64;
    for (const key of activeKeys) this.cache.delete(key);
    while (this.cache.size > limit) {
      const oldest = this.cache.keys().next().value;
      if (!oldest) break;
      this.cache.delete(oldest);
    }
  }
}

function isPromiseLike<T>(value: T | Promise<T> | undefined): value is Promise<T> {
  return Boolean(value && typeof (value as Promise<T>).then === "function");
}
