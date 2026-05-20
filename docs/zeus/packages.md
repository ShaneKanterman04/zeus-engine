# Zeus Package Reference

Version: 0.1
Date: 2026-05-20
Status: Current public workspace exports

## Purpose

This file summarizes the current package-level API surface exposed through `packages/*/src/index.ts` and package `exports`. It is not a design roadmap; planned APIs belong in `engine-plan.md` or `tooling-plan.md`.

## Import Rule

Game projects should import from package names:

```ts
import { FixedStepLoop } from "@zeus/core";
import { ZeusPixiRenderer } from "@zeus/renderer-pixi";
```

Do not import into Zeus package source paths from a game repo.

## `@zeus/core`

Core runtime, simulation, world math, entity helpers, chunks, world layers, and geometry.

Main exports:

- App/runtime: `ZeusApp`, `ZeusRenderableScene`, `ZeusAppOptions`.
- World/entity primitives: `ZeusWorld`, `Entity`, `EntityId`, `Vec2`, `InputState`, `ZeusScene`, `ZeusSystem`.
- Simulation: `FixedStepLoop`, `SystemRunner`, `SceneManager`, `ZeusFrameMetricsSampler`, `createEmptyFrameMetricsSnapshot`.
- ECS: `ComponentStore`, `ComponentMap`.
- Math and movement: `clamp`, `distance`, `moveToward`, `distanceToSegment`, `distanceToPolyline`, `polylineLength`, `samplePolyline`.
- Projectiles and sight: `zeusRaycastCircle`, `zeusRaycastCircles`, `zeusLineOfSight`, segment/circle/rect intersection helpers.
- Entity queries: `zeusEntitiesWithinRadius`, `zeusEntityDistanceFromPoint`, `zeusNearestEntity`.
- Spatial and chunks: `ZeusSpatialHashGrid`, `ZeusChunkStreamer`, chunk key/bounds/active-key helpers.
- World layers: region blend helpers, rectangle helpers, `ZeusWorldLayerIndex`, world-layer manifest types.
- Lighting: `resolveEntityLightSources` and light source types.

## `@zeus/renderer-pixi`

PixiJS 8 renderer integration for layered 2D scenes, atlas sprites, culling, static chunks, lighting, waterways, and runtime loop glue.

Main exports:

- Renderer/runtime: `ZeusPixiRenderer`, `ZeusPixiRuntime`, `ZeusPixiRuntimeScene`, `ZeusPixiRuntimeOptions`.
- Layers and sprites: `ZeusPixiLayerName`, `ZeusPixiSpriteOptions`, `ZeusPixiCulledSpriteLayer`, `ZeusPixiCulledSpriteInstance`.
- Static chunks: `ZeusPixiChunkLayer`, `ZeusPixiStaticChunkOptions`, `ZeusPixiStaticChunkStats`, `ZeusPixiChunkLayerStats`.
- Atlas support: `AtlasFrameRegistry`, `validateAtlasManifest`, `AtlasFrame`, `AtlasManifest`, `AtlasFrameSequence`, `resolveAtlasFrameSequence`.
- Effects/helpers: `createPixiLightingGraphics`, `createPixiCreekGraphics`, `createPixiLakeGraphics`.

`pixi.js` is a peer dependency.

## `@zeus/input`

Input binding, layer capture, and serializable snapshots.

Main exports:

- `ZeusInput`
- `InputContext`, `createInputSettings`, `defaultBindings`
- `createInputSnapshot`, `applyInputSnapshot`, `copyInputState`
- `InputBindings`, `InputLayer`, `InputSettings`, `ZeusInputSnapshot`

## `@zeus/assets`

Runtime asset manifest and provenance validation helpers.

Main exports:

- `AssetManifestRegistry`, `validateAssetManifest`
- `runtimeAssetPath`, `expectedRuntimeSignature`
- `validateAssetMetadata`
- `ZeusAssetEntry`, `ZeusAssetKind`, `ZeusAssetManifest`
- `AssetMetadataEntry`, `AssetMetadataManifest`, `AssetProvenance`, `AssetReviewStatus`

