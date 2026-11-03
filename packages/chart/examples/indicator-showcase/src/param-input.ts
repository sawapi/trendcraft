/**
 * Helpers for indicator parameters: the number inputs, the check that keeps
 * an out-of-range value from reaching the indicator, and distinct params
 * for repeated "+" instances.
 */
import type { ParamSchema } from "trendcraft";

/**
 * Whether `value` is acceptable for a parameter: a finite number within the
 * schema's min / max, and a whole number when the step is whole (periods).
 * An out-of-range period made the indicator throw or draw nothing.
 */
export function isValidParam(p: ParamSchema, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (p.min !== undefined && value < p.min) return false;
  if (p.max !== undefined && value > p.max) return false;
  if (p.step !== undefined && Number.isInteger(p.step) && !Number.isInteger(value)) return false;
  return true;
}

/** A number input for `p`, with the schema's min / max / step. */
export function createParamInput(p: ParamSchema, value: number): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(value);
  if (p.min !== undefined) input.min = String(p.min);
  if (p.max !== undefined) input.max = String(p.max);
  if (p.step !== undefined) input.step = String(p.step);
  input.style.cssText =
    "width:70px;padding:4px 6px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:12px;text-align:right;outline:none;";
  input.addEventListener("focus", () => {
    input.style.borderColor = "var(--accent)";
  });
  input.addEventListener("blur", () => {
    input.style.borderColor = "var(--border)";
  });
  return input;
}

/**
 * When the user clicks "+" repeatedly without editing params, we'd end up
 * with identical overlapping instances. Auto-bump the first numeric param
 * until the resulting param tuple is not in `used` (the JSON of every
 * existing instance's params for this preset).
 */
export function bumpUntilUnique(
  schemas: readonly ParamSchema[],
  params: Record<string, unknown>,
  used: readonly string[],
): Record<string, unknown> {
  const schema = schemas.find((p) => typeof p.default === "number");
  if (!schema) return params;
  const key = schema.key;
  const result = { ...params };
  const step = typeof schema.step === "number" ? schema.step : 1;
  const max = typeof schema.max === "number" ? schema.max : Number.POSITIVE_INFINITY;
  for (let i = 0; i < 50; i++) {
    if (!used.includes(JSON.stringify(result))) return result;
    const cur = Number(result[key] ?? 0);
    const next = cur + Math.max(step, Math.round(cur * 0.5));
    if (next > max) break;
    result[key] = next;
  }
  return result;
}
