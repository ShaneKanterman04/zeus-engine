# Zeus Scenarios

Version: 0.1
Date: 2026-05-20
Status: Implemented baseline

## Purpose

Zeus scenarios are reusable devtools fixtures for repeatable gameplay states. Zeus owns the generic schema, registry, validation, CLI, and adapter/test harness. Games own scenario files and game-specific application logic.

## Scenario Files

By convention, game projects store scenarios under:

```text
games/<game-id>/content/scenarios/*.json
```

A project can override this path with:

```json
{
  "zeus": {
    "scenarioDir": "games/last-hearth/content/scenarios"
  }
}
```

Scenario files can contain either one scenario object or a manifest:

```json
{
  "version": "1",
  "gameId": "last-hearth",
  "scenarios": []
}
```

## Scenario Shape

```json
{
  "id": "opening-loop",
  "title": "Opening Loop",
  "description": "Start at the homestead with early goals active.",
  "gameId": "last-hearth",
  "version": "1",
  "tags": ["opening", "smoke"],
  "contentRefs": {
    "mapId": "full-playable"
  },
  "initialState": {},
  "world": {},
  "actors": {},
  "resources": {},
  "objectives": {},
  "steps": [
    { "type": "advance-time", "payload": { "hours": 1 } }
  ],
  "assertions": [
    { "path": "objective.mode", "operator": "equals", "value": "first-frost" }
  ]
}
```

Zeus validates the common fields. Games should add project-specific validation for content refs and step payloads.

## CLI

```bash
zeus scenario list
zeus scenario list --tag smoke
zeus scenario validate
zeus scenario show opening-loop
zeus scenario show opening-loop --json
```

Use `--dir <path>` to point at a scenario directory explicitly.

## Runtime Adapter

Zeus does not know a game's state shape. Games implement an adapter:

```ts
import type { ZeusScenarioAdapter } from "@zeus/tools";

export const adapter: ZeusScenarioAdapter<GameState> = {
  createBaseState: () => createGameState(),
  applyScenario: (state, scenario) => applyGameScenario(state, scenario),
  runStep: (state, step) => runGameScenarioStep(state, step),
  tick: (state, dt) => tickGame(state, dt),
};
```

Then tests or devtools can call `runZeusScenario`.

## Assertions

Built-in assertion operators:

- `equals`
- `notEquals`
- `exists`
- `notExists`
- `gt`
- `gte`
- `lt`
- `lte`
- `includes`

Assertion paths use dot notation such as `resources.firewood` or `players.0.position.x`.

## Self-Hosted Automation

Zeus scenario commands are plain npm/CLI commands and are intended to run locally or on the same self-hosted runner as Last Hearth. The workflow does not require GitHub-hosted runner assumptions.
