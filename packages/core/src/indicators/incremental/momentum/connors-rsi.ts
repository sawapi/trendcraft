/**
 * Incremental Connors RSI (CRSI)
 *
 * CRSI = (RSI(close, rsiPeriod) + RSI(streak, streakPeriod) + PercentRank(ROC(1), rocPeriod)) / 3
 *
 * State category: **Mixed/Cascaded** (two internal RSI states using
 * Wilder smoothing + a windowed ROC buffer + streak tracker). The
 * recursive RSI components permanently encode past parameters, so
 * resume requires identical `rsiPeriod`, `streakPeriod`, `rocPeriod`,
 * and `source` (or omit them and let the snapshot's params win).
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice, makeCandle } from "../utils";
import type { RsiState } from "./rsi";
import { createRsi } from "./rsi";

export type ConnorsRsiValue = {
  crsi: number | null;
  rsi: number | null;
  streakRsi: number | null;
  rocPercentile: number | null;
};

export type ConnorsRsiState = {
  rsiPeriod: number;
  streakPeriod: number;
  rocPeriod: number;
  source: PriceSource;
  priceRsiState: RsiState;
  streakRsiState: RsiState;
  rocBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  prevClose: number | null;
  streak: number;
  count: number;
};

/**
 * Create an incremental Connors RSI indicator
 *
 * @example
 * ```ts
 * const crsi = createConnorsRsi({ rsiPeriod: 3, streakPeriod: 2, rocPeriod: 100 });
 * for (const candle of stream) {
 *   const { value } = crsi.next(candle);
 *   if (value.crsi !== null) console.log(value.crsi);
 * }
 * ```
 */
export function createConnorsRsi(
  options: {
    rsiPeriod?: number;
    streakPeriod?: number;
    rocPeriod?: number;
    source?: PriceSource;
  } = {},
  warmUpOptions?: WarmUpOptions<ConnorsRsiState>,
): IncrementalIndicator<ConnorsRsiValue, ConnorsRsiState> {
  // Resume order: explicit option > snapshot value > canonical default.
  const fs = warmUpOptions?.fromState ?? null;
  const rsiPeriod = options.rsiPeriod ?? fs?.rsiPeriod ?? 3;
  const streakPeriod = options.streakPeriod ?? fs?.streakPeriod ?? 2;
  const rocPeriod = options.rocPeriod ?? fs?.rocPeriod ?? 100;
  const source: PriceSource = options.source ?? fs?.source ?? "close";

  let priceRsi: ReturnType<typeof createRsi>;
  let streakRsi: ReturnType<typeof createRsi>;
  let rocBuffer: CircularBuffer<number>;
  let prevClose: number | null;
  let streak: number;
  let count: number;

  if (fs) {
    // CRSI is Mixed/Cascaded: two internal Wilder-RSI states
    // permanently encode past parameters. Refuse all parameter changes
    // on resume. Pre-this-PR snapshots (no `source` field, undefined !==
    // any string) are naturally rejected by the equality check and
    // surface the same re-warm message.
    if (
      fs.rsiPeriod !== rsiPeriod ||
      fs.streakPeriod !== streakPeriod ||
      fs.rocPeriod !== rocPeriod ||
      fs.source !== source
    ) {
      throw new Error("Connors RSI: incompatible snapshot, re-warm required");
    }
    priceRsi = createRsi({ period: rsiPeriod, source }, { fromState: fs.priceRsiState });
    streakRsi = createRsi({ period: streakPeriod }, { fromState: fs.streakRsiState });
    rocBuffer = CircularBuffer.fromSnapshot(fs.rocBuffer);
    prevClose = fs.prevClose;
    streak = fs.streak;
    count = fs.count;
  } else {
    priceRsi = createRsi({ period: rsiPeriod, source });
    streakRsi = createRsi({ period: streakPeriod });
    rocBuffer = new CircularBuffer<number>(rocPeriod);
    prevClose = null;
    streak = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<ConnorsRsiValue, ConnorsRsiState> = {
    next(candle: NormalizedCandle) {
      count++;
      const price = getSourcePrice(candle, source);

      // Component 1: RSI of price
      const priceRsiResult = priceRsi.next(candle);
      const rsiVal = priceRsiResult.value;

      // Component 2: Streak + RSI of streak
      if (prevClose !== null) {
        if (price > prevClose) {
          streak = streak > 0 ? streak + 1 : 1;
        } else if (price < prevClose) {
          streak = streak < 0 ? streak - 1 : -1;
        } else {
          streak = 0;
        }
      }

      const streakRsiResult = streakRsi.next(makeCandle(candle.time, streak));
      const streakRsiVal = streakRsiResult.value;

      // Component 3: Percent rank of 1-period ROC
      let rocPercentile: number | null = null;
      if (prevClose !== null && prevClose !== 0) {
        const roc1 = ((price - prevClose) / prevClose) * 100;

        // Calculate percent rank from buffer
        if (rocBuffer.length > 0) {
          let lessOrEqual = 0;
          for (let i = 0; i < rocBuffer.length; i++) {
            if (rocBuffer.get(i) <= roc1) {
              lessOrEqual++;
            }
          }
          rocPercentile = (lessOrEqual / rocBuffer.length) * 100;
        }

        rocBuffer.push(roc1);
      }

      prevClose = price;

      // Combine
      let crsi: number | null = null;
      if (rsiVal !== null && streakRsiVal !== null && rocPercentile !== null) {
        crsi = (rsiVal + streakRsiVal + rocPercentile) / 3;
      }

      return {
        time: candle.time,
        value: { crsi, rsi: rsiVal, streakRsi: streakRsiVal, rocPercentile },
      };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const rsiVal = priceRsi.peek(candle).value;

      // Peek streak
      let peekStreak = streak;
      if (prevClose !== null) {
        if (price > prevClose) {
          peekStreak = streak > 0 ? streak + 1 : 1;
        } else if (price < prevClose) {
          peekStreak = streak < 0 ? streak - 1 : -1;
        } else {
          peekStreak = 0;
        }
      }
      const streakRsiVal = streakRsi.peek(makeCandle(candle.time, peekStreak)).value;

      let rocPercentile: number | null = null;
      if (prevClose !== null && prevClose !== 0) {
        const roc1 = ((price - prevClose) / prevClose) * 100;
        if (rocBuffer.length > 0) {
          let lessOrEqual = 0;
          for (let i = 0; i < rocBuffer.length; i++) {
            if (rocBuffer.get(i) <= roc1) lessOrEqual++;
          }
          rocPercentile = (lessOrEqual / rocBuffer.length) * 100;
        }
      }

      let crsi: number | null = null;
      if (rsiVal !== null && streakRsiVal !== null && rocPercentile !== null) {
        crsi = (rsiVal + streakRsiVal + rocPercentile) / 3;
      }

      return {
        time: candle.time,
        value: { crsi, rsi: rsiVal, streakRsi: streakRsiVal, rocPercentile },
      };
    },

    getState(): ConnorsRsiState {
      return {
        rsiPeriod,
        streakPeriod,
        rocPeriod,
        source,
        priceRsiState: priceRsi.getState(),
        streakRsiState: streakRsi.getState(),
        rocBuffer: rocBuffer.snapshot(),
        prevClose,
        streak,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return priceRsi.isWarmedUp && streakRsi.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
