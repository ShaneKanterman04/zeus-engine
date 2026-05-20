export type ZeusScenarioContentRefs = {
  mapId?: string;
  assetManifestId?: string;
  [key: string]: unknown;
};

export type ZeusScenarioStep = {
  id?: string;
  type: string;
  payload?: unknown;
};

export type ZeusScenarioAssertionOperator =
  | "equals"
  | "notEquals"
  | "exists"
  | "notExists"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "includes";

export type ZeusScenarioAssertion = {
  id?: string;
  path: string;
  operator: ZeusScenarioAssertionOperator;
  value?: unknown;
};

export type ZeusScenario = {
  id: string;
  title: string;
  description?: string;
  gameId: string;
  version: string;
  tags?: readonly string[];
  contentRefs?: ZeusScenarioContentRefs;
  initialState?: unknown;
  world?: unknown;
  actors?: unknown;
  resources?: unknown;
  objectives?: unknown;
  steps?: readonly ZeusScenarioStep[];
  assertions?: readonly ZeusScenarioAssertion[];
  metadata?: Record<string, unknown>;
};

export type ZeusScenarioManifest = {
  version: string;
  gameId: string;
  scenarios: readonly ZeusScenario[];
};

export type ZeusScenarioValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type ZeusScenarioAssertionResult = {
  id?: string;
  path: string;
  operator: ZeusScenarioAssertionOperator;
  ok: boolean;
  actual: unknown;
  expected?: unknown;
  message: string;
};

export type ZeusScenarioAdapter<TState, TScenario extends ZeusScenario = ZeusScenario> = {
  createBaseState(scenario: TScenario): TState;
  applyScenario(state: TState, scenario: TScenario): TState;
  runStep?(state: TState, step: ZeusScenarioStep, scenario: TScenario): TState;
  tick?(state: TState, dt: number, scenario: TScenario): TState;
  evaluateAssertions?(state: TState, assertions: readonly ZeusScenarioAssertion[], scenario: TScenario): ZeusScenarioAssertionResult[];
};
