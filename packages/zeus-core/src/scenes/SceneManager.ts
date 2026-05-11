export type ManagedScene = {
  name: string;
  enter?(): void;
  exit?(): void;
  update(dt: number): void;
};

export class SceneManager {
  private readonly scenes = new Map<string, ManagedScene>();
  private active?: ManagedScene;

  register(scene: ManagedScene) {
    if (this.scenes.has(scene.name)) throw new Error(`Scene already registered: ${scene.name}`);
    this.scenes.set(scene.name, scene);
  }

  activate(name: string) {
    const next = this.scenes.get(name);
    if (!next) throw new Error(`Unknown scene: ${name}`);
    if (this.active?.name === name) return;
    this.active?.exit?.();
    this.active = next;
    this.active.enter?.();
  }

  update(dt: number) {
    this.active?.update(dt);
  }

  get activeSceneName() {
    return this.active?.name;
  }
}
