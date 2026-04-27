/**
 * connectLivePrimitives — drive primitive plugins (S/R Zones, SMC, Wyckoff,
 * Kill Zones, Regime Heatmap, etc.) from a LiveSource by recomputing their
 * data on `candleComplete` and pushing the result to the plugin handle's
 * `update()` method.
 *
 * Primitives use `chart.registerPrimitive()` instead of `chart.addIndicator()`,
 * so they're invisible to {@link connectIndicators}'s live event loop. Until
 * each primitive grows an incremental factory, this helper provides a simple
 * batch-recompute fallback: O(N) per candle, but plugins only fire on
 * candleComplete so the cost is bounded.
 *
 * @example
 * ```ts
 * import { connectIndicators, connectLivePrimitives, connectSrConfluence, srZones } from "@trendcraft/chart";
 *
 * const conn = connectIndicators(chart, { presets, candles, live: source });
 * const sr = connectSrConfluence(chart, srZones(source.completedCandles));
 *
 * const live = connectLivePrimitives(source, [
 *   { recompute: (candles) => srZones(candles), handle: sr, name: "sr" },
 * ]);
 *
 * // later
 * live.disconnect();
 * conn.disconnect();
 * ```
 */

import type { LiveSource } from "./connect-indicators";
import type { SourceCandle } from "./helpers";

/**
 * One primitive plugin to keep in sync with a {@link LiveSource}. The handle's
 * {@link LivePrimitiveHandle.update} method is called with the result of
 * `recompute(source.completedCandles)` on every candleComplete event.
 */
export type LivePrimitiveSpec<T = unknown> = {
  /** Recompute the primitive's data from the current candle history. */
  recompute: (candles: readonly SourceCandle[]) => T;
  /** Plugin handle whose `update(data)` will be called with the recomputed result. */
  handle: LivePrimitiveHandle<T>;
  /** Optional name used in error logs to help identify which spec failed. */
  name?: string;
};

/** Minimal duck-typed shape of a primitive plugin handle (e.g. from `connectSrConfluence`). */
export type LivePrimitiveHandle<T> = {
  update: (data: T) => void;
};

export type LivePrimitivesConnection = {
  /** Disconnect from candleComplete events. Idempotent. */
  disconnect(): void;
  /**
   * Manually trigger a recompute of all specs. Useful right after construction
   * to seed handles with the current history, or after host code has mutated
   * `source.completedCandles` outside the live event flow.
   * No-op once `disconnect()` has been called.
   */
  recomputeAll(): void;
};

export function connectLivePrimitives(
  source: LiveSource,
  // Per-spec T must vary across the array; `unknown` would force every
  // handle.update to accept unknown and break strongly-typed plugin handles
  // (e.g. `connectSrConfluence().update`).
  // biome-ignore lint/suspicious/noExplicitAny: see comment above
  specs: readonly LivePrimitiveSpec<any>[],
): LivePrimitivesConnection {
  let connected = true;

  const runSpecs = (candles: readonly SourceCandle[]): void => {
    for (const spec of specs) {
      let value: unknown;
      try {
        value = spec.recompute(candles);
      } catch (e) {
        console.error(
          `[@trendcraft/chart] connectLivePrimitives recompute error${spec.name ? ` (${spec.name})` : ""}:`,
          e,
        );
        continue;
      }
      try {
        spec.handle.update(value);
      } catch (e) {
        console.error(
          `[@trendcraft/chart] connectLivePrimitives handle.update error${spec.name ? ` (${spec.name})` : ""}:`,
          e,
        );
      }
    }
  };

  const unsub = source.on("candleComplete", () => {
    if (!connected) return;
    runSpecs(source.completedCandles);
  });

  return {
    disconnect(): void {
      if (!connected) return;
      connected = false;
      unsub();
    },
    recomputeAll(): void {
      if (!connected) return;
      runSpecs(source.completedCandles);
    },
  };
}
