/**
 * Tracks the `ChartOptions` a chart has already consumed so a framework
 * wrapper can forward only the fields that actually changed.
 *
 * A wrapper re-runs when its `options` prop changes identity, which in React
 * happens on every parent render for an inline literal and in Vue on any deep
 * mutation. Replaying the whole object into `applyOptions()` re-dispatches
 * every setter and — for creation-only fields such as `locale` or
 * `pixelRatio` — emits a "cannot be changed at runtime" warning for a value
 * the user never changed. The tracker keeps a structural snapshot of what
 * was last applied and yields the top-level fields whose values differ.
 *
 * A field that disappears from `options` is not reported, and stays in the
 * snapshot: `applyOptions` treats an absent field as "leave as is", so the
 * chart still holds the old value and re-supplying it later is not a change.
 * The same holds one level down — a nested field that is `undefined` reads
 * as absent, because `applyOptions` resolves nested fields with `??`.
 */

import type { ChartOptions } from "./types";

export type ChartOptionsTracker = {
  /**
   * Fields of `next` whose values differ from the last snapshot, or `null`
   * when nothing changed. Advances the snapshot either way.
   */
  diff(next: Partial<ChartOptions> | undefined): Partial<ChartOptions> | null;
};

/**
 * Create a tracker seeded with the options the chart was created from.
 *
 * @example
 * ```ts
 * const initial = { locale: { volume: "Vol" }, watermark: "AAPL" };
 * const chart = createChart(container, initial);
 * const tracker = createChartOptionsTracker(initial);
 * // Later, when the wrapper's `options` prop changes — only `watermark`
 * // reaches the chart; the unchanged creation-only `locale` does not warn.
 * const changed = tracker.diff({ locale: { volume: "Vol" }, watermark: "MSFT" });
 * if (changed) chart.applyOptions(changed); // { watermark: "MSFT" }
 * ```
 */
export function createChartOptionsTracker(
  initial: Partial<ChartOptions> | undefined,
): ChartOptionsTracker {
  const snapshot = clone(initial ?? {}) as Record<string, unknown>;
  return {
    diff(next) {
      const changed: Record<string, unknown> = {};
      for (const [key, live] of Object.entries(next ?? {})) {
        if (live === undefined) continue;
        if (equal(live, snapshot[key])) continue;
        // Forward the live value, not a clone, so function identity and
        // framework reactivity wrappers reach the chart unchanged.
        changed[key] = live;
        snapshot[key] = clone(live);
      }
      return Object.keys(changed).length > 0 ? (changed as Partial<ChartOptions>) : null;
    },
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Deep copy of plain data; functions and class instances stay by reference. */
function clone(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(clone);
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) out[k] = clone(v[k]);
    return out;
  }
  return v;
}

/** Structural equality for plain data; identity (`Object.is`) for the rest. */
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = definedKeys(a);
    const kb = definedKeys(b);
    return ka.length === kb.length && ka.every((k) => equal(a[k], b[k]));
  }
  return false;
}

/** Own keys whose value is not `undefined` — an `undefined` field reads as absent. */
function definedKeys(o: Record<string, unknown>): string[] {
  return Object.keys(o).filter((k) => o[k] !== undefined);
}
