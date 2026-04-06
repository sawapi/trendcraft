/**
 * Incremental Fair Value Gap (FVG)
 *
 * Detects 3-candle imbalance patterns and tracks fill status.
 * Bullish FVG: prev2.high < current.low (gap between candle 1 high and candle 3 low)
 * Bearish FVG: prev2.low > current.high (gap between candle 3 high and candle 1 low)
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type FvgGap = {
  type: "bullish" | "bearish";
  /** Upper boundary of the gap */
  high: number;
  /** Lower boundary of the gap */
  low: number;
  /** Bar index where the FVG was detected */
  startIndex: number;
  /** Timestamp of the middle candle (FVG origin) */
  startTime: number;
  /** Whether this gap has been filled */
  filled: boolean;
  /** Bar index where fill occurred */
  filledIndex: number | null;
  /** Timestamp where fill occurred */
  filledTime: number | null;
};

export type FvgValue = {
  /** Whether a new bullish FVG was detected on this bar */
  newBullishFvg: boolean;
  /** Whether a new bearish FVG was detected on this bar */
  newBearishFvg: boolean;
  /** The newly detected FVG, if any */
  newFvg: FvgGap | null;
  /** Currently active (unfilled) bullish FVGs */
  activeBullishFvgs: FvgGap[];
  /** Currently active (unfilled) bearish FVGs */
  activeBearishFvgs: FvgGap[];
  /** FVGs filled on this bar */
  filledFvgs: FvgGap[];
};

type StoredCandle = { high: number; low: number; time: number };

export type FairValueGapState = {
  prev2: StoredCandle | null;
  prev1: StoredCandle | null;
  activeBullishFvgs: FvgGap[];
  activeBearishFvgs: FvgGap[];
  minGapPercent: number;
  maxActiveFvgs: number;
  partialFill: boolean;
  count: number;
};

const emptyValue: FvgValue = {
  newBullishFvg: false,
  newBearishFvg: false,
  newFvg: null,
  activeBullishFvgs: [],
  activeBearishFvgs: [],
  filledFvgs: [],
};

/**
 * Create an incremental Fair Value Gap detector
 *
 * Identifies 3-candle imbalance zones and tracks whether they get filled
 * by subsequent price action.
 *
 * @example
 * ```ts
 * const fvg = createFairValueGap({ minGapPercent: 0.1 });
 * for (const candle of stream) {
 *   const { value } = fvg.next(candle);
 *   if (value.newFvg) {
 *     console.log(`New ${value.newFvg.type} FVG: ${value.newFvg.low}-${value.newFvg.high}`);
 *   }
 *   if (value.filledFvgs.length > 0) {
 *     console.log(`${value.filledFvgs.length} FVG(s) filled`);
 *   }
 * }
 * ```
 */
