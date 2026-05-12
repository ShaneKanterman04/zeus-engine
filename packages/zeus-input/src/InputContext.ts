import type { InputState, Vec2 } from "@zeus/core";

export type InputLayer = "gameplay" | "ui" | "debug";

export type InputBindings = Record<string, string>;

export type InputSettings = {
  bindings: InputBindings;
};

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
  Digit1: "equip-hands",
  Digit2: "equip-hatchet",
  Digit3: "equip-rifle",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  ControlLeft: "crouch",
  ControlRight: "crouch",
  KeyC: "crouch",
};

export function createInputSettings(bindings: InputBindings = defaultBindings): InputSettings {
  return { bindings: { ...bindings } };
}

export class InputContext {
  readonly state: InputState = {
    actions: new Set(),
    pressed: new Set(),
    pointer: { x: 0, y: 0 },
    consumePressed: (action) => this.consumePressed(action),
  };
  private capturedBy?: InputLayer;
  private bindings: InputBindings;
  private readonly heldCodes = new Set<string>();

  constructor(settings: InputSettings | InputBindings = createInputSettings()) {
    this.bindings = isInputSettings(settings) ? { ...settings.bindings } : { ...settings };
  }

  capture(layer: InputLayer) {
    this.capturedBy = layer;
    this.heldCodes.clear();
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
    this.heldCodes.add(code);
    if (!this.state.actions.has(action)) {
      this.state.pressed.add(action);
    }
    this.state.actions.add(action);
    return true;
  }

  keyUp(code: string) {
    const action = this.bindings[code];
    if (!action) return false;
    this.heldCodes.delete(code);
    if (!this.isActionHeld(action)) {
      this.state.actions.delete(action);
    }
    return true;
  }

  getSettings(): InputSettings {
    return createInputSettings(this.bindings);
  }

  getBindings() {
    return { ...this.bindings };
  }

  setBinding(code: string, action: string) {
    this.bindings[code] = action;
    this.rebuildHeldActions();
  }

  removeBinding(code: string) {
    delete this.bindings[code];
    this.heldCodes.delete(code);
    this.rebuildHeldActions();
  }

  replaceBindings(bindings: InputBindings) {
    this.bindings = { ...bindings };
    this.rebuildHeldActions();
  }

  pointerMove(pointer: Vec2) {
    this.state.pointer = { ...pointer };
  }

  consumePressed(action: string) {
    const hadAction = this.state.pressed.has(action);
    this.state.pressed.delete(action);
    return hadAction;
  }

  private isActionHeld(action: string) {
    for (const code of this.heldCodes) {
      if (this.bindings[code] === action) return true;
    }
    return false;
  }

  private rebuildHeldActions() {
    this.state.actions.clear();
    this.state.pressed.clear();
    for (const code of this.heldCodes) {
      const action = this.bindings[code];
      if (action) this.state.actions.add(action);
    }
  }
}

function isInputSettings(settings: InputSettings | InputBindings): settings is InputSettings {
  return typeof settings.bindings === "object" && settings.bindings !== null;
}
