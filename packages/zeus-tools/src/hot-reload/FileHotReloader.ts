import { watch, type FSWatcher } from "node:fs";
import { readFile } from "node:fs/promises";
import { LastValidContent, type ValidationResult } from "./LastValidContent.js";

export class FileHotReloader<T> {
  private watcher?: FSWatcher;
  readonly cache: LastValidContent<T>;

  constructor(
    initial: T,
    private readonly parse: (source: string) => T,
    private readonly validate: (value: T) => ValidationResult | string[],
  ) {
    this.cache = new LastValidContent(initial);
  }

  watch(path: string, onReload: (value: T, errors: string[]) => void) {
    this.close();
    this.watcher = watch(path, async () => {
      const source = await readFile(path, "utf8");
      const result = this.cache.update(this.parse(source), this.validate);
      onReload(result.value, result.errors);
    });
  }

  close() {
    this.watcher?.close();
    this.watcher = undefined;
  }
}
