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
    const removed = layer.removeChildren();
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

  addGraphic(name: ZeusPixiLayerName, graphic: Graphics) {
    this.layers.get(name)?.addChild(graphic);
  }

  addText(name: ZeusPixiLayerName, text: Text) {
    this.layers.get(name)?.addChild(text);
  }

  addSprite(name: ZeusPixiLayerName, frame: AtlasFrame, position: Vec2, optionsOrTint: string | ZeusPixiSpriteOptions = "#ffffff") {
    const options = normalizeSpriteOptions(optionsOrTint);
    const scale = normalizeSpriteScale(options.scale);
    const sprite = this.acquireSprite(name);
    sprite.texture = this.textureForFrame(frame);
    sprite.label = options.label ?? frame.id;
    sprite.tint = options.tint ?? "#ffffff";
    sprite.alpha = options.alpha ?? 1;
    sprite.rotation = options.rotation ?? 0;
    sprite.width = frame.width * scale.x;
    sprite.height = frame.height * scale.y;
    sprite.anchor.set(options.anchor?.x ?? frame.anchor?.x ?? 0.5, options.anchor?.y ?? frame.anchor?.y ?? 0.5);
    sprite.position.set(position.x + (options.offset?.x ?? 0), position.y + (options.offset?.y ?? 0));
    sprite.visible = true;
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

  private acquireSprite(name: ZeusPixiLayerName) {
    const sprite = this.spritePools.get(name)?.pop();
    return sprite ?? new Sprite(Texture.WHITE);
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
export { createPixiCreekGraphics } from "./waterways/CreekPainter.js";
export type { PixiCreekStyle, PixiWaterway } from "./waterways/CreekPainter.js";
