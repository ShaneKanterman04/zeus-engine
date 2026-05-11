import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import type { Entity, Vec2 } from "@zeus/core";
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
  camera: Vec2 = { x: 0, y: 0 };
  qualityMode: "standard" | "low" = "standard";

  async init(parent: HTMLElement, width = 1280, height = 720) {
    await this.app.init({ width, height, background: "#1d211d", antialias: false });
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
    this.layers.get(name)?.removeChildren();
  }

  addGraphic(name: ZeusPixiLayerName, graphic: Graphics) {
    this.layers.get(name)?.addChild(graphic);
  }

  addText(name: ZeusPixiLayerName, text: Text) {
    this.layers.get(name)?.addChild(text);
  }

  addSprite(name: ZeusPixiLayerName, frame: AtlasFrame, position: Vec2, tint = "#ffffff") {
    const sprite = new Sprite(this.textureForFrame(frame));
    sprite.label = frame.id;
    sprite.tint = tint;
    sprite.width = frame.width;
    sprite.height = frame.height;
    sprite.anchor.set(0.5);
    sprite.position.set(position.x, position.y);
    this.layers.get(name)?.addChild(sprite);
    return sprite;
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

export { AtlasFrameRegistry, validateAtlasManifest } from "./atlas/AtlasManifest.js";
export type { AtlasFrame, AtlasManifest } from "./atlas/AtlasManifest.js";
