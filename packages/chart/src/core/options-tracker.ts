/**
 * Tracks the `ChartOptions` a chart has already consumed so a framework
 * wrapper can forward only the fields that actually changed.
 *
 * A wrapper re-runs when its `options` prop changes identity, which in React
 * happens on every parent render for an inline literal and in Vue on any deep
 * mutation. Replaying the whole object into `applyOptions()` re-dispatches
 * every setter and marks the chart for a redraw on every render. The tracker
 * keeps a structural snapshot of what was last applied and yields the
 * top-level fields whose values differ. (Creation-only fields such as
 * `locale` are compared against the live value by `applyOptions` itself, so
 * an unchanged replay would not warn either way.)
 *
 * A field that disappears from `options` is not reported, and stays in the
 * snapshot: `applyOptions` treats an absent field as "leave as is", so the
 * chart still holds the old value and re-supplying it later is not a change.
 * The same holds one level down — a nested field that is `undefined` reads
 * as absent, because `applyOptions` resolves nested fields with `??`.
 */

import { isPlainObject, optionsEqual } from "./options-equal";
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
        if (optionsEqual(live, snapshot[key])) continue;
        // Forward the live value, not a clone, so function identity and
        // framework reactivity wrappers reach the chart unchanged.
        changed[key] = live;
        snapshot[key] = clone(live);
      }
      return Object.keys(changed).length > 0 ? (changed as Partial<ChartOptions>) : null;
    },
  };
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
