import type { ZeusScenarioAssertion, ZeusScenarioAssertionResult } from "./ScenarioTypes.js";

export function evaluateZeusScenarioAssertions(state: unknown, assertions: readonly ZeusScenarioAssertion[]): ZeusScenarioAssertionResult[] {
  return assertions.map((assertion) => {
    const actual = valueAtPath(state, assertion.path);
    const ok = evaluateAssertion(actual, assertion);
    return {
      id: assertion.id,
      path: assertion.path,
      operator: assertion.operator,
      ok,
      actual,
      expected: assertion.value,
      message: ok ? `Assertion '${assertion.path}' passed` : `Assertion '${assertion.path}' failed: expected ${assertion.operator} ${formatValue(assertion.value)}, got ${formatValue(actual)}`,
    };
  });
}

export function valueAtPath(value: unknown, path: string): unknown {
  if (path.length === 0) return value;
  let current = value;
  for (const part of path.split(".")) {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(part)) {
      current = current[Number(part)];
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateAssertion(actual: unknown, assertion: ZeusScenarioAssertion) {
  switch (assertion.operator) {
    case "equals":
      return deepEqual(actual, assertion.value);
    case "notEquals":
      return !deepEqual(actual, assertion.value);
    case "exists":
      return actual !== undefined;
    case "notExists":
      return actual === undefined;
    case "gt":
      return typeof actual === "number" && typeof assertion.value === "number" && actual > assertion.value;
    case "gte":
      return typeof actual === "number" && typeof assertion.value === "number" && actual >= assertion.value;
    case "lt":
      return typeof actual === "number" && typeof assertion.value === "number" && actual < assertion.value;
    case "lte":
      return typeof actual === "number" && typeof assertion.value === "number" && actual <= assertion.value;
    case "includes":
      return Array.isArray(actual) ? actual.some((entry) => deepEqual(entry, assertion.value)) : typeof actual === "string" && typeof assertion.value === "string" && actual.includes(assertion.value);
  }
}

function deepEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
