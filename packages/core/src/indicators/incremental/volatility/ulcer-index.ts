/**
 * Incremental Ulcer Index (Peter Martin & Byron McCann, 1987 / 1989)
 *
 * Two-stage canonical formula:
 *   1. rolling_max[j] = max(prices[j-N+1..j])
 *   2. drawdown[j]    = (prices[j] - rolling_max[j]) / rolling_max[j] × 100
 *   3. UI[i]          = sqrt(mean(drawdown[i-N+1..i]^2))
 *
 * Each bar's drawdown is measured against ITS OWN rolling peak, not
 * a peak shared across the window. Warmup is `2 * period - 1` bars
 * (first non-null at count = 2 * period - 1).
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type UlcerIndexState = {
  period: number;
  source: PriceSource;
  prices: ReturnType<CircularBuffer<number>["snapshot"]>;
  drawdowns: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/**
 * Create an incremental Ulcer Index indicator
 *
 * @example
 * ```ts
 * const ui = createUlcerIndex({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = ui.next(candle);
 *   if (ui.isWarmedUp) console.log(`Ulcer Index: ${value?.toFixed(4)}`);
 * }
 * ```
 */
export function createUlcerIndex(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<UlcerIndexState>,
): IncrementalIndicator<number | null, UlcerIndexState> {
  const period = options.period ?? 14;
  const source: PriceSource = options.source ?? "close";

  let prices: CircularBuffer<number>;
  let drawdowns: CircularBuffer<number>;
  let count: number;

  if (warmUpOptions?.fromState) {
    // Detect the legacy single-buffer snapshot shape (released
    // before the canonical Peter Martin two-stage rewrite). We can't
    // back-compute the per-bar drawdowns the new algorithm needs,
    // so the only safe path is a clear error instead of silently
    // returning wrong values.
    const s = warmUpOptions.fromState as UlcerIndexState & {
      buffer?: ReturnType<CircularBuffer<number>["snapshot"]>;
    };
    if (s.buffer !== undefined && (s.prices === undefined || s.drawdowns === undefined)) {
      throw new Error(
        "createUlcerIndex: legacy state snapshot detected (single 'buffer' field). " +
          "Ulcer Index switched to the canonical Peter Martin two-stage formula and the state schema now uses 'prices' and 'drawdowns' buffers. " +
          "Re-warm the indicator from candles instead of restoring from the old snapshot.",
      );
    }
    prices = CircularBuffer.fromSnapshot(s.prices);
    drawdowns = CircularBuffer.fromSnapshot(s.drawdowns);
    count = s.count;
  } else {
    prices = new CircularBuffer<number>(period);
    drawdowns = new CircularBuffer<number>(period);
    count = 0;
  }

  function rollingMaxOf(buf: CircularBuffer<number>, withExtra?: number): number {
    let m = withExtra !== undefined ? withExtra : Number.NEGATIVE_INFINITY;
    for (let i = 0; i < buf.length; i++) {
      const v = buf.get(i);
      if (v > m) m = v;
    }
    return m;
  }

  function sumSquares(buf: CircularBuffer<number>, withExtra?: number): number {
    let s = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf.get(i);
      s += v * v;
    }
    if (withExtra !== undefined) s += withExtra * withExtra;
    return s;
  }

  const indicator: IncrementalIndicator<number | null, UlcerIndexState> = {
    next(candle: NormalizedCandle) {
      count++;
      const price = getSourcePrice(candle, source);
      prices.push(price);

      // Stage 1 — emit a drawdown only once we have a full prices window
      if (prices.length === period) {
        const rmax = rollingMaxOf(prices);
        const dd = rmax !== 0 ? ((price - rmax) / rmax) * 100 : 0;
        drawdowns.push(dd);
      }

      // Stage 2 — UI requires a full drawdown window (period entries)
      if (drawdowns.length < period) {
        return { time: candle.time, value: null };
      }

      const ss = sumSquares(drawdowns);
      return { time: candle.time, value: Math.sqrt(ss / period) };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      // Simulate prices.push(price) without mutating
      const pricesWillBeFull = prices.length + 1 >= period || prices.isFull;
      let nextDrawdown: number | null = null;
      if (pricesWillBeFull) {
        // After push: oldest drops if full, new price added
        let rmax = price;
        if (prices.isFull) {
          // Skip oldest entry (index 0) because it would drop after push
          for (let i = 1; i < prices.length; i++) {
            const v = prices.get(i);
            if (v > rmax) rmax = v;
          }
        } else {
          // Buffer not yet full — all current entries remain after push
          for (let i = 0; i < prices.length; i++) {
            const v = prices.get(i);
            if (v > rmax) rmax = v;
          }
        }
        nextDrawdown = rmax !== 0 ? ((price - rmax) / rmax) * 100 : 0;
      }

      // Simulate drawdowns.push(nextDrawdown) and check if window full
      const willHaveFullDrawdownWindow =
        nextDrawdown !== null && (drawdowns.length + 1 >= period || drawdowns.isFull);
      if (!willHaveFullDrawdownWindow) {
        return { time: candle.time, value: null };
      }

      // Sum of squares: existing window minus the dropping entry, plus new dd
      let ss = 0;
      const dropIdx = drawdowns.isFull ? 0 : -1;
      for (let i = 0; i < drawdowns.length; i++) {
        if (i === dropIdx) continue;
        const v = drawdowns.get(i);
        ss += v * v;
      }
      ss += (nextDrawdown as number) * (nextDrawdown as number);
      return { time: candle.time, value: Math.sqrt(ss / period) };
    },

    getState(): UlcerIndexState {
      return {
        period,
        source,
        prices: prices.snapshot(),
        drawdowns: drawdowns.snapshot(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return drawdowns.length >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
