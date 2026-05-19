import { describe, expect, it } from "vitest";
import { Container, Sprite } from "pixi.js";
import { ZeusPixiRenderer, type AtlasFrame, type ZeusPixiLayerName } from "../packages/zeus-renderer-pixi/src";

const frame: AtlasFrame = {
  id: "test.frame",
  atlas: "missing",
  x: 0,
  y: 0,
  width: 8,
  height: 8,
};

describe("ZeusPixiRenderer static chunks", () => {
  it("keeps retained static chunks when clearing dynamic layer children", () => {
    const renderer = rendererWithLayer("groundDetail");

    expect(
      renderer.setStaticChunkSprites("groundDetail", "0,0", [
        { id: "sprite.a", frame, position: { x: 16, y: 12 }, ySort: 12 },
        { id: "sprite.b", frame, position: { x: 8, y: 4 }, ySort: 4 },
      ]),
    ).toBe(2);
    renderer.addSprite("groundDetail", frame, { x: 24, y: 20 });

    const layer = renderer.layers.get("groundDetail");
    expect(layer?.children).toHaveLength(2);

    renderer.clearLayer("groundDetail");

    expect(layer?.children).toHaveLength(1);
    expect(layer?.children[0]).toBeInstanceOf(Container);
    expect(renderer.staticChunkStats("groundDetail")).toEqual({
      chunks: 1,
      visibleChunks: 1,
      children: 2,
      visibleChildren: 2,
    });
  });

  it("tracks visible chunks separately from total retained chunk contents", () => {
    const renderer = rendererWithLayer("groundDetail");
    renderer.setStaticChunkSprites("groundDetail", "0,0", [{ id: "sprite.a", frame, position: { x: 16, y: 12 } }]);
    renderer.setStaticChunkSprites("groundDetail", "1,0", [{ id: "sprite.b", frame, position: { x: 32, y: 12 } }]);

    const stats = renderer.setVisibleStaticChunks("groundDetail", ["1,0"]);

    expect(stats).toEqual({
      chunks: 2,
      visibleChunks: 1,
      children: 2,
      visibleChildren: 1,
    });
  });

  it("invalidates static chunks without returning their sprites to the dynamic sprite pool", () => {
    const renderer = rendererWithLayer("groundDetail");
    renderer.setStaticChunkSprites("groundDetail", "0,0", [{ id: "sprite.a", frame, position: { x: 16, y: 12 } }]);

    expect(renderer.invalidateStaticChunk("groundDetail", "0,0")).toBe(true);
    renderer.addSprite("groundDetail", frame, { x: 24, y: 20 });

    const child = renderer.layers.get("groundDetail")?.children[0];
    expect(child).toBeInstanceOf(Sprite);
    expect(child?.label).toBe("test.frame");
  });
});

function rendererWithLayer(name: ZeusPixiLayerName) {
  const renderer = new ZeusPixiRenderer();
  renderer.layers.set(name, new Container());
  return renderer;
}
