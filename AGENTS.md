# Agent Guidance

This repo is the reusable Zeus engine/tooling layer used by `/home/shane/last-hearth-game`.

The dependency direction must remain:

```text
last-hearth-game -> zeus-engine
```

Zeus packages must not import from Last Hearth game paths such as:

```text
src/last-hearth
games/last-hearth
/home/shane/last-hearth-game
```

Put reusable behavior here: core loop, scene management, ECS/component primitives, rendering helpers, input, audio, assets, networking, debug tools, and validation/hot reload tooling.

Verify engine changes with:

```bash
cd /home/shane/zeus-engine
npm run typecheck
```

When changing engine behavior for a game feature, also verify the game:

```bash
cd /home/shane/last-hearth-game
npm run verify
```

