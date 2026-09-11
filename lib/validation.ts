export const MAX_NAME_LENGTH = 100;
export const MAX_ID_LENGTH = 128;
export const MAX_WEIGHT = 2_000;

type Parsed<T> = { value: T; error?: never } | { value?: never; error: string };

export function requiredString(
  value: unknown,
  field: string,
  maxLength: number = MAX_ID_LENGTH
): Parsed<string> {
  if (typeof value !== "string") {
    return { error: `${field} is required` };
  }

  const normalized = value.trim();
  if (!normalized) {
    return { error: `${field} is required` };
  }
  if (normalized.length > maxLength) {
    return { error: `${field} must be ${maxLength} characters or fewer` };
  }

  return { value: normalized };
}

export function requiredName(value: unknown, field = "name"): Parsed<string> {
  return requiredString(value, field, MAX_NAME_LENGTH);
}

export function positiveNumber(value: unknown, field: string): Parsed<number> {
  const normalized = typeof value === "string" ? value.trim() : value;
  if (normalized === "" || normalized === undefined || normalized === null) {
    return { error: `${field} is required` };
  }

  const parsed = typeof normalized === "number" ? normalized : Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_WEIGHT) {
    return { error: `${field} must be greater than 0 and no more than ${MAX_WEIGHT}` };
  }

  return { value: parsed };
}
