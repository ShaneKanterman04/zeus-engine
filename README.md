# Zeus Engine

Zeus Engine is a modular, TypeScript-first game engine and tooling stack for building browser games.

It is published as a monorepo of focused packages (core runtime, rendering, input, assets, audio, AI helpers, networking, debugging, and tools) so projects can depend on only what they need.

> Design goal: reusable engine packages with clear package boundaries, consumed by game projects through `@zeus/*` imports.

## Features

- **Core game loop + simulation primitives** via `@zeus/core`
- **PixiJS renderer integration** via `@zeus/renderer-pixi`
- **Input abstraction layer** via `@zeus/input`
- **Asset loading/runtime helpers** via `@zeus/assets`
- **Audio helpers** via `@zeus/audio`
- **AI signal, threat, and roaming helpers** via `@zeus/ai`
- **Networking primitives** (including WebSocket room client/server exports) via `@zeus/net`
- **Optional Colyseus integration package** via `@zeus/net-colyseus`
- **Debug overlays and console tools** via `@zeus/debug`
- **Sprite, content, foliage, and world review tooling** via `@zeus/tools`

## Package Overview

- `@zeus/core` — app lifecycle, ECS primitives, world/simulation, scenes, shared types
- `@zeus/renderer-pixi` — rendering bridge for PixiJS 8
- `@zeus/input` — input services integrated with core runtime
- `@zeus/assets` — asset/runtime helpers for game content
- `@zeus/audio` — engine-level audio utilities
- `@zeus/ai` — AI signals, threat meter, steering, and roaming helpers
- `@zeus/net` — protocol + transport + WebSocket room networking primitives
- `@zeus/net-colyseus` — Colyseus-specific networking adapter package
- `@zeus/debug` — debug console and overlays (e.g. FPS)
- `@zeus/tools` — sprite generation/packing, content validation helpers, foliage placement, world review helpers, CLI

## Repository Layout

```text
packages/
  zeus-core/
  zeus-renderer-pixi/
  zeus-input/
  zeus-assets/
  zeus-audio/
  zeus-ai/
  zeus-net/
  zeus-net-colyseus/
  zeus-debug/
  zeus-tools/
docs/zeus/
scripts/
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Build all packages

```bash
npm run build
```

### Validate workspace exports

```bash
npm run check:exports
```

### Type-check

```bash
npm run typecheck
```

## Development Workflow

Use the root scripts while developing to keep all workspace packages aligned:

```bash
npm run build
npm run check:exports
npm run typecheck
```

If you are developing Zeus Engine alongside a game project, rebuild the engine and then run the game’s verification suite.

## Example Imports

```ts
import { ZeusApp } from '@zeus/core';
import { ZeusPixiRenderer } from '@zeus/renderer-pixi';
import { ZeusInput } from '@zeus/input';
import { ZeusDebug } from '@zeus/debug';
import { advanceThreatMeter, classifyThreatStage } from '@zeus/ai';
```

Networking entry points:

```ts
import { ZeusWebSocketRoomClient, ZeusWebSocketRoomServer } from '@zeus/net';
```

## Docs

See engine notes and planning docs in `docs/zeus/`.

## Status

Zeus Engine is actively evolving. Expect APIs to change while core systems are refined.

## License

Add a `LICENSE` file and update this section before first public release.
