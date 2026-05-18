import type { InputState, Vec2 } from "@zeus/core";

export type ZeusInputSnapshot = {
  actions: string[];
  pressed: string[];
  pointer: Vec2;
};

export type CreateInputSnapshotOptions = {
  consumePressed?: boolean;
};

export type ApplyInputSnapshotOptions = {
  derivePressed?: boolean;
};

export function createInputSnapshot(input: InputState, options: CreateInputSnapshotOptions = {}): ZeusInputSnapshot {
  const snapshot = {
    actions: [...input.actions],
    pressed: [...input.pressed],
    pointer: { ...input.pointer },
  };
  if (options.consumePressed) {
    input.pressed.clear();
  }
  return snapshot;
}

export function applyInputSnapshot(snapshot: ZeusInputSnapshot, input: InputState, options: ApplyInputSnapshotOptions = {}) {
  const previousActions = options.derivePressed ? new Set(input.actions) : undefined;
  const pressed = options.derivePressed ? snapshot.actions.filter((action) => !previousActions?.has(action)) : snapshot.pressed;

  input.actions.clear();
  input.pressed.clear();
  for (const action of snapshot.actions) {
    input.actions.add(action);
  }
  for (const action of pressed) {
    input.pressed.add(action);
  }
  input.pointer = { ...snapshot.pointer };
}

export function copyInputState(source: InputState, target: InputState) {
  applyInputSnapshot(createInputSnapshot(source), target);
}
