import type {
  ZeusScenario,
  ZeusScenarioAssertion,
  ZeusScenarioAssertionOperator,
  ZeusScenarioManifest,
  ZeusScenarioValidationResult,
} from "./ScenarioTypes.js";

const assertionOperators = new Set<ZeusScenarioAssertionOperator>([
  "equals",
  "notEquals",
  "exists",
  "notExists",
  "gt",
  "gte",
  "lt",
  "lte",
  "includes",
]);

export type ZeusScenarioValidationOptions = {
  allowedStepTypes?: readonly string[];
  allowedTags?: readonly string[];
};

export function validateZeusScenarioManifest(manifest: ZeusScenarioManifest, options: ZeusScenarioValidationOptions = {}): ZeusScenarioValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObject(manifest)) errors.push("Scenario manifest must be an object");
  if (typeof manifest.version !== "string" || manifest.version.length === 0) errors.push("Scenario manifest requires version");
  if (typeof manifest.gameId !== "string" || manifest.gameId.length === 0) errors.push("Scenario manifest requires gameId");
  if (!Array.isArray(manifest.scenarios)) {
    errors.push("Scenario manifest requires scenarios array");
    return { ok: false, errors, warnings };
  }

  const ids = new Set<string>();
  for (const scenario of manifest.scenarios) {
    const result = validateZeusScenario(scenario, options);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (typeof scenario.id === "string") {
      if (ids.has(scenario.id)) errors.push(`Duplicate scenario id '${scenario.id}'`);
      ids.add(scenario.id);
    }
    if (typeof scenario.gameId === "string" && typeof manifest.gameId === "string" && scenario.gameId !== manifest.gameId) {
      errors.push(`Scenario '${scenario.id}' gameId '${scenario.gameId}' does not match manifest gameId '${manifest.gameId}'`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function validateZeusScenario(scenario: ZeusScenario, options: ZeusScenarioValidationOptions = {}): ZeusScenarioValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObject(scenario)) return { ok: false, errors: ["Scenario must be an object"], warnings };
  requireString(scenario.id, "id", errors);
  requireString(scenario.title, `Scenario '${scenario.id ?? "unknown"}' title`, errors);
  requireString(scenario.gameId, `Scenario '${scenario.id ?? "unknown"}' gameId`, errors);
  requireString(scenario.version, `Scenario '${scenario.id ?? "unknown"}' version`, errors);

  if (scenario.tags !== undefined) validateStringArray(scenario.tags, `Scenario '${scenario.id}' tags`, errors);
  if (scenario.tags && options.allowedTags && options.allowedTags.length > 0) {
    const allowed = new Set(options.allowedTags);
    for (const tag of scenario.tags) if (!allowed.has(tag)) errors.push(`Scenario '${scenario.id}' uses unsupported tag '${tag}'`);
  }

  if (scenario.steps !== undefined) {
    if (!Array.isArray(scenario.steps)) errors.push(`Scenario '${scenario.id}' steps must be an array`);
    else validateSteps(scenario, options, errors);
  }
  if (scenario.assertions !== undefined) {
    if (!Array.isArray(scenario.assertions)) errors.push(`Scenario '${scenario.id}' assertions must be an array`);
    else validateAssertions(scenario.id, scenario.assertions, errors);
  }
  if (!scenario.initialState && !scenario.world && !scenario.actors && !scenario.resources && !scenario.objectives) {
    warnings.push(`Scenario '${scenario.id}' does not define initialState, world, actors, resources, or objectives`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

function validateSteps(scenario: ZeusScenario, options: ZeusScenarioValidationOptions, errors: string[]) {
  const allowedStepTypes = options.allowedStepTypes ? new Set(options.allowedStepTypes) : undefined;
  for (const [index, step] of (scenario.steps ?? []).entries()) {
    if (!isObject(step)) {
      errors.push(`Scenario '${scenario.id}' step ${index} must be an object`);
      continue;
    }
    if (typeof step.type !== "string" || step.type.length === 0) errors.push(`Scenario '${scenario.id}' step ${index} requires type`);
    if (allowedStepTypes && typeof step.type === "string" && !allowedStepTypes.has(step.type)) {
      errors.push(`Scenario '${scenario.id}' step ${index} uses unsupported type '${step.type}'`);
    }
  }
}

function validateAssertions(scenarioId: string, assertions: readonly ZeusScenarioAssertion[], errors: string[]) {
  for (const [index, assertion] of assertions.entries()) {
    if (!isObject(assertion)) {
      errors.push(`Scenario '${scenarioId}' assertion ${index} must be an object`);
      continue;
    }
    if (typeof assertion.path !== "string" || assertion.path.length === 0) errors.push(`Scenario '${scenarioId}' assertion ${index} requires path`);
    if (!assertionOperators.has(assertion.operator)) errors.push(`Scenario '${scenarioId}' assertion ${index} has unsupported operator '${assertion.operator}'`);
    if (requiresExpectedValue(assertion.operator) && !Object.hasOwn(assertion, "value")) {
      errors.push(`Scenario '${scenarioId}' assertion ${index} operator '${assertion.operator}' requires value`);
    }
  }
}

function requiresExpectedValue(operator: ZeusScenarioAssertionOperator) {
  return !["exists", "notExists"].includes(operator);
}

function validateStringArray(value: readonly string[], label: string, errors: string[]) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) errors.push(`${label} must be an array of strings`);
}

function requireString(value: unknown, label: string, errors: string[]) {
  if (typeof value !== "string" || value.length === 0) errors.push(`${label} must be a non-empty string`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
