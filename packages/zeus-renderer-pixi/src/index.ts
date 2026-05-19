import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import { FixedStepLoop, ZeusFrameMetricsSampler } from "@zeus/core";
import type { Entity, FixedStepLoopOptions, Vec2, ZeusFrameMetricsSnapshot } from "@zeus/core";
import type { AssetManifestRegistry } from "@zeus/assets";
import type { AtlasFrame } from "./atlas/AtlasManifest.js";

export type ZeusPixiLayerName =
  | "ground"
  | "groundDetail"
  | "belowEntities"
  | "entities"
  | "aboveEntities"
  | "weather"
  | "lighting"
  | "worldPrompts"
  | "debug";

export type ZeusPixiSpriteOptions = {
  tint?: string;
  alpha?: number;
  rotation?: number;
  scale?: number | Vec2;
  offset?: Vec2;
  anchor?: Vec2;
  label?: string;
};

export type ZeusPixiCulledSpriteInstance = {
  id: string;
  frame: AtlasFrame;
  position: Vec2;
  radius?: number;
  ySort?: number;
  options?: ZeusPixiSpriteOptions;
};

export type ZeusPixiLayerStats = Record<ZeusPixiLayerName, number> & {
  total: number;
};

export type ZeusPixiStaticChunkOptions = {
  sort?: boolean;
  visible?: boolean;
};

export type ZeusPixiStaticChunkStats = {
  chunks: number;
  visibleChunks: number;
  children: number;
  visibleChildren: number;
};

export type AtlasFrameSequence = {
  id?: string;
  frames: readonly AtlasFrame[];
  frameDurationSeconds?: number;
  loop?: boolean;
};

export type ZeusPixiRuntimeScene = {
  update(dt: number): void;
  render(renderer: ZeusPixiRenderer, metrics: ZeusFrameMetricsSnapshot): void;
};

export type ZeusPixiRuntimeOptions = {
  width?: number;
  height?: number;
  background?: string;
  fixedStep?: FixedStepLoopOptions;
  metricsSamples?: number;
  frameSpikeMs?: number;
};

const layerNames: ZeusPixiLayerName[] = [
  "ground",
  "groundDetail",
  "belowEntities",
  "entities",
  "aboveEntities",
  "weather",
  "lighting",
  "worldPrompts",
  "debug",
];

export class ZeusPixiRenderer {
  readonly app = new Application();
  readonly stage = new Container();
  readonly layers = new Map<ZeusPixiLayerName, Container>();
  private readonly atlasTextures = new Map<string, Texture>();
  private readonly frameTextures = new Map<string, Texture>();
  private readonly spritePools = new Map<ZeusPixiLayerName, Sprite[]>();
  private readonly staticChunkContainers = new Map<ZeusPixiLayerName, Map<string, Container>>();
  private readonly staticChunkContainerSet = new WeakSet<Container>();
  private readonly culledSpriteScratch: ZeusPixiCulledSpriteInstance[] = [];
  camera: Vec2 = { x: 0, y: 0 };
  qualityMode: "standard" | "low" = "standard";

  async init(parent: HTMLElement, width = 1280, height = 720, background = "#1d211d") {
    await this.app.init({ width, height, background, antialias: false });
    parent.append(this.app.canvas);
    this.app.stage.addChild(this.stage);
    for (const name of layerNames) {
      const layer = new Container();
      this.layers.set(name, layer);
      this.stage.addChild(layer);
    }
  }

  setCamera(position: Vec2) {
    this.camera = position;
    this.stage.position.set(-position.x, -position.y);
  }

  renderDebugEntities(entities: Entity[]) {
    const layer = this.layers.get("debug");
    if (!layer) return;
    layer.removeChildren();
    for (const entity of entities) {
      const shape = new Graphics()
        .circle(entity.position.x, entity.position.y, entity.radius)
        .fill(entity.color ?? "#f4ead7");
      layer.addChild(shape);
    }
  }

