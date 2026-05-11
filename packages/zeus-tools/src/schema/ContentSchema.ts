export type FieldType = "array" | "boolean" | "number" | "object" | "string";

export type ContentFieldRule = {
  type: FieldType;
  required?: boolean;
};

export type ContentSchema = {
  name: string;
  fields: Record<string, ContentFieldRule>;
};

export function validateContentSchema(schema: ContentSchema, value: unknown) {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`${schema.name} must be an object`];
  }
  const record = value as Record<string, unknown>;
  for (const [field, rule] of Object.entries(schema.fields)) {
    const fieldValue = record[field];
    if (fieldValue === undefined) {
      if (rule.required) errors.push(`${schema.name}.${field} is required`);
      continue;
    }
    if (!matchesType(fieldValue, rule.type)) {
      errors.push(`${schema.name}.${field} must be ${rule.type}`);
    }
  }
  return errors;
}

function matchesType(value: unknown, type: FieldType) {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}
