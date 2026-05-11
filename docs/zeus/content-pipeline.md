# Zeus Content Pipeline

Version: 0.3
Date: 2026-05-11
Status: Pre-production baseline

## Pipeline Goal

Zeus should make content iteration safe, traceable, and reusable across studio projects while supporting Last Hearth's painterly GPT-assisted art workflow.

## Source-To-Runtime Pipeline

```text
Design brief
-> Prompt/style guide
-> GPT image generation
-> Human review
-> Cleanup/paintover
-> Sprite/tile/object processing
-> Metadata authoring
-> Atlas packing
-> Validation
-> Versioned runtime manifest
-> Hot reload/runtime preview
```

## Source Vs Game Assets

Separate source assets from game-ready runtime assets.

Conceptual folders:

```text
assets_source/
  prompts/
  concepts/
  paintovers/
  layered/
  metadata/

assets_game/
  sprites/
  atlases/
  tilesets/
  chunks/
  manifests/
```

Generated images should never be consumed directly by the runtime.

## Prompt Registry

Every accepted generated image should record:

- Asset ID
- Prompt
- Model/tool used
- Date
- Style version
- Accepted/rejected status
- Notes
- Source image reference
- Cleanup file reference

Purpose:

- Reproducibility
- Style drift control
- Auditability
- Easier re-generation

## Metadata Requirements

Every runtime asset should have:

- Stable ID
- Category
- Source reference
- Style version
- Asset version
- Dimensions
- Pivot
- Bounds/collision if needed
- Tags
- Review status
- Performance class
- Accessibility notes
- License/provenance status
- Human review status

## Atlas Strategy

Use atlases for runtime efficiency while keeping individual sprites and metadata as source of truth.

Atlas groups:

- Characters
- Animals
- Props
- Terrain
- Weather/effects
- UI

Avoid one giant atlas early. Use several medium atlases that can be loaded by scene or biome.

## Content Definitions

Zeus should support data-driven content for:

- Items
- Recipes
- Stations
- Animals
- Crops
- Weather
- Structures
- Conditions
- Audio cues
- Visual effects

Data files should be validated before runtime.

## Schema Vs Content Pack Ownership

Zeus owns:

- Schema format primitives.
- Validation framework.
- Asset/content registry mechanics.
- Reference checking.
- Manifest generation.
- Hot reload infrastructure.

Last Hearth owns:

- Actual items, recipes, stations, crops, animals, weather, structures, and balance values.
- Game-specific content rules such as rifle ammo scarcity and predator interest.
- Game-specific validation rules that are not reusable across future projects.

Future games should be able to reuse Zeus schema tooling without inheriting Last Hearth content.

## Validation Rules

Fail build on:

- Duplicate asset/content IDs
- Missing metadata
- Missing source reference
- Missing runtime sprite
- Invalid atlas reference
- Invalid collision shape
- Invalid recipe ingredient
- Invalid animal yield
- Missing required animation
- Asset marked draft/needs review
- Missing provenance or review status

Warn on:

- Oversized textures
- Unapproved style version
- Missing accessibility notes
- Unusual brightness/contrast
- Large alpha-heavy sprites
- Assets not used anywhere

## Legal And Provenance Rules

Zeus should track provenance but not decide project-specific legal policy.

Required metadata fields for generated or externally sourced assets:

- Source type
- Tool/model/vendor
- Prompt or acquisition record
- Date created/imported
- Commercial-use review status
- Human approval status
- Source retention path

Runtime builds should fail if an asset is marked unknown provenance, rejected, draft, or needs review.

## Hot Reload Rules

Hot reload should not bypass validation.

If changed content is invalid:

- Keep last valid runtime version.
- Show clear developer error.
- Do not silently load broken assets.

## Accessibility And Performance Checks

Gameplay-critical assets must be readable at actual gameplay zoom, distinguishable in grayscale, and clear over common terrain backgrounds.

Performance constraints:

- Avoid huge transparent canvases.
- Avoid oversized painterly detail at tiny runtime scale.
- Avoid loading all biome assets at once.
- Prefer trimmed sprites with stable pivots.
- Use atlases and streaming groups.
