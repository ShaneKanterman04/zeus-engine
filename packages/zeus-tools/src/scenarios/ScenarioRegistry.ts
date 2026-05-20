import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ZeusScenario, ZeusScenarioManifest, ZeusScenarioValidationResult } from "./ScenarioTypes.js";
import { validateZeusScenario, validateZeusScenarioManifest, type ZeusScenarioValidationOptions } from "./ScenarioValidation.js";

export type ZeusScenarioRegistryOptions = ZeusScenarioValidationOptions & {
  directory: string;
};

export type ZeusScenarioRegistry = {
  directory: string;
  scenarios: readonly ZeusScenario[];
  validation: ZeusScenarioValidationResult;
  list(options?: { tag?: string }): ZeusScenario[];
  get(id: string): ZeusScenario | undefined;
  require(id: string): ZeusScenario;
};

type ScenarioDocument = ZeusScenario | ZeusScenarioManifest;

export async function loadZeusScenarioRegistry(options: ZeusScenarioRegistryOptions): Promise<ZeusScenarioRegistry> {
  const directory = resolve(options.directory);
  const scenarios: ZeusScenario[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const file of await listJsonFiles(directory)) {
    try {
      const parsed = JSON.parse(await readFile(file, "utf8")) as ScenarioDocument;
      const loaded = scenariosFromDocument(parsed);
      scenarios.push(...loaded.scenarios);
      errors.push(...loaded.validation.errors.map((error) => `${file}: ${error}`));
      warnings.push(...loaded.validation.warnings.map((warning) => `${file}: ${warning}`));
    } catch (error) {
      errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const ids = new Set<string>();
  for (const scenario of scenarios) {
    const result = validateZeusScenario(scenario, options);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (ids.has(scenario.id)) errors.push(`Duplicate scenario id '${scenario.id}'`);
    ids.add(scenario.id);
  }
  const validation = { ok: errors.length === 0, errors, warnings };
  return createZeusScenarioRegistry(directory, scenarios, validation);
}

export function createZeusScenarioRegistry(directory: string, scenarios: readonly ZeusScenario[], validation: ZeusScenarioValidationResult): ZeusScenarioRegistry {
  return {
    directory,
    scenarios: [...scenarios].sort((a, b) => a.id.localeCompare(b.id)),
    validation,
    list(options = {}) {
      return this.scenarios.filter((scenario) => !options.tag || scenario.tags?.includes(options.tag));
    },
    get(id: string) {
      return this.scenarios.find((scenario) => scenario.id === id);
    },
    require(id: string) {
      const scenario = this.get(id);
      if (!scenario) throw new Error(`Unknown scenario '${id}'`);
      return scenario;
    },
  };
}

function scenariosFromDocument(document: ScenarioDocument) {
  if ("scenarios" in document) {
    const validation = validateZeusScenarioManifest(document);
    return { scenarios: Array.isArray(document.scenarios) ? [...document.scenarios] : [], validation };
  }
  const validation = validateZeusScenario(document);
  return { scenarios: [document], validation };
}

async function listJsonFiles(directory: string) {
  const files: string[] = [];
  async function walk(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.push(path);
    }
  }
  await walk(directory);
  return files.sort();
}
