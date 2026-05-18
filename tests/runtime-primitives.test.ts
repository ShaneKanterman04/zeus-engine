import { describe, expect, it } from "vitest";
import { AssetManifestRegistry, validateAssetManifest } from "../packages/zeus-assets/src/AssetManifest";
import { FixedStepLoop } from "../packages/zeus-core/src/simulation/FixedStepLoop";
import { InputContext } from "../packages/zeus-input/src/InputContext";

describe("FixedStepLoop", () => {
  it("accumulates partial frames and advances fixed-size steps", () => {
    const loop = new FixedStepLoop({ stepSeconds: 0.25, maxFrameSeconds: 1 });
    const steps: number[] = [];

    expect(loop.advance(0.1, (dt) => steps.push(dt))).toBe(0);
    expect(loop.pendingSeconds).toBeCloseTo(0.1);
    expect(loop.advance(0.4, (dt) => steps.push(dt))).toBe(2);

    expect(steps).toEqual([0.25, 0.25]);
    expect(loop.pendingSeconds).toBeCloseTo(0);
  });

  it("clamps large frames and drops excess backlog at the step cap", () => {
    const loop = new FixedStepLoop({ stepSeconds: 0.1, maxFrameSeconds: 1, maxStepsPerFrame: 3 });
    const steps: number[] = [];

    expect(loop.advance(1, (dt) => steps.push(dt))).toBe(3);

    expect(steps).toEqual([0.1, 0.1, 0.1]);
    expect(loop.pendingSeconds).toBeLessThan(0.1);
  });

  it("resets pending accumulated time", () => {
    const loop = new FixedStepLoop({ stepSeconds: 0.25 });
    loop.advance(0.1, () => undefined);
    loop.reset();

    expect(loop.pendingSeconds).toBe(0);
  });
});

describe("InputContext", () => {
  it("tracks held actions and one-shot pressed state", () => {
    const input = new InputContext({ KeyF: "fire" });

    expect(input.keyDown("KeyF")).toBe(true);
    expect(input.state.actions.has("fire")).toBe(true);
    expect(input.consumePressed("fire")).toBe(true);
    expect(input.consumePressed("fire")).toBe(false);
    expect(input.keyDown("KeyF")).toBe(true);
    expect(input.consumePressed("fire")).toBe(false);
    expect(input.keyUp("KeyF")).toBe(true);
    expect(input.state.actions.has("fire")).toBe(false);
  });

  it("keeps an action held while any bound key remains down", () => {
    const input = new InputContext({ KeyA: "left", ArrowLeft: "left" });

    input.keyDown("KeyA");
    input.keyDown("ArrowLeft");
    input.keyUp("KeyA");

    expect(input.state.actions.has("left")).toBe(true);
    input.keyUp("ArrowLeft");
    expect(input.state.actions.has("left")).toBe(false);
  });

  it("clears input while captured and rebuilds held actions after rebinding", () => {
    const input = new InputContext({ KeyF: "fire", KeyE: "interact" });

    input.keyDown("KeyF");
    input.capture("ui");
    expect(input.isCaptured()).toBe(true);
    expect(input.state.actions.size).toBe(0);
    expect(input.keyDown("KeyE")).toBe(false);
    input.release("ui");
    input.keyDown("KeyF");
    input.setBinding("KeyF", "interact");

    expect(input.state.actions.has("fire")).toBe(false);
    expect(input.state.actions.has("interact")).toBe(true);
  });
});

describe("AssetManifestRegistry", () => {
  it("resolves assets and filters by tag", () => {
    const registry = new AssetManifestRegistry({
      version: 1,
      assets: [
        { id: "hero", src: "sprites/hero.png", kind: "image", tags: ["actors"] },
        { id: "theme", src: "audio/theme.ogg", kind: "audio", tags: ["music"] },
      ],
    });

    expect(registry.get("hero")).toMatchObject({ src: "sprites/hero.png" });
    expect(registry.resolve("hero", "/assets/")).toBe("/assets/sprites/hero.png");
    expect(registry.byTag("music")).toEqual([expect.objectContaining({ id: "theme" })]);
    expect(() => registry.get("missing")).toThrow(/Unknown asset/);
  });

  it("reports manifest validation errors", () => {
    const errors = validateAssetManifest({
      version: 0,
      assets: [
        { id: "duplicate", src: "a.png", kind: "image", width: 0 },
        { id: "duplicate", src: "", kind: "audio", height: -1 },
        { id: "", src: "missing-kind.bin", kind: undefined as never },
      ],
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        "Asset manifest version must be a positive integer",
        "Duplicate asset id: duplicate",
        "Asset 'duplicate' has invalid width",
        "Asset 'duplicate' missing src",
        "Asset 'duplicate' has invalid height",
        "Asset missing id",
        "Asset 'unknown' missing kind",
      ]),
    );
  });
});
