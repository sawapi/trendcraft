/**
 * Structural equality for option values.
 *
 * Plain objects and arrays compare by content, everything else (functions,
 * class instances, primitives) by identity. Used by the wrapper-side options
 * tracker to find changed fields and by `applyOptions` to tell a re-supplied
 * creation-only value from a change.
 */

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Structural equality for plain data; identity (`Object.is`) for the rest.
 * An `undefined` field reads as absent, so `{ a: 1, b: undefined }` equals `{ a: 1 }`.
 *
 * @example
 * ```ts
 * optionsEqual({ months: ["Jan"] }, { months: ["Jan"] }); // true
 * optionsEqual(() => 1, () => 1); // false — functions compare by identity
 * ```
 */
export function optionsEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => optionsEqual(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = definedKeys(a);
    const kb = definedKeys(b);
    return ka.length === kb.length && ka.every((k) => optionsEqual(a[k], b[k]));
  }
  return false;
}

/** Own keys whose value is not `undefined` — an `undefined` field reads as absent. */
function definedKeys(o: Record<string, unknown>): string[] {
  return Object.keys(o).filter((k) => o[k] !== undefined);
}