  clearLayer(name: ZeusPixiLayerName) {
    const layer = this.layers.get(name);
    if (!layer) return;
    const removed = [];
    for (const child of [...layer.children]) {
      if (child instanceof Container && this.staticChunkContainerSet.has(child)) continue;
      layer.removeChild(child);
      removed.push(child);
    }
    let pool = this.spritePools.get(name);
    if (!pool) {
      pool = [];
      this.spritePools.set(name, pool);
    }
    for (const child of removed) {
      if (child instanceof Sprite) {
        child.visible = false;
        pool.push(child);
      }
    }
  }

  clearLayers(names: readonly ZeusPixiLayerName[]) {
    for (const name of names) {
      this.clearLayer(name);
    }
  }

  layerStats(): ZeusPixiLayerStats {
    const stats = Object.fromEntries(layerNames.map((name) => [name, this.layers.get(name)?.children.length ?? 0])) as Record<
      ZeusPixiLayerName,
      number
    >;
    return {
      ...stats,
      total: Object.values(stats).reduce((sum, count) => sum + count, 0),
    };
  }

  addGraphic(name: ZeusPixiLayerName, graphic: Graphics) {
    this.layers.get(name)?.addChild(graphic);
  }

  addText(name: ZeusPixiLayerName, text: Text) {
    this.layers.get(name)?.addChild(text);
  }

  addSprite(name: ZeusPixiLayerName, frame: AtlasFrame, position: Vec2, optionsOrTint: string | ZeusPixiSpriteOptions = "#ffffff") {
    const options = normalizeSpriteOptions(optionsOrTint);
    return this.addSpriteWithOptions(name, frame, position, options, options.label ?? frame.id);
  }

  private addSpriteWithOptions(name: ZeusPixiLayerName, frame: AtlasFrame, position: Vec2, options: ZeusPixiSpriteOptions | undefined, label: string) {
    const sprite = this.acquireSprite(name);
    this.configureSprite(sprite, frame, position, options, label);
    this.layers.get(name)?.addChild(sprite);
    return sprite;
  }

  addAnimatedSprite(
    name: ZeusPixiLayerName,
    sequence: AtlasFrameSequence,
    position: Vec2,
    elapsedSeconds: number,
    optionsOrTint: string | ZeusPixiSpriteOptions = "#ffffff",
  ) {
    const frame = resolveAtlasFrameSequence(sequence, elapsedSeconds);
    if (!frame) return undefined;
    return this.addSprite(name, frame, position, optionsOrTint);
  }

  addCulledSprites(
    name: ZeusPixiLayerName,
    instances: readonly ZeusPixiCulledSpriteInstance[],
    viewport: { x: number; y: number; width: number; height: number },
    margin = 160,
  ) {
    const visible = this.culledSpriteScratch;
    visible.length = 0;
    for (const instance of instances) {
      if (spriteInViewport(instance, viewport, margin)) visible.push(instance);
    }
    visible.sort((a, b) => (a.ySort ?? a.position.y) - (b.ySort ?? b.position.y));
    for (const instance of visible) {
      this.addSpriteWithOptions(name, instance.frame, instance.position, instance.options, instance.id);
    }
    const visibleCount = visible.length;
    visible.length = 0;
    return visibleCount;
  }

  addVisibleSprites(name: ZeusPixiLayerName, instances: readonly ZeusPixiCulledSpriteInstance[], sort = true) {
    if (sort) {
      const visible = this.culledSpriteScratch;
      visible.length = 0;
      for (const instance of instances) visible.push(instance);
      visible.sort((a, b) => (a.ySort ?? a.position.y) - (b.ySort ?? b.position.y));
      for (const instance of visible) {
        this.addSpriteWithOptions(name, instance.frame, instance.position, instance.options, instance.id);
      }
      const visibleCount = visible.length;
      visible.length = 0;
      return visibleCount;
    }
    for (const instance of instances) {
      this.addSpriteWithOptions(name, instance.frame, instance.position, instance.options, instance.id);
    }
    return instances.length;
  }

