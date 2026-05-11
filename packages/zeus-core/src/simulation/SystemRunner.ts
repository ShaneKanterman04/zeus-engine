export type RunnableSystem<TState> = {
  name: string;
  update(state: TState, dt: number): void;
};

export class SystemRunner<TState> {
  private readonly systems: RunnableSystem<TState>[] = [];

  add(system: RunnableSystem<TState>) {
    if (this.systems.some((item) => item.name === system.name)) {
      throw new Error(`System already registered: ${system.name}`);
    }
    this.systems.push(system);
  }

  update(state: TState, dt: number) {
    for (const system of this.systems) {
      system.update(state, dt);
    }
  }

  list() {
    return this.systems.map((system) => system.name);
  }
}
