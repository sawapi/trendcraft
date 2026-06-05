/**
 * Incremental Ulcer Index (Peter Martin & Byron McCann, 1987 / 1989)
 *
 * State category: **Windowed** (two-stage: rolling-max + drawdown^2 mean).
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<UlcerIndexState>` and `fromState` accepts the same.
 *
 * Two-stage canonical formula:
 *   1. rolling_max[j] = max(prices[j-N+1..j])
 *   2. drawdown[j]    = (prices[j] - rolling_max[j]) / rolling_max[j] × 100
 *   3. UI[i]          = sqrt(mean(drawdown[i-N+1..i]^2))
 *
 * Each bar's drawdown is measured against ITS OWN rolling peak, not
 * a peak shared across the window. Warmup is `2 * period - 1` bars
 * (first non-null at count = 2 * period - 1).
 *
 * Reconfig on resume: `prices` is carried forward (raw closes, no
 * period derivation). `drawdowns` is **cleared** — each drawdown is
 * computed against a rolling-max window of the configured period, so
 * the snapshot's drawdowns are invalid for the new period. The
 * indicator re-warms its drawdown buffer naturally as new candles
 * arrive (effective re-warmup = `period_new` bars after the prices
 * buffer is full again).
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

/**
 * Bare state shape for Ulcer Index. Params (`period`, `source`) live
 * in `meta.params` on the wire — they are not part of the bare state.
 */
export type UlcerIndexState = {
  prices: ReturnType<CircularBuffer<number>["snapshot"]>;
  drawdowns: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const ULCER_INDEX_VERSION = 1;

type UlcerIndexParams = {
  period: number;
  source: PriceSource;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<UlcerIndexState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<UlcerIndexState>> {
  const { params, state, reconfigured } = resolveResume<UlcerIndexParams, UlcerIndexState>({
    indicator: "ulcerIndex",
    version: ULCER_INDEX_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14, source: "close" },
  });

  const period = params.period;
  const source = params.source;

  let prices: CircularBuffer<number>;
  let drawdowns: CircularBuffer<number>;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period change. Carry forward the last min(snapshot, newPeriod)
      // raw prices into a buffer sized at the new period.
      //
      // Drawdowns are NOT carried — each snapshot drawdown was
      // computed against a rolling-max window of the OLD period, so
      // they don't represent the new period's per-bar drawdowns.
      // We clear and re-derive going forward.
      const oldPrices = CircularBuffer.fromSnapshot(state.prices);
      prices = new CircularBuffer<number>(period);
      const available = oldPrices.length;
      const carryStart = Math.max(0, available - period);
      for (let i = carryStart; i < available; i++) {
        prices.push(oldPrices.get(i));
      }
      drawdowns = new CircularBuffer<number>(period);
      count = state.count;
    } else {
      prices = CircularBuffer.fromSnapshot(state.prices);
      drawdowns = CircularBuffer.fromSnapshot(state.drawdowns);
      count = state.count;
    }
  } else {
    prices = new CircularBuffer<number>(period);
    drawdowns = new CircularBuffer<number>(period);
    count = 0;
  }

  function rollingMaxOf(buf: CircularBuffer<number>): number {
    let m = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < buf.length; i++) {
      const v = buf.get(i);
      if (v > m) m = v;
    }
    return m;
  }

  function sumSquares(buf: CircularBuffer<number>): number {
    let s = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf.get(i);
      s += v * v;
    }
    return s;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<UlcerIndexState>> = {
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

    getState(): IndicatorSnapshot<UlcerIndexState> {
      return makeSnapshot(
        "ulcerIndex",
        ULCER_INDEX_VERSION,
        { period, source },
        {
          prices: prices.snapshot(),
          drawdowns: drawdowns.snapshot(),
          count,
        },
      );
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
