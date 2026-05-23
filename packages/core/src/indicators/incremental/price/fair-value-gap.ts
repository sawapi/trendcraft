/**
 * Incremental Fair Value Gap (FVG)
 *
 * Detects 3-candle imbalance patterns and tracks fill status.
 * Bullish FVG: prev2.high < current.low (gap between candle 1 high and candle 3 low)
 * Bearish FVG: prev2.low > current.high (gap between candle 3 high and candle 1 low)
 *
 * State category: **Mixed** — the `active*Fvgs` lists are not a frozen
 * append-only log: `minGapPercent` / `maxActiveFvgs` / `partialFill`
 * decide which gaps were recorded, retained, or already considered
 * filled, so they shape the persisted state. Resume with any of those
 * changed cannot match a fresh run and is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

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

/**
 * Bare state shape for Fair Value Gap. Params (`minGapPercent`,
 * `maxActiveFvgs`, `partialFill`) live in `meta.params` on the wire.
 */
export type FairValueGapState = {
  prev2: StoredCandle | null;
  prev1: StoredCandle | null;
  activeBullishFvgs: FvgGap[];
  activeBearishFvgs: FvgGap[];
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const FAIR_VALUE_GAP_VERSION = 1;

type FairValueGapParams = {
  minGapPercent: number;
  maxActiveFvgs: number;
  partialFill: boolean;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<FairValueGapState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<FvgValue, IndicatorSnapshot<FairValueGapState>> {
  const { params, state } = resolveResume<FairValueGapParams, FairValueGapState>({
    indicator: "fairValueGap",
    version: FAIR_VALUE_GAP_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { minGapPercent: 0, maxActiveFvgs: 10, partialFill: true },
  });

  const minGapPercent = params.minGapPercent;
  const maxActiveFvgs = params.maxActiveFvgs;
  const partialFill = params.partialFill;

  let prev2: StoredCandle | null;
  let prev1: StoredCandle | null;
  let activeBullishFvgs: FvgGap[];
  let activeBearishFvgs: FvgGap[];
  let count: number;

  if (state !== null) {
    prev2 = state.prev2 ? { ...state.prev2 } : null;
    prev1 = state.prev1 ? { ...state.prev1 } : null;
    activeBullishFvgs = state.activeBullishFvgs.map((g) => ({ ...g }));
    activeBearishFvgs = state.activeBearishFvgs.map((g) => ({ ...g }));
    count = state.count;
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

  const indicator: IncrementalIndicator<FvgValue, IndicatorSnapshot<FairValueGapState>> = {
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

      // `next` increments `count` then uses `barIndex = count - 1`, so
      // the bar index of the incoming candle equals the current
      // (pre-increment) `count`.
      const barIndex = count;

      // Simulate fill check without mutating. Mirror `next`'s
      // `checkFills` exactly — including the reverse iteration order,
      // which determines `filledFvgs` ordering — so peek matches next.
      const peekFilledFvgs: FvgGap[] = [];
      for (let i = activeBullishFvgs.length - 1; i >= 0; i--) {
        const g = activeBullishFvgs[i];
        const isFilled = partialFill ? candle.low <= g.high : candle.low <= g.low;
        if (isFilled)
          peekFilledFvgs.push({
            ...g,
            filled: true,
            filledIndex: barIndex,
            filledTime: candle.time,
          });
      }
      for (let i = activeBearishFvgs.length - 1; i >= 0; i--) {
        const g = activeBearishFvgs[i];
        const isFilled = partialFill ? candle.high >= g.low : candle.high >= g.high;
        if (isFilled)
          peekFilledFvgs.push({
            ...g,
            filled: true,
            filledIndex: barIndex,
            filledTime: candle.time,
          });
      }

      let newBullishFvg = false;
      let newBearishFvg = false;
      let newFvg: FvgGap | null = null;

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
        }
      }

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

    getState(): IndicatorSnapshot<FairValueGapState> {
      return makeSnapshot(
        "fairValueGap",
        FAIR_VALUE_GAP_VERSION,
        { minGapPercent, maxActiveFvgs, partialFill },
        {
          prev2: prev2 ? { ...prev2 } : null,
          prev1: prev1 ? { ...prev1 } : null,
          activeBullishFvgs: activeBullishFvgs.map((g) => ({ ...g })),
          activeBearishFvgs: activeBearishFvgs.map((g) => ({ ...g })),
          count,
        },
      );
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
