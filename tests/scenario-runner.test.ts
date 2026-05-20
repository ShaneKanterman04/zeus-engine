import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateZeusScenarioAssertions,
  loadZeusScenarioRegistry,
  runZeusScenario,
  validateZeusScenario,
  valueAtPath,
  type ZeusScenario,
  type ZeusScenarioAdapter,
} from "@zeus/tools";
import { resolveScenarioDirectory } from "../packages/zeus-tools/src/cli/zeus-scenario";
import { runZeusCli } from "../packages/zeus-tools/src/cli/zeus";

async function tempDir() {
  return mkdtemp(join(tmpdir(), "zeus-scenario-test-"));
}

async function cleanup(path: string) {
  await rm(path, { recursive: true, force: true });
}

const openingScenario: ZeusScenario = {
  id: "opening-loop",
  title: "Opening Loop",
  gameId: "test-game",
  version: "1",
  tags: ["smoke", "opening"],
  initialState: { wood: 1 },
  steps: [{ type: "give", payload: { key: "wood", amount: 2 } }],
  assertions: [{ path: "wood", operator: "gte", value: 3 }],
};

describe("Zeus scenarios", () => {
  it("validates scenario shape and assertions", () => {
    expect(validateZeusScenario(openingScenario)).toMatchObject({ ok: true });
    expect(
      validateZeusScenario({
        ...openingScenario,
        assertions: [{ path: "wood", operator: "gte" }],
      }),
    ).toMatchObject({ ok: false, errors: expect.arrayContaining(["Scenario 'opening-loop' assertion 0 operator 'gte' requires value"]) });
  });

  it("loads a directory registry, filters by tag, and rejects duplicate ids", async () => {
    const dir = await tempDir();
    try {
      await writeFile(join(dir, "opening.json"), `${JSON.stringify(openingScenario, null, 2)}\n`);
      const registry = await loadZeusScenarioRegistry({ directory: dir });
      expect(registry.validation.ok).toBe(true);
      expect(registry.list({ tag: "opening" }).map((scenario) => scenario.id)).toEqual(["opening-loop"]);
      expect(registry.require("opening-loop").title).toBe("Opening Loop");

      await writeFile(join(dir, "duplicate.json"), `${JSON.stringify({ ...openingScenario, title: "Duplicate" }, null, 2)}\n`);
      const broken = await loadZeusScenarioRegistry({ directory: dir });
      expect(broken.validation.ok).toBe(false);
      expect(broken.validation.errors).toContain("Duplicate scenario id 'opening-loop'");
    } finally {
      await cleanup(dir);
    }
  });

  it("runs a scenario through an adapter and evaluates assertions", () => {
    type TestState = { wood: number };
    const adapter: ZeusScenarioAdapter<TestState> = {
      createBaseState: () => ({ wood: 0 }),
      applyScenario: (_state, scenario) => structuredClone(scenario.initialState) as TestState,
      runStep: (state, step) => {
        const payload = step.payload as { key: keyof TestState; amount: number };
        return { ...state, [payload.key]: state[payload.key] + payload.amount };
      },
    };

    const result = runZeusScenario({ scenario: openingScenario, adapter });
    expect(result.state.wood).toBe(3);
    expect(result.assertions.every((assertion) => assertion.ok)).toBe(true);
  });

  it("evaluates default assertion operators against object paths", () => {
    const state = { inventory: { wood: 4, tags: ["warm"] } };
    expect(valueAtPath(state, "inventory.wood")).toBe(4);
    expect(
      evaluateZeusScenarioAssertions(state, [
        { path: "inventory.wood", operator: "equals", value: 4 },
        { path: "inventory.tags", operator: "includes", value: "warm" },
      ]).map((assertion) => assertion.ok),
    ).toEqual([true, true]);
  });

  it("finds scenario directories from package config and exposes CLI list/show/validate", async () => {
    const project = await tempDir();
    const scenarioDir = join(project, "games", "test-game", "content", "scenarios");
    try {
      await mkdir(scenarioDir, { recursive: true });
      await writeFile(
        join(project, "package.json"),
        `${JSON.stringify({ name: "test-game", zeus: { scenarioDir: "games/test-game/content/scenarios" }, dependencies: { "@zeus/core": "file:../zeus-engine/packages/zeus-core" } }, null, 2)}\n`,
      );
      await writeFile(join(scenarioDir, "opening.json"), `${JSON.stringify(openingScenario, null, 2)}\n`);
      await expect(resolveScenarioDirectory(project)).resolves.toBe(scenarioDir);

      const lines: string[] = [];
      await expect(runZeusCli(["scenario", "list"], { cwd: project, stdout: { log: (line) => lines.push(line) } })).resolves.toBe(0);
      expect(lines.join("\n")).toContain("opening-loop");

      const jsonLines: string[] = [];
      await expect(runZeusCli(["scenario", "show", "opening-loop", "--json"], { cwd: project, stdout: { log: (line) => jsonLines.push(line) } })).resolves.toBe(0);
      expect(JSON.parse(jsonLines.join("\n"))).toMatchObject({ id: "opening-loop" });

      const validateLines: string[] = [];
      await expect(runZeusCli(["scenario", "validate"], { cwd: project, stdout: { log: (line) => validateLines.push(line) } })).resolves.toBe(0);
      expect(validateLines.join("\n")).toContain("1 scenario(s) ok");
    } finally {
      await cleanup(project);
    }
  });
});