  setStaticChunkSprites(
    name: ZeusPixiLayerName,
    chunkKey: string,
    instances: readonly ZeusPixiCulledSpriteInstance[],
    options: ZeusPixiStaticChunkOptions = {},
  ) {
    const container = this.staticChunkContainer(name, chunkKey);
    this.destroyContainerChildren(container);
    const addInstance = (instance: ZeusPixiCulledSpriteInstance) => {
      const sprite = new Sprite(Texture.WHITE);
      this.configureSprite(sprite, instance.frame, instance.position, instance.options, instance.id);
      container.addChild(sprite);
    };
    if (options.sort ?? true) {
      const visible = this.culledSpriteScratch;
      visible.length = 0;
      for (const instance of instances) visible.push(instance);
      visible.sort((a, b) => (a.ySort ?? a.position.y) - (b.ySort ?? b.position.y));
      for (const instance of visible) addInstance(instance);
      visible.length = 0;
    } else {
      for (const instance of instances) addInstance(instance);
    }
    container.visible = options.visible ?? true;
    return container.children.length;
  }

  setVisibleStaticChunks(name: ZeusPixiLayerName, activeKeys: Iterable<string>) {
    const chunks = this.staticChunkContainers.get(name);
    if (!chunks) return this.staticChunkStats(name);
    const active = new Set(activeKeys);
    for (const [key, container] of chunks) {
      container.visible = active.has(key);
    }
    return this.staticChunkStats(name);
  }

  invalidateStaticChunk(name: ZeusPixiLayerName, chunkKey: string) {
    const chunks = this.staticChunkContainers.get(name);
    const container = chunks?.get(chunkKey);
    if (!chunks || !container) return false;
    chunks.delete(chunkKey);
    this.staticChunkContainerSet.delete(container);
    container.removeFromParent();
    this.destroyContainerChildren(container);
    container.destroy();
    return true;
  }

  clearStaticChunks(name?: ZeusPixiLayerName) {
    const names = name ? [name] : [...this.staticChunkContainers.keys()];
    for (const layerName of names) {
      const chunks = this.staticChunkContainers.get(layerName);
      if (!chunks) continue;
      for (const key of [...chunks.keys()]) {
        this.invalidateStaticChunk(layerName, key);
      }
      this.staticChunkContainers.delete(layerName);
    }
  }

  staticChunkStats(name?: ZeusPixiLayerName): ZeusPixiStaticChunkStats {
    const stats: ZeusPixiStaticChunkStats = { chunks: 0, visibleChunks: 0, children: 0, visibleChildren: 0 };
    const chunkMaps = name ? [this.staticChunkContainers.get(name)] : [...this.staticChunkContainers.values()];
    for (const chunks of chunkMaps) {
      if (!chunks) continue;
      for (const container of chunks.values()) {
        const childCount = container.children.length;
        stats.chunks += 1;
        stats.children += childCount;
        if (container.visible) {
          stats.visibleChunks += 1;
          stats.visibleChildren += childCount;
        }
      }
    }
    return stats;
  }

  async loadAtlasTextures(assets: AssetManifestRegistry, atlasIds: string[], basePath = "") {
    for (const atlasId of atlasIds) {
      const source = assets.resolve(atlasId, basePath);
      const texture = await Assets.load<Texture>(source);
      texture.label = atlasId;
      this.atlasTextures.set(atlasId, texture);
    }
  }

  hasLoadedFrameTexture(frameId: string) {
    return this.frameTextures.has(frameId);
  }

  private textureForFrame(frame: AtlasFrame) {
    const cached = this.frameTextures.get(frame.id);
    if (cached) return cached;
    const atlasTexture = this.atlasTextures.get(frame.atlas);
    if (!atlasTexture) return Texture.WHITE;
    const texture = new Texture({
      source: atlasTexture.source,
      frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
      label: frame.id,
    });
    this.frameTextures.set(frame.id, texture);
    return texture;
  }

