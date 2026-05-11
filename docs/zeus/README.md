# Zeus Engine Documentation

Version: 0.3
Date: 2026-05-11
Status: Pre-production baseline

## Zeus Charter

Zeus is an internal studio engine/toolchain for building multiplayer-capable 2D browser games.

Last Hearth is the first full game built on Zeus, but Zeus should remain reusable for future studio projects.

## Zeus Should Own

- Runtime lifecycle
- Fixed-step simulation loop
- Scene management
- ECS-lite entity model
- PixiJS renderer adapter
- Input abstraction
- Audio service
- Asset loading
- Content validation
- Debug overlays and console
- Multiplayer abstraction
- Build/export tooling
- Hot reload workflow

## Zeus Should Not Become Yet

- Public standalone engine product
- Plugin marketplace
- Visual scripting platform
- Full custom editor suite
- Multi-renderer framework
- Modding platform
- Generic physics engine

## Documentation Files

| File | Purpose |
| --- | --- |
| `engine-plan.md` | Runtime, renderer, simulation, input, audio, debug, and engine architecture. |
| `tooling-plan.md` | Editors, importers, validators, debug tools, and build tooling. |
| `content-pipeline.md` | Zeus asset/content pipeline with GPT-assisted art support. |

## Scope Rule

Every Zeus feature must satisfy at least one condition:

1. Needed by Last Hearth now.
2. Clearly reusable by the next likely 2D game.
3. Needed for studio workflow, validation, debugging, testing, or content iteration.
