export type ComponentMap<TComponent> = ReadonlyMap<string, TComponent>;

export class ComponentStore<TComponent> {
  private readonly components = new Map<string, TComponent>();

  set(entityId: string, component: TComponent) {
    this.components.set(entityId, structuredClone(component));
  }

  get(entityId: string) {
    const component = this.components.get(entityId);
    return component === undefined ? undefined : structuredClone(component);
  }

  require(entityId: string) {
    const component = this.get(entityId);
    if (component === undefined) throw new Error(`Missing component for entity: ${entityId}`);
    return component;
  }

  delete(entityId: string) {
    return this.components.delete(entityId);
  }

  has(entityId: string) {
    return this.components.has(entityId);
  }

  entries(): ComponentMap<TComponent> {
    return new Map([...this.components.entries()].map(([id, component]) => [id, structuredClone(component)]));
  }
}
