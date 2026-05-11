# Zeus Tooling Plan

Version: 0.3
Date: 2026-05-11
Status: Pre-production baseline

## Tooling Philosophy

Use third-party tools for generic creation work. Build Zeus tools for anything tied to game rules, validation, debugging, build/export, or studio workflow.

## MVP Zeus Tools

| Tool | Purpose |
| --- | --- |
| Asset manifest system | Stable asset IDs and loading. |
| Atlas pipeline | Pack sprites into runtime atlases. |
| GPT art registry | Track prompts, source images, and style versions. |
| Content data format | Items, recipes, animals, crops, weather, structures. |
| Content validator | Catch broken IDs, missing art, invalid recipes. |
| Map importer | Temporary Zeus test map importer first; final editor decision deferred. |
| Animation importer | Read animation metadata. |
| Debug console | Spawn, teleport, give item, change weather. |
| Debug overlays | Collision, chunks, tracks, animal AI, network. |
| Hot reload | Reload data/assets during development. |
| Build pipeline | Validate, pack, export runtime assets. |

## Debug Commands

Required early command framework supports these Last Hearth-registered commands:

```text
give wood 50
give rifle_round 3
spawn deer
spawn rabbit
spawn wolf
weather snow
weather rain
time dusk
time night
teleport homestead
set hunger 100
set warmth 100
show tracks
show predator_interest
reload content
```

## Third-Party Tools To Use Initially

| Tool | Role |
| --- | --- |
| GPT image generation | Painterly concept/source art. |
| Aseprite or equivalent | Sprite cleanup/animation source if needed. |
| Texture packer | Runtime atlas generation. |
| Map editor | Deferred until engine discussion; use temporary Zeus test map format first. |
| Audio tools | External authoring for SFX/music. |

## Custom Zeus Tools To Build

Zeus should own:

- Content schema
- Entity registry
- Asset registry
- Prompt/style registry
- Validation CLI
- Runtime debug console
- Hot reload
- Save compatibility later
- Build/export
- Simulation test tools

Zeus owns the debug/validation framework. Last Hearth registers game-specific commands, validation rules, and content packs.

## Validation Tools

Validation should run locally and eventually in CI.

Validation targets:

- Content definitions
- Asset metadata
- Prompt/source metadata
- Map files
- Entity placements
- Animation clips
- Recipes
- Animal yields
- Crop definitions
- Weather definitions
- Localization keys later

Commands planned:

```text
zeus validate-content
zeus validate-assets
zeus validate-maps
zeus validate-all
```

## Later Zeus Editors

Only build visual editors once the data model is stable and external tools become painful.

Potential later editors:

- Item/recipe editor
- Animal behavior editor
- Crop/weather editor
- Scenario editor
- Save/debug inspector
- Map/world editor
- Dialogue/journal editor
- Economy simulator

## Tooling Priority

Priority order:

1. Validation CLI
2. Asset manifest and atlas build
3. Debug overlay and console
4. Hot reload
5. Network debug overlay
6. Scenario/debug tools
7. Visual editors later
