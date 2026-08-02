/**
 * syncCharts — mirror crosshair and/or visible range across multiple chart instances.
 *
 * The primary use case is multi-timeframe (MTF) layouts: hovering a bar on the 1h
 * chart highlights the corresponding bar on the 4h chart. Chart instances are
 * expected to share a time axis (same symbol, overlapping history); time values
 * are translated to bar indices via each chart's own data, so differing bar
 * alignments work as long as their `time` values are comparable.
 *
 * @example
 * const dispose = syncCharts([chart1, chart2]);
 * // later
 * dispose();
 */

import type { ChartInstance, CrosshairMoveData, VisibleRangeChangeData } from "../core/types";
import {
  APPLY_WITH_ORIGIN,
  readViewportOrigin,
  type ViewportOrigin,
  type ViewportOriginCarrier,
} from "../core/viewport-origin";

/** Distinct id per syncCharts group, so overlapping groups never consume
 *  each other's completion events. */
let nextSyncGroupId = 0;

export type SyncOptions = {
  /** Mirror crosshair hover across charts (default: true) */
  crosshair?: boolean;
  /**
   * Mirror visible range (pan/zoom) across charts (default: false).
   *
   * - `true`: mirror via the time-based range. Correct for multi-timeframe
   *   layouts — each chart translates the times to its own bar indices —
   *   but the time axis saturates at the last bar, so empty space after it
   *   (a right-edge margin) is not mirrored.
   * - `"logical"`: mirror via the unclamped logical (bar-index) range,
   *   preserving margins past the last bar. Only valid when every chart
   *   shows the SAME candle array (same symbol and timeframe) — bar index
   *   100 on a 1h chart and on a 4h chart are different times. Falls back
   *   to the time-based range for payloads without a logical range.
   */
  viewport?: boolean | "logical";
};

/**
 * Link the given charts so that interactions on one mirror to the others.
 * Returns a disposer that detaches all listeners.
 *
 * Implementation detail: a re-entry guard prevents the ping-pong that would
 * otherwise occur when setCrosshair() on chart B triggers its own event,
 * which would then be forwarded back to chart A, and so on.
 */
export function syncCharts(charts: ChartInstance[], opts: SyncOptions = {}): () => void {
  const syncCrosshair = opts.crosshair !== false;
  const syncViewport = opts.viewport === true || opts.viewport === "logical";
  const logicalViewport = opts.viewport === "logical";
  if (charts.length < 2 || (!syncCrosshair && !syncViewport)) {
    return () => {};
  }

  // Set at the start of each forward cycle; sync events observed while set
  // are ignored, so we never feed our own changes back into the network.
  // This guards the SYNCHRONOUS part only (charts with animation disabled
  // emit inside the setter call); asynchronous completion events — the
  // default, with a ~300ms range animation — are identified by the
  // origin/generation token below instead. Matching completions are
  // consumed exactly once; a stale generation (superseded forward) is
  // dropped without touching the newer expectation; anything without our
  // token (user gestures, other groups, programmatic calls) is treated as
  // fresh input. Range VALUES are never used to infer sync provenance —
  // a time-mode multi-timeframe target quantizes forwarded times to its
  // own bars, so the sender cannot predict the resulting range.
  let forwarding = false;
  const groupId = `sync#${nextSyncGroupId++}`;
  const generations = new Map<ChartInstance, number>();
  const pending = new Map<ChartInstance, ViewportOrigin>();
  const handlers: Array<() => void> = [];

  /** Forward a viewport mutation to `target` with provenance when supported. */
  function forwardViewport(target: ChartInstance, apply: () => void): void {
    const carrier = target as Partial<ViewportOriginCarrier>;
    if (typeof carrier[APPLY_WITH_ORIGIN] !== "function") {
      apply();
      return;
    }
    const generation = (generations.get(target) ?? 0) + 1;
    generations.set(target, generation);
    const token: ViewportOrigin = { origin: groupId, generation };
    pending.set(target, token);
    carrier[APPLY_WITH_ORIGIN]?.(token, apply);
  }

  for (const source of charts) {
    if (syncCrosshair) {
      const onCrosshair = (data: unknown): void => {
        if (forwarding) return;
        const move = data as CrosshairMoveData & { time: number | null };
        const time = move?.time ?? null;
        forwarding = true;
        try {
          for (const target of charts) {
            if (target === source) continue;
            target.setCrosshair(time);
          }
        } finally {
          forwarding = false;
        }
      };
      source.on("crosshairMove", onCrosshair);
      handlers.push(() => source.off("crosshairMove", onCrosshair));
    }

    if (syncViewport) {
      const onRange = (data: unknown): void => {
        if (forwarding) return;
        const range = data as VisibleRangeChangeData;
        if (!range) return;
        // Async completion of a range we forwarded to this chart?
        const token = readViewportOrigin(range);
        if (token && token.origin === groupId) {
          const expected = pending.get(source);
          if (expected && expected.generation === token.generation) {
            pending.delete(source); // consume exactly once
          }
          // Stale generation (superseded forward): drop silently — it must
          // neither propagate old state nor clear the newer expectation.
          return;
        }
        // "logical" mode mirrors the unclamped bar-index range (preserves
        // margins past the last bar, same-data charts only, see SyncOptions);
        // the default mirrors times so MTF charts translate per their own data.
        const logical = range.logicalRange;
        const useLogical =
          logicalViewport &&
          logical !== undefined &&
          Number.isFinite(logical.from) &&
          Number.isFinite(logical.to);
        if (
          !useLogical &&
          (typeof range.startTime !== "number" || typeof range.endTime !== "number")
        ) {
          return;
        }
        forwarding = true;
        try {
          for (const target of charts) {
            if (target === source) continue;
            if (useLogical) {
              forwardViewport(target, () =>
                target.setVisibleLogicalRange(logical.from, logical.to),
              );
            } else {
              forwardViewport(target, () => target.setVisibleRange(range.startTime, range.endTime));
            }
          }
        } finally {
          forwarding = false;
        }
      };
      source.on("visibleRangeChange", onRange);
      handlers.push(() => source.off("visibleRangeChange", onRange));
    }
  }

  return () => {
    for (const detach of handlers) detach();
  };
}
