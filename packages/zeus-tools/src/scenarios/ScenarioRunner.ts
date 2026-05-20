import type {
  ZeusScenario,
  ZeusScenarioAdapter,
  ZeusScenarioAssertionResult,
} from "./ScenarioTypes.js";
import { evaluateZeusScenarioAssertions } from "./ScenarioAssertions.js";

export type ZeusScenarioRunOptions<TState, TScenario extends ZeusScenario = ZeusScenario> = {
  scenario: TScenario;
  adapter: ZeusScenarioAdapter<TState, TScenario>;
  ticks?: number;
  dt?: number;
};

export type ZeusScenarioRunResult<TState> = {
  state: TState;
  assertions: ZeusScenarioAssertionResult[];
};

export function runZeusScenario<TState, TScenario extends ZeusScenario = ZeusScenario>(
  options: ZeusScenarioRunOptions<TState, TScenario>,
): ZeusScenarioRunResult<TState> {
  let state = options.adapter.applyScenario(options.adapter.createBaseState(options.scenario), options.scenario);
  for (const step of options.scenario.steps ?? []) {
    if (options.adapter.runStep) state = options.adapter.runStep(state, step, options.scenario);
  }
  const ticks = Math.max(0, options.ticks ?? 0);
  const dt = options.dt ?? 1 / 20;
  for (let index = 0; index < ticks; index += 1) {
    if (options.adapter.tick) state = options.adapter.tick(state, dt, options.scenario);
  }
  const assertions = options.adapter.evaluateAssertions
    ? options.adapter.evaluateAssertions(state, options.scenario.assertions ?? [], options.scenario)
    : evaluateZeusScenarioAssertions(state, options.scenario.assertions ?? []);
  return { state, assertions };
}
