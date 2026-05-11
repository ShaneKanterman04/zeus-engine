import type { InputState, Vec2 } from "@zeus/core";

export type InputLayer = "gameplay" | "ui" | "debug";

export type InputBindings = Record<string, string>;

export const defaultBindings: InputBindings = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyE: "interact",
  Space: "fire",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  ControlLeft: "crouch",
  ControlRight: "crouch",
  KeyC: "crouch",
};

export class InputContext {
  readonly state: InputState = {
    actions: new Set(),
    pressed: new Set(),
    pointer: { x: 0, y: 0 },
    consumePressed: (action) => this.consumePressed(action),
  };
  private capturedBy?: InputLayer;

  constructor(private readonly bindings: InputBindings = defaultBindings) {}

  capture(layer: InputLayer) {
    this.capturedBy = layer;
    this.state.actions.clear();
    this.state.pressed.clear();
  }

  release(layer: InputLayer) {
    if (this.capturedBy === layer) {
      this.capturedBy = undefined;
    }
  }

  isCaptured() {
    return this.capturedBy !== undefined;
  }

  keyDown(code: string) {
    const action = this.bindings[code];
    if (!action || this.capturedBy) return false;
    if (!this.state.actions.has(action)) {
      this.state.pressed.add(action);
    }
    this.state.actions.add(action);
    return true;
  }

  keyUp(code: string) {
    const action = this.bindings[code];
    if (!action) return false;
    this.state.actions.delete(action);
    return true;
  }

  pointerMove(pointer: Vec2) {
    this.state.pointer = { ...pointer };
  }

  consumePressed(action: string) {
    const hadAction = this.state.pressed.has(action);
    this.state.pressed.delete(action);
    return hadAction;
  }
}