  private configureSprite(
    sprite: Sprite,
    frame: AtlasFrame,
    position: Vec2,
    options: ZeusPixiSpriteOptions | undefined,
    label: string,
  ) {
    const scale = normalizeSpriteScale(options?.scale);
    sprite.texture = this.textureForFrame(frame);
    sprite.label = label;
    sprite.tint = options?.tint ?? "#ffffff";
    sprite.alpha = options?.alpha ?? 1;
    sprite.rotation = options?.rotation ?? 0;
    sprite.width = frame.width * scale.x;
    sprite.height = frame.height * scale.y;
    sprite.anchor.set(options?.anchor?.x ?? frame.anchor?.x ?? 0.5, options?.anchor?.y ?? frame.anchor?.y ?? 0.5);
    sprite.position.set(position.x + (options?.offset?.x ?? 0), position.y + (options?.offset?.y ?? 0));
    sprite.visible = true;
  }

  private acquireSprite(name: ZeusPixiLayerName) {
    const sprite = this.spritePools.get(name)?.pop();
    return sprite ?? new Sprite(Texture.WHITE);
  }

  private staticChunkContainer(name: ZeusPixiLayerName, chunkKey: string) {
    let chunks = this.staticChunkContainers.get(name);
    if (!chunks) {
      chunks = new Map();
      this.staticChunkContainers.set(name, chunks);
    }
    const existing = chunks.get(chunkKey);
    if (existing) return existing;
    const container = new Container();
    container.label = `static:${name}:${chunkKey}`;
    chunks.set(chunkKey, container);
    this.staticChunkContainerSet.add(container);
    this.layers.get(name)?.addChild(container);
    return container;
  }

  private destroyContainerChildren(container: Container) {
    const removed = container.removeChildren();
    for (const child of removed) {
      child.destroy();
    }
  }

  resizeToWindow(width = 1280, height = 720) {
    const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
    this.app.canvas.style.width = `${Math.floor(width * scale)}px`;
    this.app.canvas.style.height = `${Math.floor(height * scale)}px`;
  }

  setQualityMode(mode: "standard" | "low") {
    this.qualityMode = mode;
    this.app.ticker.maxFPS = mode === "low" ? 30 : 0;
  }
}

export class ZeusPixiCulledSpriteLayer {
  private visibleCount = 0;

  constructor(
    private readonly renderer: ZeusPixiRenderer,
    private readonly layer: ZeusPixiLayerName,
    private readonly margin = 160,
  ) {}

  render(instances: readonly ZeusPixiCulledSpriteInstance[], viewport: { x: number; y: number; width: number; height: number }) {
    this.renderer.clearLayer(this.layer);
    this.visibleCount = this.renderer.addCulledSprites(this.layer, instances, viewport, this.margin);
    return this.visibleCount;
  }

  stats() {
    return { visible: this.visibleCount };
  }
}

export type ZeusPixiChunkLayerStats = {
  activeChunks: number;
  children: number;
};

export class ZeusPixiChunkLayer {
  private readonly chunks = new Map<string, Container>();

  constructor(
    private readonly renderer: ZeusPixiRenderer,
    private readonly layer: ZeusPixiLayerName,
  ) {}

  sync(activeKeys: readonly string[]) {
    const active = new Set(activeKeys);
    for (const [key, container] of this.chunks) {
      if (active.has(key)) continue;
      container.removeFromParent();
      container.destroy({ children: true });
      this.chunks.delete(key);
    }
    for (const key of activeKeys) this.containerFor(key);
    return this.stats();
  }

  containerFor(key: string) {
    const existing = this.chunks.get(key);
    if (existing) return existing;
    const container = new Container();
    container.label = `chunk:${key}`;
    this.chunks.set(key, container);
    this.renderer.layers.get(this.layer)?.addChild(container);
    return container;
  }

  clearChunk(key: string) {
    this.containerFor(key).removeChildren();
  }

  clear() {
    for (const container of this.chunks.values()) {
      container.removeFromParent();
      container.destroy({ children: true });
    }
    this.chunks.clear();
  }

  stats(): ZeusPixiChunkLayerStats {
    return {
      activeChunks: this.chunks.size,
      children: [...this.chunks.values()].reduce((sum, chunk) => sum + chunk.children.length, 0),
    };
  }
}