export function createFairValueGap(
  options: { minGapPercent?: number; maxActiveFvgs?: number; partialFill?: boolean } = {},
  warmUpOptions?: WarmUpOptions<FairValueGapState>,
): IncrementalIndicator<FvgValue, FairValueGapState> {
  const minGapPercent = options.minGapPercent ?? 0;
  const maxActiveFvgs = options.maxActiveFvgs ?? 10;
  const partialFill = options.partialFill ?? true;

  let prev2: StoredCandle | null;
  let prev1: StoredCandle | null;
  let activeBullishFvgs: FvgGap[];
  let activeBearishFvgs: FvgGap[];
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prev2 = s.prev2 ? { ...s.prev2 } : null;
    prev1 = s.prev1 ? { ...s.prev1 } : null;
    activeBullishFvgs = s.activeBullishFvgs.map((g) => ({ ...g }));
    activeBearishFvgs = s.activeBearishFvgs.map((g) => ({ ...g }));
    count = s.count;
  } else {
    prev2 = null;
    prev1 = null;
    activeBullishFvgs = [];
    activeBearishFvgs = [];
    count = 0;
  }

  function checkFills(
    candle: NormalizedCandle,
    bullish: FvgGap[],
    bearish: FvgGap[],
    barIndex: number,
  ): FvgGap[] {
    const filled: FvgGap[] = [];

    // Bullish FVG filled when price drops into the gap zone
    for (let i = bullish.length - 1; i >= 0; i--) {
      const g = bullish[i];
      const isFilled = partialFill ? candle.low <= g.high : candle.low <= g.low;
      if (isFilled) {
        g.filled = true;
        g.filledIndex = barIndex;
        g.filledTime = candle.time;
        filled.push(g);
        bullish.splice(i, 1);
      }
    }

    // Bearish FVG filled when price rises into the gap zone
    for (let i = bearish.length - 1; i >= 0; i--) {
      const g = bearish[i];
      const isFilled = partialFill ? candle.high >= g.low : candle.high >= g.high;
      if (isFilled) {
        g.filled = true;
        g.filledIndex = barIndex;
        g.filledTime = candle.time;
        filled.push(g);
        bearish.splice(i, 1);
      }
    }

    return filled;
  }

  const indicator: IncrementalIndicator<FvgValue, FairValueGapState> = {
    next(candle: NormalizedCandle) {
      count++;
      const barIndex = count - 1;

      // Check fills on active FVGs
      const filledFvgs = checkFills(candle, activeBullishFvgs, activeBearishFvgs, barIndex);

      let newBullishFvg = false;
      let newBearishFvg = false;
      let newFvg: FvgGap | null = null;

      // Need at least 3 candles to detect FVG
      if (prev2 !== null && prev1 !== null) {
        // Bullish FVG: gap between candle 1's high and candle 3's low
        if (candle.low > prev2.high) {
          const gapSize = candle.low - prev2.high;
          const gapPct = prev2.high > 0 ? (gapSize / prev2.high) * 100 : 0;

          if (gapPct >= minGapPercent) {
            newBullishFvg = true;
            newFvg = {
              type: "bullish",
              high: candle.low,
              low: prev2.high,
              startIndex: barIndex,
              startTime: candle.time,
              filled: false,
              filledIndex: null,
              filledTime: null,
            };
            activeBullishFvgs.push(newFvg);
            // Trim oldest if over limit
            if (activeBullishFvgs.length > maxActiveFvgs) {
              activeBullishFvgs.shift();
            }
          }
        }

        // Bearish FVG: gap between candle 3's high and candle 1's low
        if (candle.high < prev2.low) {
          const gapSize = prev2.low - candle.high;
          const gapPct = prev2.low > 0 ? (gapSize / prev2.low) * 100 : 0;

          if (gapPct >= minGapPercent) {
            newBearishFvg = true;
            newFvg = {
              type: "bearish",
              high: prev2.low,
              low: candle.high,
              startIndex: barIndex,
              startTime: candle.time,
              filled: false,
              filledIndex: null,
              filledTime: null,
            };
            activeBearishFvgs.push(newFvg);
            if (activeBearishFvgs.length > maxActiveFvgs) {
              activeBearishFvgs.shift();
            }
          }
        }
      }

      // Shift candles
      prev2 = prev1;
      prev1 = { high: candle.high, low: candle.low, time: candle.time };

      return {
        time: candle.time,
        value: {
          newBullishFvg,
          newBearishFvg,
          newFvg,
          activeBullishFvgs: [...activeBullishFvgs],
          activeBearishFvgs: [...activeBearishFvgs],
          filledFvgs,
        },
      };
    },

    peek(candle: NormalizedCandle) {
      if (prev2 === null || prev1 === null) {
        return { time: candle.time, value: emptyValue };
      }

      // Simulate fill check without mutating
      const peekFilledFvgs: FvgGap[] = [];
      for (const g of activeBullishFvgs) {
        const isFilled = partialFill ? candle.low <= g.high : candle.low <= g.low;
        if (isFilled)
          peekFilledFvgs.push({ ...g, filled: true, filledIndex: count, filledTime: candle.time });
      }
      for (const g of activeBearishFvgs) {
        const isFilled = partialFill ? candle.high >= g.low : candle.high >= g.high;
        if (isFilled)
          peekFilledFvgs.push({ ...g, filled: true, filledIndex: count, filledTime: candle.time });
      }

      let newBullishFvg = false;
      let newBearishFvg = false;
      let newFvg: FvgGap | null = null;

      if (candle.low > prev2.high) {
        const gapSize = candle.low - prev2.high;
        const midPrice = (prev2.high + candle.low) / 2;
        const gapPct = midPrice > 0 ? (gapSize / midPrice) * 100 : 0;
        if (gapPct >= minGapPercent) {
          newBullishFvg = true;
          newFvg = {
            type: "bullish",
            high: candle.low,
            low: prev2.high,
            startIndex: count - 1,
            startTime: prev1.time,
            filled: false,
            filledIndex: null,
            filledTime: null,
          };
        }
      }

      if (candle.high < prev2.low) {
        const gapSize = prev2.low - candle.high;
        const midPrice = (prev2.low + candle.high) / 2;
        const gapPct = midPrice > 0 ? (gapSize / midPrice) * 100 : 0;
        if (gapPct >= minGapPercent) {
          newBearishFvg = true;
          newFvg = {
            type: "bearish",
            high: prev2.low,
            low: candle.high,
            startIndex: count - 1,
            startTime: prev1.time,
            filled: false,
            filledIndex: null,
            filledTime: null,
          };
        }
      }

      // Remaining active after simulated fills
      const remainBullish = activeBullishFvgs.filter(
        (g) => !(partialFill ? candle.low <= g.high : candle.low <= g.low),
      );
      const remainBearish = activeBearishFvgs.filter(
        (g) => !(partialFill ? candle.high >= g.low : candle.high >= g.high),
      );

      return {
        time: candle.time,
        value: {
          newBullishFvg,
          newBearishFvg,
          newFvg,
          activeBullishFvgs:
            newBullishFvg && newFvg?.type === "bullish"
              ? [...remainBullish, newFvg]
              : remainBullish,
          activeBearishFvgs:
            newBearishFvg && newFvg?.type === "bearish"
              ? [...remainBearish, newFvg]
              : remainBearish,
          filledFvgs: peekFilledFvgs,
        },
      };
    },

    getState(): FairValueGapState {
      return {
        prev2: prev2 ? { ...prev2 } : null,
        prev1: prev1 ? { ...prev1 } : null,
        activeBullishFvgs: activeBullishFvgs.map((g) => ({ ...g })),
        activeBearishFvgs: activeBearishFvgs.map((g) => ({ ...g })),
        minGapPercent,
        maxActiveFvgs,
        partialFill,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= 3;
    },
  };

  // Warm up with historical data
  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
