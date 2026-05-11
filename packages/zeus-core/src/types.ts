export type Vec2 = {
  x: number;
  y: number;
};

export type EntityId = string;

export type Entity = {
  id: EntityId;
  kind: string;
  position: Vec2;
  radius: number;
  solid?: boolean;
  interactable?: boolean;
  label?: string;
  color?: string;
  data?: Record<string, unknown>;
};

export type ZeusScene = {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
};

export type ZeusSystem<TState> = {
  name: string;
  update(state: TState, dt: number): void;
};

export type InputState = {
  actions: Set<string>;
  pressed: Set<string>;
  pointer: Vec2;
  consumePressed?(action: string): boolean;
};
