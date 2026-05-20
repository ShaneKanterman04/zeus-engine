# Zeus Engine Project Map

Version: 0.1
Date: 2026-05-20
Status: Agent navigation map

## Start Here

Use this map when you need to find the right Zeus Engine area quickly. For public exports, read `docs/zeus/packages.md`. For architecture intent, read `docs/zeus/engine-plan.md`. For current tooling status, read `docs/zeus/tooling-plan.md`.

## High-Level Layout

| Path | Purpose |
| --- | --- |
| `packages/*/src` | Reusable TypeScript engine packages consumed through `@zeus/*` imports. |
| `packages/*/package.json` | Package names, exports, dependencies, bins, and peer dependencies. |
| `tests/` | Vitest coverage for runtime, networking, renderer, world layers, CLI, and performance. |
| `scripts/` | Root build/export checks and editor helper scripts. |
| `docs/zeus/` | Engine docs, package reference, tooling plans, content pipeline notes. |
| `apps/zeus-editor/` | Native C++/Qt editor app and Asset Studio workflow. |
| `.github/workflows/` | CI gates. |

## Package Map

| Package | Path | Look Here For |
| --- | --- | --- |
| `@zeus/core` | `packages/zeus-core/src` | App lifecycle, fixed-step loop, system runner, scenes, ECS, entity queries, projectiles, line of sight, chunks, world layers, spatial hash, frame metrics. |
| `@zeus/renderer-pixi` | `packages/zeus-renderer-pixi/src` | Pixi renderer, layers, sprite/atlas rendering, culled sprites, static chunks, lighting, creek/lake graphics, runtime loop glue. |
| `@zeus/input` | `packages/zeus-input/src` | Input bindings, input layers, capture rules, snapshots. |
| `@zeus/assets` | `packages/zeus-assets/src` | Asset manifests, runtime paths, file signatures, metadata/provenance validation. |
| `@zeus/audio` | `packages/zeus-audio/src` | Browser audio service and bus volumes. |
| `@zeus/ai` | `packages/zeus-ai/src` | Signals, threat meter, steering, seeded RNG, weighted picking, roaming helpers. |
| `@zeus/net` | `packages/zeus-net/src` | In-memory room transport, WebSocket client, Node WebSocket server subpath, protocol, authoritative tick runner. |
| `@zeus/net-colyseus` | `packages/zeus-net-colyseus/src` | Colyseus-like adapter boundary. |
| `@zeus/debug` | `packages/zeus-debug/src` | Debug console, command registry, FPS overlay formatting. |
| `@zeus/tools` | `packages/zeus-tools/src` | `zeus` CLI, `zeus-tools` CLI, schema validation, hot reload, sprite generation/packing, foliage placement, world validation/review. |

## Common Tasks

| Task | Files To Check First | Verification |
| --- | --- | --- |
| Add reusable runtime behavior | `packages/zeus-core/src/index.ts`, relevant `packages/zeus-core/src/*` module, `tests/runtime-primitives.test.ts` | `npm run typecheck && npm test` |
| Change package exports | `packages/*/src/index.ts`, `packages/*/package.json`, `scripts/check-package-exports.mjs` | `npm run build && npm run check:exports` |
| Change WebSocket or room behavior | `packages/zeus-net/src`, `tests/web-socket-room.test.ts`, `tests/net-browser-boundary.test.ts` | `npm test -- tests/web-socket-room.test.ts tests/net-browser-boundary.test.ts` |
| Change `zeus dev` | `packages/zeus-tools/src/cli/zeus.ts`, `packages/zeus-tools/src/cli/zeus-dev.ts`, `tests/zeus-cli.test.ts` | `npm test -- tests/zeus-cli.test.ts` |
| Change Pixi rendering helpers | `packages/zeus-renderer-pixi/src`, `tests/renderer-pixi-static-chunks.test.ts` | `npm test -- tests/renderer-pixi-static-chunks.test.ts` |
| Change world layers/chunks | `packages/zeus-core/src/worldLayers.ts`, `packages/zeus-core/src/chunks`, `packages/zeus-tools/src/world`, `tests/world-layers.test.ts`, `tests/chunk-streamer.test.ts` | `npm test -- tests/world-layers.test.ts tests/chunk-streamer.test.ts` |
| Change editor app | `apps/zeus-editor/src`, `apps/zeus-editor/README.md`, `scripts/editor-cmake.mjs` | `npm run editor:build` when Qt is available |

## Boundaries

- Keep reusable engine behavior in `packages/*`.
- Do not import from `last-hearth-game` or game-specific paths into engine packages.
- Game-specific editor profiles/defaults may exist in `apps/zeus-editor`, but reusable packages must stay game-agnostic.
- Browser-safe networking belongs in the root `@zeus/net` entry. Node-only server code belongs behind the `@zeus/net/web-socket-room-server` subpath.

## Command Map

```bash
npm run build
npm run check:exports
npm run typecheck
npm test
npm run test:coverage
npm run perf:bench
```

For CLI use from a Zeus game project:

```bash
zeus dev
npx --no-install zeus dev
zeus dev --script dev:local
zeus dev --dry-run
zeus-tools generate-pixels --config path/to/config.mjs
```
