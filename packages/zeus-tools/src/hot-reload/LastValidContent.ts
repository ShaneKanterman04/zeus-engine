export type ValidationResult = {
  errors: string[];
};

export class LastValidContent<T> {
  private current?: T;
  private lastErrors: string[] = [];

  constructor(initial?: T) {
    if (initial !== undefined) this.current = structuredClone(initial);
  }

  update(next: T, validate: (value: T) => ValidationResult | string[]) {
    const result = validate(next);
    const errors = Array.isArray(result) ? result : result.errors;
    this.lastErrors = [...errors];
    if (errors.length) {
      return {
        accepted: false,
        value: this.value(),
        errors: this.errors(),
      };
    }
    this.current = structuredClone(next);
    return {
      accepted: true,
      value: this.value(),
      errors: [],
    };
  }

  value() {
    if (this.current === undefined) throw new Error("No valid content has been loaded");
    return structuredClone(this.current);
  }

  errors() {
    return [...this.lastErrors];
  }
}
