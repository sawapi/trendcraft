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

export type SyncOptions = {
  /** Mirror crosshair hover across charts (default: true) */
  crosshair?: boolean;
  /** Mirror visible range (pan/zoom) across charts (default: false) */
  viewport?: boolean;
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
  const syncViewport = opts.viewport === true;
  if (charts.length < 2 || (!syncCrosshair && !syncViewport)) {
    return () => {};
  }

  // Set at the start of each forward cycle; sync events observed while set
  // are ignored, so we never feed our own changes back into the network.
  let forwarding = false;
  const handlers: Array<() => void> = [];

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
        if (!range || typeof range.startTime !== "number" || typeof range.endTime !== "number") {
          return;
        }
        forwarding = true;
        try {
          for (const target of charts) {
            if (target === source) continue;
            target.setVisibleRange(range.startTime, range.endTime);
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