## `@zeus/audio`

Browser audio service and bus-level volume helpers.

Main exports:

- `ZeusAudioService`
- `ZeusAudioBus`

Current buses are `master`, `music`, `ambience`, `sfx`, and `ui`.

## `@zeus/ai`

Small deterministic AI helpers for signal scoring, threat stages, steering, weighted random selection, and roaming.

Main exports:

- Signals: `ZeusAiSignal`, `ageAiSignals`, `scoreSignalAtPoint`, `scoreSignalsAtPoint`.
- Threat: `advanceThreatMeter`, `classifyThreatStage`, `defaultThreatStageThresholds`, threat types.
- Steering: `steerToward`, `steerAway`, `weightedTarget`.
- Random/roaming: `createSeededRng`, `pickWeighted`, `randomPointInRect`, `advanceRoamingAgent`.
- Debug text: `formatThreatOverlay`.

## `@zeus/net`

Browser-safe networking primitives for in-memory rooms, authoritative tick running, WebSocket clients, and socket protocol messages.

Root entry exports:

- In-memory rooms: `InMemoryRoomHost`, `InMemoryRoomClient`, `InMemoryRoomTransport`.
- Authoritative room loop: `ZeusAuthoritativeRoomTickRunner`.
- Browser WebSocket client: `ZeusWebSocketRoomClient`.
- Protocol helpers: `parseZeusSocketMessage`, `stringifyZeusSocketMessage`.
- Room/protocol types: `AuthoritativeRoom`, `RoomTransport`, `RoomJoinResult`, `RoomId`, `ClientId`, `ReconnectToken`, `ZeusSocketMessage`.

Subpath exports:

```ts
import { ZeusWebSocketRoomClient } from "@zeus/net/web-socket-room-client";
import { ZeusWebSocketRoomServer } from "@zeus/net/web-socket-room-server";
```

The root entry is kept browser-safe. The Node-only WebSocket room server is intentionally exported through `@zeus/net/web-socket-room-server`.

## `@zeus/net-colyseus`

Thin adapter boundary for Colyseus-like room clients.

Main exports:

- `ZeusColyseusClient`
- `ColyseusLikeRoom`
- `ColyseusJoiner`

This package does not make Zeus depend on Colyseus directly.

## `@zeus/debug`

Debug console registration and overlay formatting helpers.

Main exports:

- `ZeusDebug`
- `DebugConsole`
- `formatFpsOverlay`
- `DebugCommand`, `DebugCommandContext`, `DebugCommandResult`, `FpsOverlayState`

## `@zeus/tools`

Node-side tooling primitives for validation, hot reload, sprite generation/packing, foliage placement, world validation, and review reports.

Main library exports:

- CLI helper: `runValidateCli`.
- Hot reload: `LastValidContent`.
- Schema validation: `validateContentSchema`, `ContentSchema`, `ContentFieldRule`.
- Sprite atlas packing: `packSpriteAtlas`, `validateSpritePack`, `createSpriteContactSheet`, `writeSpriteQaReport`.
- Sprite sheet import: `importChromaKeySpriteSheet`, `validateSpriteSheetImport`.
- Pixel canvas/generation: `createPixelCanvas`, draw helpers, `generatePixelSprites`, `renderPixelSprite`, `builtinPixelSpriteTemplates`.
- Foliage placement: `generateFoliagePlacements`, `generateFoliagePlacementResult`.
- World validation/review: `validateChunkMap`, `validateWorldLayers`, `countRouteClearanceViolations`, `createWorldReviewReport`.

Package binaries:

```bash
zeus dev
zeus dev --script <npm-script>
zeus dev --dry-run
zeus scenario list
zeus scenario validate
zeus scenario show <id>
zeus-tools generate-pixels --config <config.mjs>
```

`zeus dev` is the current project workflow command. `zeus scenario` commands list, validate, and inspect project-owned scenario files. Planned content validation commands are documented in `tooling-plan.md` as future work, not current CLI behavior.