function spriteInViewport(
  instance: ZeusPixiCulledSpriteInstance,
  viewport: { x: number; y: number; width: number; height: number },
  margin: number,
) {
  const radius = instance.radius ?? Math.max(instance.frame.width, instance.frame.height) / 2;
  return (
    instance.position.x + radius >= viewport.x - margin &&
    instance.position.x - radius <= viewport.x + viewport.width + margin &&
    instance.position.y + radius >= viewport.y - margin &&
    instance.position.y - radius <= viewport.y + viewport.height + margin
  );
}

export class ZeusPixiRuntime {
  readonly renderer = new ZeusPixiRenderer();
  readonly metrics: ZeusFrameMetricsSampler;
  private readonly loop: FixedStepLoop;
  private ticker?: (ticker: { deltaMS: number }) => void;
  private started = false;
  private readonly width: number;
  private readonly height: number;
  private readonly background: string;

  constructor(
    private readonly scene: ZeusPixiRuntimeScene,
    options: ZeusPixiRuntimeOptions = {},
  ) {
    this.width = options.width ?? 1280;
    this.height = options.height ?? 720;
    this.background = options.background ?? "#1d211d";
    this.loop = new FixedStepLoop(options.fixedStep);
    this.metrics = new ZeusFrameMetricsSampler({
      maxSamples: options.metricsSamples,
      spikeMs: options.frameSpikeMs,
    });
  }

  async init(parent: HTMLElement) {
    await this.renderer.init(parent, this.width, this.height, this.background);
    this.renderer.resizeToWindow(this.width, this.height);
    window.addEventListener("resize", this.resize);
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.ticker = (ticker) => this.tick(ticker.deltaMS / 1000);
    this.renderer.app.ticker.add(this.ticker);
  }

  stop() {
    if (!this.started || !this.ticker) return;
    this.renderer.app.ticker.remove(this.ticker);
    this.started = false;
    this.ticker = undefined;
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this.resize);
    this.renderer.app.destroy();
  }

  tick(frameSeconds: number) {
    const frameMs = Math.max(0, frameSeconds * 1000);
    const simStart = performance.now();
    const simSteps = this.loop.advance(frameSeconds, (stepSeconds) => this.scene.update(stepSeconds));
    const simMs = performance.now() - simStart;
    const renderStart = performance.now();
    this.scene.render(this.renderer, this.metrics.snapshot());
    const renderMs = performance.now() - renderStart;
    return this.metrics.record({ frameMs, simMs, renderMs, simSteps });
  }

  setQualityMode(mode: "standard" | "low") {
    this.renderer.setQualityMode(mode);
  }

  private readonly resize = () => {
    this.renderer.resizeToWindow(this.width, this.height);
  };
}

export function resolveAtlasFrameSequence(sequence: AtlasFrameSequence, elapsedSeconds: number) {
  if (sequence.frames.length === 0) return undefined;
  const frameDuration = Math.max(0.001, sequence.frameDurationSeconds ?? 1 / 12);
  const elapsed = Math.max(0, elapsedSeconds);
  const rawIndex = Math.floor(elapsed / frameDuration);
  const index = sequence.loop === false ? Math.min(rawIndex, sequence.frames.length - 1) : rawIndex % sequence.frames.length;
  return sequence.frames[index];
}

function normalizeSpriteOptions(optionsOrTint: string | ZeusPixiSpriteOptions): ZeusPixiSpriteOptions {
  if (typeof optionsOrTint === "string") return { tint: optionsOrTint };
  return optionsOrTint;
}

function normalizeSpriteScale(scale: number | Vec2 | undefined): Vec2 {
  if (typeof scale === "number") return { x: scale, y: scale };
  return scale ?? { x: 1, y: 1 };
}

export { AtlasFrameRegistry, validateAtlasManifest } from "./atlas/AtlasManifest.js";
export type { AtlasFrame, AtlasManifest } from "./atlas/AtlasManifest.js";
export { createPixiLightingGraphics } from "./lighting/PixiLighting.js";
export type { PixiLightingOptions } from "./lighting/PixiLighting.js";
export { createPixiCreekGraphics, createPixiLakeGraphics } from "./waterways/CreekPainter.js";
export type { PixiCreekStyle, PixiLakeStyle, PixiWaterBody, PixiWaterway } from "./waterways/CreekPainter.js";
