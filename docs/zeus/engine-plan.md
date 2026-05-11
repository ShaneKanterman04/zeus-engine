# Zeus Engine Plan

Version: 0.3
Date: 2026-05-11
Status: Pre-production baseline

## Core Direction

Zeus is a studio engine, not only a Last Hearth runtime and not yet a public engine product. It should provide reusable infrastructure while Last Hearth provides game-specific systems.

## Proposed Package Shape

```text
packages/
  zeus-core
  zeus-renderer-pixi
  zeus-input
  zeus-audio
  zeus-assets
  zeus-net
  zeus-net-colyseus
  zeus-debug
  zeus-tools

games/
  last-hearth/
    client
    server
    shared
    content
    assets_source
    assets_game
```

## Zeus Runtime Modules

| Module | Purpose |
| --- | --- |
| ZeusApp | Boot, lifecycle, canvas, resize, settings. |
| ZeusRenderer | Pixi-backed world rendering. |
| ZeusWorld | Entities, components, chunks, simulation state. |
| ZeusScenes | Boot, menu, lobby, world, loading scenes. |
| ZeusInput | Keyboard, mouse, gamepad, remapping. |
| ZeusAudio | Music, ambience, SFX, volume buses. |
| ZeusAssets | Manifests, atlases, loading, hot reload. |
| ZeusNet | Rooms, prediction, interpolation, Colyseus adapter. |
| ZeusDebug | Console, overlays, inspectors, dev commands. |
| ZeusTools | Importers, validators, build/export pipeline. |

## Engine Boundary

Zeus owns reusable infrastructure. Last Hearth owns game rules.

| Zeus Owns | Last Hearth Owns |
| --- | --- |
| Rendering layers | Hunting design |
| Entity/component runtime | Deer/wolf behavior tuning |
| Asset manifests | Food/item definitions |
| Input bindings | First Frost objective |
| Audio service | Homestead/Sanctuary rules |
| Network abstraction | Rifle/predator consequences |
| Debug console | Frontier survival balance |
| Content validator | Crop/weather content |

Boundary rules:

- Zeus can provide the system runner, but Last Hearth owns survival, hunting, weather, crops, predator, Sanctuary, and objective systems.
- Zeus can provide content schema/validation primitives, but Last Hearth owns actual content packs and balance values.
- Zeus can provide debug command registration, but Last Hearth owns commands such as spawn deer, weather snow, and show tracks.
- Zeus can provide networking primitives, but Last Hearth owns replicated gameplay state and action validation.

## Entity Model

Use lightweight ECS-style architecture.

```text
Entities own IDs.
Components own data.
Systems own behavior.
```

Initial component categories:

- Position
- Velocity
- Sprite
- Collider
- Inventory
- Needs
- BodyCondition
- AnimalBrain
- TrackEmitter
- Spoilage
- CropPlot
- HomesteadStructure
- Interactable

Initial system categories:

- Movement
- Collision
- Interaction
- Animation
- Render sync
- Network sync

Game-specific systems like hunting, weather, crops, predators, and Sanctuary should live in Last Hearth unless they become clearly reusable.

## Rendering

Zeus uses PixiJS internally at first but exposes game-friendly rendering concepts.

Layers:

- Ground
- Ground detail
- Below entities
- Entities
- Above entities
- Weather
- Lighting
- World prompts
- Debug

Renderer requirements:

- Painterly 2D sprites
- Chunked maps
- Texture atlases
- Y-sorted entities
- Weather overlays
- Cheap lighting
- Debug draw
- Quality settings
- Accessibility render modes

## Input

Zeus input should expose actions, not raw keys.

Input layers:

```text
Raw input -> bindings -> actions -> player intent
```

Requirements:

- Keyboard and mouse first
- Gamepad-ready abstraction
- Rebinding support later
- UI capture so menus do not leak gameplay input
- Network-friendly player intent output

## Audio

Zeus audio should support:

- Master, music, ambience, SFX, and UI buses
- Browser audio unlock handling
- SFX playback
- Ambient loops
- Music crossfade later
- Separate sliders for accessibility

## Debug

Debug tools are part of the engine, not polish.

Initial debug overlays:

- FPS/frame time
- Update/render time
- Entity count
- Sprite count
- Collision shapes
- Chunk boundaries
- Camera position
- Input state
- Network stats

Initial debug console framework should support command registration, permissions, argument parsing, output, and overlays. Last Hearth registers game-specific commands such as spawn deer, give rifle rounds, set weather, show tracks, and show predator interest.

## Minimum Viable Zeus Milestone

Zeus is ready for Last Hearth prototype work when it can:

- Boot in browser
- Load a scene
- Render a small map
- Spawn and move a player
- Follow with camera
- Play a sound
- Show debug overlay
- Load assets by manifest
- Spawn entities
- Run a fixed-step simulation
- Join a private multiplayer room
- Reconnect while server room exists

## Scope Warnings

Do not build early:

- General-purpose plugin architecture
- Visual scripting
- Full custom world editor
- Multi-renderer support beyond Pixi
- Modding system
- Generic physics engine
- Advanced shader graph
- Public editor polish
