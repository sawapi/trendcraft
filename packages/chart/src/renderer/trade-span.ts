import type { DataLayer } from "../core/data-layer";

/** Where a trade sits in the loaded candles. */
export type TradeSpan = {
  /** Entry bar, or the first bar when the entry is before the data */
  entryIdx: number;
  /** Exit bar, or the last bar when the exit is after the data */
  exitIdx: number;
  entryInRange: boolean;
  exitInRange: boolean;
};

/**
 * Place a trade on the loaded candles, clipping it to the data. Returns
 * `null` when the trade lies entirely before the first or after the last
 * candle, as in a replay that has not reached it yet.
 */
export function tradeSpan(
  dataLayer: DataLayer,
  entryTime: number,
  exitTime: number,
): TradeSpan | null {
  const count = dataLayer.candleCount;
  if (count === 0) return null;
  const first = dataLayer.timeAt(0) as number;
  const last = dataLayer.timeAt(count - 1) as number;
  if (entryTime > last || exitTime < first) return null;
  const entryInRange = entryTime >= first;
  const exitInRange = exitTime <= last;
  return {
    entryIdx: entryInRange ? dataLayer.indexAtTime(entryTime) : 0,
    exitIdx: exitInRange ? dataLayer.indexAtTime(exitTime) : count - 1,
    entryInRange,
    exitInRange,
  };
}
