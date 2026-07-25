/**
 * Incremental Historical Volatility
 *
 * Standard deviation of log returns over a lookback period, annualized.
 * Uses sample variance (divides by N-1) for statistical correctness.
 *
 * Formula: HV = sqrt(variance(logReturns) * annualFactor) * 100
 *
 * State category: **Windowed** (a fixed-size log-return buffer plus
 * log-return buffer and the recursive `prevPrice` needed to form
 * the next return). Resume with a different `period` carries the
 * return buffer forward; `source` change is refused. `annualFactor` is
 * a resume-invariant param.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import { centeredMoments } from "../../../core/statistics";
import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

/**
 * Bare state shape for Historical Volatility. Params (`period`,
 * `annualFactor`, `source`) live in `meta.params` on the wire.
 */
export type HistoricalVolatilityState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  prevPrice: number | null;
  count: number;
};

/**
 * Per-indicator schema version. Bumped on any breaking state change.
 *
 * v2 dropped the running `sum`/`sumSq`: the variance is now computed from the
 * retained log-return buffer, which is the only state the window needs.
 */
export const HISTORICAL_VOLATILITY_VERSION = 2;

type HistoricalVolatilityParams = {
  period: number;
  annualFactor: number;
  source: PriceSource;
};

/**
 * Create an incremental Historical Volatility indicator
 *
 * @example
 * ```ts
 * const hv = createHistoricalVolatility({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = hv.next(candle);
 *   if (hv.isWarmedUp) console.log(`HV: ${value?.toFixed(2)}%`);
 * }
 * ```
 */
export function createHistoricalVolatility(
  options: { period?: number; annualFactor?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<HistoricalVolatilityState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<HistoricalVolatilityState>> {
  const { params, state, reconfigured } = resolveResume<
    HistoricalVolatilityParams,
    HistoricalVolatilityState
  >({
    indicator: "historicalVolatility",
    version: HISTORICAL_VOLATILITY_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 20, annualFactor: 252, source: "close" },
    resumeInvariantParams: ["annualFactor"],
  });

  const period = requireParam(
    "historicalVolatility",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 2,
    "must be an integer >= 2",
  );
  const annualFactor = params.annualFactor;
  const source = params.source;

  let buffer: CircularBuffer<number>;
  let prevPrice: number | null;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period changed — carry the log-return buffer forward into the new
      // window.
      const old = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const carry = Math.min(old.length, period);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
    }
    prevPrice = state.prevPrice;
    count = state.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    prevPrice = null;
    count = 0;
  }

  /**
   * Annualized volatility of a window of log returns.
   *
   * Two-pass sample variance, matching the batch indicator. The one-pass
   * `sumSq - sum²/n` form cancels whenever the returns sit far from zero
   * relative to their spread (a strong drift with small noise), where it can
   * report exactly zero volatility. See centeredMoments.
   */
  function computeOutput(window: readonly number[]): number {
    const { n, sumSqDev } = centeredMoments(window);
    const variance = n > 1 ? sumSqDev / (n - 1) : 0;
    return Math.sqrt(Math.max(0, variance) * annualFactor) * 100;
  }

  const indicator: IncrementalIndicator<
    number | null,
    IndicatorSnapshot<HistoricalVolatilityState>
  > = {
    next(candle: NormalizedCandle) {
      count++;
      const price = getSourcePrice(candle, source);

      if (prevPrice === null) {
        prevPrice = price;
        return { time: candle.time, value: null };
      }

      if (price <= 0 || prevPrice <= 0) {
        prevPrice = price;
        return { time: candle.time, value: null };
      }

      const logReturn = Math.log(price / prevPrice);
      prevPrice = price;

      buffer.push(logReturn);

      // Need period returns (= period+1 prices) for valid output
      if (buffer.length < period) {
        return { time: candle.time, value: null };
      }

      return { time: candle.time, value: computeOutput(buffer.toArray()) };
    },

    peek(candle: NormalizedCandle) {
      if (prevPrice === null) {
        return { time: candle.time, value: null };
      }

      const price = getSourcePrice(candle, source);
      const logReturn = Math.log(price / prevPrice);

      // The window the buffer would hold after pushing `logReturn`.
      const window = buffer.toArray().slice(buffer.isFull ? 1 : 0);
      window.push(logReturn);

      if (window.length < period) {
        return { time: candle.time, value: null };
      }

      return { time: candle.time, value: computeOutput(window) };
    },

    getState(): IndicatorSnapshot<HistoricalVolatilityState> {
      return makeSnapshot(
        "historicalVolatility",
        HISTORICAL_VOLATILITY_VERSION,
        { period, annualFactor, source },
        { buffer: buffer.snapshot(), prevPrice, count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.length >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
