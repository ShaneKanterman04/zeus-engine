import { describe, expect, it } from "vitest";
import { AssetManifestRegistry, validateAssetManifest } from "../packages/zeus-assets/src/AssetManifest";
import { ComponentStore } from "../packages/zeus-core/src/ecs/ComponentStore";
import { zeusEntitiesWithinRadius, zeusNearestEntity } from "../packages/zeus-core/src/entityQueries";
import { zeusLineOfSight, zeusSegmentIntersectsCircle, zeusSegmentIntersectsRect, zeusSegmentsIntersect } from "../packages/zeus-core/src/lineOfSight";
import { FixedStepLoop } from "../packages/zeus-core/src/simulation/FixedStepLoop";
import { zeusRaycastCircles } from "../packages/zeus-core/src/projectiles";
import type { Entity } from "../packages/zeus-core/src/types";
import { InputContext } from "../packages/zeus-input/src/InputContext";
import { applyInputSnapshot, copyInputState, createInputSnapshot } from "../packages/zeus-input/src/InputSnapshot";

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

  it("creates serializable snapshots and can consume one-shot pressed input", () => {
    const input = new InputContext({ KeyF: "fire" });
    input.keyDown("KeyF");
    input.pointerMove({ x: 12, y: 24 });

    const snapshot = createInputSnapshot(input.state, { consumePressed: true });

    expect(snapshot).toEqual({ actions: ["fire"], pressed: ["fire"], pointer: { x: 12, y: 24 } });
    expect(input.state.pressed.size).toBe(0);
  });

  it("applies input snapshots and derives pressed actions for legacy intents", () => {
    const input = new InputContext();
    input.state.actions.add("left");

    applyInputSnapshot({ actions: ["left", "fire"], pressed: [], pointer: { x: 3, y: 4 } }, input.state, { derivePressed: true });

    expect([...input.state.actions]).toEqual(["left", "fire"]);
    expect([...input.state.pressed]).toEqual(["fire"]);
    expect(input.state.pointer).toEqual({ x: 3, y: 4 });
  });

  it("copies input state without sharing pointer references", () => {
    const source = new InputContext();
    const target = new InputContext();
    source.state.actions.add("up");
    source.state.pressed.add("interact");
    source.pointerMove({ x: 7, y: 9 });

    copyInputState(source.state, target.state);
    source.pointerMove({ x: 1, y: 2 });

    expect([...target.state.actions]).toEqual(["up"]);
    expect([...target.state.pressed]).toEqual(["interact"]);
    expect(target.state.pointer).toEqual({ x: 7, y: 9 });
  });
});

describe("ComponentStore", () => {
  it("keeps cloned component access by default and exposes borrowed hot-path views", () => {
    const store = new ComponentStore<{ position: { x: number; y: number } }>();
    const component = { position: { x: 1, y: 2 } };
    store.set("player", component);
    component.position.x = 99;
    expect(store.get("player")).toEqual({ position: { x: 1, y: 2 } });

    const borrowed = { position: { x: 3, y: 4 } };
    store.setBorrowed("light", borrowed);
    expect(store.getBorrowed("light")).toBe(borrowed);
    expect(store.borrowedEntries().get("light")).toBe(borrowed);
    expect(store.entries().get("light")).toEqual({ position: { x: 3, y: 4 } });
  });
});

describe("projectile raycasts", () => {
  it("returns the nearest circle hit on the aim segment", () => {
    const hit = zeusRaycastCircles(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      [
        { id: "far", position: { x: 80, y: 0 }, radius: 10 },
        { id: "near", position: { x: 40, y: 0 }, radius: 10 },
      ],
    );

    expect(hit?.item.id).toBe("near");
    expect(hit?.distance).toBeCloseTo(30);
    expect(hit?.point).toEqual({ x: 30, y: 0 });
  });

  it("ignores circles containing the shooter when requested", () => {
    const hit = zeusRaycastCircles(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      [
        { id: "origin-cover", position: { x: 0, y: 0 }, radius: 20 },
        { id: "target", position: { x: 60, y: 0 }, radius: 8 },
      ],
      { ignoreContainingOrigin: true },
    );

    expect(hit?.item.id).toBe("target");
  });
});

describe("entity query helpers", () => {
  const entities: Entity[] = [
    { id: "player", kind: "player", position: { x: 0, y: 0 }, radius: 8 },
    { id: "deer", kind: "animal", position: { x: 20, y: 0 }, radius: 6 },
    { id: "wolf", kind: "animal", position: { x: 50, y: 0 }, radius: 10, solid: true },
  ];

  it("returns entities within a radius and can sort nearest first", () => {
    const results = zeusEntitiesWithinRadius(entities, { x: 12, y: 0 }, 20, { sort: "nearest" });

    expect(results.map((result) => result.entity.id)).toEqual(["deer", "player"]);
    expect(results.map((result) => result.distance)).toEqual([8, 12]);
  });

  it("supports predicates and solid radius distance", () => {
    const results = zeusEntitiesWithinRadius(entities, { x: 41, y: 0 }, 2, {
      includeSolidRadius: true,
      predicate: (entity) => entity.solid === true,
    });

    expect(results).toEqual([{ entity: entities[2], distance: 0 }]);
  });

  it("finds the nearest matching entity within an optional max distance", () => {
    expect(zeusNearestEntity(entities, { x: 30, y: 0 }, { predicate: (entity) => entity.kind === "animal" })?.entity.id).toBe("deer");
    expect(zeusNearestEntity(entities, { x: 80, y: 0 }, { maxDistance: 10 })).toBeUndefined();
  });
});

describe("line-of-sight geometry", () => {
  it("detects segment intersections", () => {
    expect(zeusSegmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
    expect(zeusSegmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false);
  });

  it("detects circle and rect blockers along a segment", () => {
    expect(zeusSegmentIntersectsCircle({ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 4 }, 5)).toBe(true);
    expect(zeusSegmentIntersectsCircle({ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 8 }, 5)).toBe(false);
    expect(zeusSegmentIntersectsRect({ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 8, y: -2, width: 4, height: 4 })).toBe(true);
    expect(zeusSegmentIntersectsRect({ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 8, y: 3, width: 4, height: 4 })).toBe(false);
  });

  it("returns the first line-of-sight blocker", () => {
    const result = zeusLineOfSight({ x: 0, y: 0 }, { x: 20, y: 0 }, [
      { kind: "rect", id: "wall", bounds: { x: 5, y: -1, width: 2, height: 2 } },
      { kind: "circle", id: "tree", center: { x: 10, y: 0 }, radius: 2 },
    ]);

    expect(result.blocked).toBe(true);
    expect(result.blocker?.id).toBe("wall");
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
