# Agent Guidance

This repo is the reusable Zeus engine/tooling layer used by `/home/shane/Projects/last-hearth-game`.

For fast navigation, read `docs/zeus/project-map.md` before searching broadly. It maps package ownership, common task entry points, tests, docs, scripts, and command gates.

The dependency direction must remain:

```text
last-hearth-game -> zeus-engine
```

Zeus packages must not import from Last Hearth game paths such as:

```text
src/last-hearth
games/last-hearth
/home/shane/Projects/last-hearth-game
```

Put reusable behavior here: core loop, scene management, ECS/component primitives, rendering helpers, input, audio, assets, networking, debug tools, and validation/hot reload tooling.

Networking primitives such as WebSocket room clients, room servers, protocol types, and LAN binding options belong in `packages/zeus-net`. Game repos should consume them through package-name imports such as `@zeus/net`.

Verify engine changes with:

```bash
cd /home/shane/Projects/zeus-engine
npm run build
npm run check:exports
npm run typecheck
npm test
npm run test:coverage
```

When changing engine behavior for a game feature, also verify the game:

```bash
cd /home/shane/Projects/zeus-engine && npm run build
cd /home/shane/Projects/last-hearth-game
npm run verify
```
