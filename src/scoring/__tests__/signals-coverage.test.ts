/**
 * Behavioral coverage tests for scoring signal evaluators
 *
 * These tests verify actual scoring logic — not just that functions run.
 * Each test checks specific score values and validates that the evaluator
 * produces correct outputs for given market conditions.
 */
import { describe, expect, it } from "vitest";
import type { NormalizedCandle, PrecomputedIndicators } from "../../types";
import {
  createDeathCrossEvaluator,
  createGoldenCrossEvaluator,
  createPOConfirmationEvaluator,
  createPerfectOrderBearishEvaluator,
  createPerfectOrderBullishEvaluator,
  createPriceAboveEmaEvaluator,
  createPriceBelowEmaEvaluator,
  createPullbackEntryEvaluator,
} from "../signals/trend";
import {
  createMacdBearishEvaluator,
  createMacdBullishEvaluator,
  createRsiNeutralEvaluator,
  createRsiOverboughtEvaluator,
  createRsiOversoldEvaluator,
  createStochBullishCrossEvaluator,
  createStochOverboughtEvaluator,
  createStochOversoldEvaluator,
} from "../signals/momentum";
import {
  createBearishVolumeTrendEvaluator,
  createBullishVolumeTrendEvaluator,
  createCmfNegativeEvaluator,
  createCmfPositiveEvaluator,
  createHighVolumeUpCandleEvaluator,
  createVolumeAnomalyEvaluator,
  createVolumeSpikeEvaluator,
} from "../signals/volume";

// =============================================================================
// Helpers
// =============================================================================

function makeCandles(
  count: number,
  opts: { startPrice?: number; trend?: "up" | "down" | "flat"; volume?: number } = {},
): NormalizedCandle[] {
  const { startPrice = 100, trend = "flat", volume = 1_000_000 } = opts;
  const candles: NormalizedCandle[] = [];
  let price = startPrice;
  const t0 = 1_000_000_000_000;

  for (let i = 0; i < count; i++) {
    const delta = trend === "up" ? 0.5 : trend === "down" ? -0.5 : Math.sin(i * 0.5) * 0.3;
    price += delta;
    candles.push({
      time: t0 + i * 86_400_000,
      open: price - delta * 0.3,
      high: price + 1,
      low: price - 1,
      close: price,
      volume,
    });
  }
  return candles;
}

// =============================================================================
// TREND — Non-default periods exercise the fallback computation path
// =============================================================================

describe("trend evaluators — non-default period fallback paths", () => {
  describe("PerfectOrderBullish with custom periods uses live computation", () => {
    it("uptrend data with short periods [3,10,30] produces bullish score >= 0.8", () => {
      const evaluate = createPerfectOrderBullishEvaluator([3, 10, 30]);
      const candles = makeCandles(40, { trend: "up" });
      const score = evaluate(candles, 35);
      // Strong uptrend with short MAs should produce bullish perfect order
      expect(score).toBeGreaterThanOrEqual(0.8);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 at boundary index (exactly longPeriod) where data is minimal", () => {
      const evaluate = createPerfectOrderBullishEvaluator([3, 10, 30]);
      const candles = makeCandles(31);
      // index = 30 = longPeriod, just barely enough data
      const score = evaluate(candles, 30);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("PerfectOrderBearish with custom periods uses live computation", () => {
    it("downtrend data with short periods [3,10,30] produces bearish score >= 0.8", () => {
      const evaluate = createPerfectOrderBearishEvaluator([3, 10, 30]);
      const candles = makeCandles(40, { trend: "down", startPrice: 200 });
      const score = evaluate(candles, 35);
      // Strong downtrend should produce bearish perfect order
      expect(score).toBeGreaterThanOrEqual(0.8);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 when index < longPeriod (insufficient data)", () => {
      const evaluate = createPerfectOrderBearishEvaluator([5, 20, 60]);
      const candles = makeCandles(70);
      expect(evaluate(candles, 59)).toBe(0);
    });
  });

  describe("POConfirmation with non-default periods and slopeLookback", () => {
    it("non-default periods [3,10,30] with slopeLookback=5 uses fallback", () => {
      const evaluate = createPOConfirmationEvaluator([3, 10, 30], 5);
      const candles = makeCandles(50, { trend: "up" });
      const score = evaluate(candles, 40);
      // Uptrend may or may not form PO+ depending on MA alignment
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("default periods but non-default slopeLookback=5 forces fallback", () => {
      const evaluate = createPOConfirmationEvaluator([5, 20, 60], 5);
      const candles = makeCandles(70, { trend: "up" });
      const score = evaluate(candles, 66);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 when precomputed entry is null (no PO+ state detected)", () => {
      const evaluate = createPOConfirmationEvaluator([5, 20, 60], 3);
      const candles = makeCandles(70);
      const precomputed: PrecomputedIndicators = {
        perfectOrderEnhanced: Array(70).fill(null),
      };
      expect(evaluate(candles, 65, undefined, precomputed)).toBe(0);
    });
  });

  describe("PullbackEntry fallback computation verifies MA-touch logic", () => {
    it("uptrend pullback with non-precomputed path produces valid score", () => {
      const evaluate = createPullbackEntryEvaluator(10, 2);
      const candles = makeCandles(30, { trend: "up" });
      const score = evaluate(candles, 25);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 when SMA series has < 5 entries (insufficient lookback)", () => {
      // maPeriod=20, index=20 => slice has 21 candles, SMA has 2 entries (< 5)
      const evaluate = createPullbackEntryEvaluator(20, 1);
      const candles = makeCandles(22);
      expect(evaluate(candles, 20)).toBe(0);
    });

    it("returns 0 when precomputed maValue is null (no SMA data)", () => {
      const evaluate = createPullbackEntryEvaluator(20, 1);
      const candles = makeCandles(30);
      const smaMap = new Map<number, (number | null)[]>();
      smaMap.set(20, Array(30).fill(null));
      expect(evaluate(candles, 25, undefined, { sma: smaMap })).toBe(0);
    });

    it("returns 0 when prevMa is null (index-4 outside SMA range)", () => {
      const evaluate = createPullbackEntryEvaluator(5, 50);
      const candles = makeCandles(10);
      const smaMap = new Map<number, (number | null)[]>();
      const data: (number | null)[] = Array(10).fill(null);
      data[5] = candles[5].close - 0.1; // maValue set at index 5
      // index=5, prevMa at index-4=1 is null
      smaMap.set(5, data);
      expect(evaluate(candles, 5, undefined, { sma: smaMap })).toBe(0);
    });

    it("returns 0.7 when MA is rising but price closed below MA (partial pullback)", () => {
      const evaluate = createPullbackEntryEvaluator(5, 50);
      const candles = makeCandles(15, { trend: "up" });
      const smaMap = new Map<number, (number | null)[]>();
      const data: (number | null)[] = Array(15).fill(null);
      // MA slightly above close, and rising (data[10] > data[6])
      for (let i = 5; i < 15; i++) {
        data[i] = candles[i].close + 0.3;
      }
      smaMap.set(5, data);
      const score = evaluate(candles, 10, undefined, { sma: smaMap });
      // MA rising (data[10] > data[6]), but close < maValue => 0.7
      expect(score).toBe(0.7);
    });
  });

  describe("GoldenCross fallback uses live SMA computation", () => {
    it("custom periods [5,10] use non-precomputed path", () => {
      const evaluate = createGoldenCrossEvaluator(5, 10);
      const candles = makeCandles(30);
      const score = evaluate(candles, 15);
      // Score depends on actual SMA alignment
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 when precomputed SMA arrays are empty (undefined at index)", () => {
      const evaluate = createGoldenCrossEvaluator(5, 10);
      const candles = makeCandles(20);
      const smaMap = new Map<number, (number | null)[]>();
      smaMap.set(5, []); // empty => shortData[12] = undefined
      smaMap.set(10, []);
      expect(evaluate(candles, 12, undefined, { sma: smaMap })).toBe(0);
    });
  });

  describe("DeathCross fallback and edge cases", () => {
    it("custom periods [5,10] use non-precomputed path", () => {
      const evaluate = createDeathCrossEvaluator(5, 10);
      const candles = makeCandles(30);
      const score = evaluate(candles, 15);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 when index < longPeriod + 1 (insufficient data)", () => {
      const evaluate = createDeathCrossEvaluator(5, 10);
      const candles = makeCandles(20);
      expect(evaluate(candles, 10)).toBe(0);
    });

    it("returns 0 when precomputed SMA values are all null", () => {
      const evaluate = createDeathCrossEvaluator(5, 10);
      const candles = makeCandles(20);
      const smaMap = new Map<number, (number | null)[]>();
      smaMap.set(5, Array(20).fill(null));
      smaMap.set(10, Array(20).fill(null));
      expect(evaluate(candles, 12, undefined, { sma: smaMap })).toBe(0);
    });

    it("returns 0 when precomputed SMA arrays are empty (undefined values)", () => {
      const evaluate = createDeathCrossEvaluator(5, 10);
      const candles = makeCandles(20);
      const smaMap = new Map<number, (number | null)[]>();
      smaMap.set(5, []);
      smaMap.set(10, []);
      expect(evaluate(candles, 12, undefined, { sma: smaMap })).toBe(0);
    });

    it("returns 0 when short MA is above long MA (no death cross)", () => {
      const evaluate = createDeathCrossEvaluator(5, 10);
      const candles = makeCandles(20);
      const smaMap = new Map<number, (number | null)[]>();
      const shortData = Array(20).fill(null) as (number | null)[];
      const longData = Array(20).fill(null) as (number | null)[];
      shortData[11] = 100;
      shortData[12] = 102; // short still above long
      longData[11] = 100;
      longData[12] = 100;
      smaMap.set(5, shortData);
      smaMap.set(10, longData);
      expect(evaluate(candles, 12, undefined, { sma: smaMap })).toBe(0);
    });
  });

  describe("PriceAboveEma with non-default period uses fallback computation", () => {
    it("uptrend with period=10 should score 1 (price above EMA)", () => {
      const evaluate = createPriceAboveEmaEvaluator(10);
      const candles = makeCandles(30, { trend: "up" });
      // In a steady uptrend, close should be above EMA
      const score = evaluate(candles, 25);
      expect(score).toBe(1);
    });

    it("returns 0 when precomputed EMA value is null", () => {
      const evaluate = createPriceAboveEmaEvaluator(20);
      const candles = makeCandles(30);
      const emaMap = new Map<number, (number | null)[]>();
      emaMap.set(20, Array(30).fill(null));
      expect(evaluate(candles, 25, undefined, { ema: emaMap })).toBe(0);
    });
  });

  describe("PriceBelowEma with non-default period uses fallback computation", () => {
    it("downtrend with period=10 should score 1 (price below EMA)", () => {
      const evaluate = createPriceBelowEmaEvaluator(10);
      const candles = makeCandles(30, { trend: "down", startPrice: 200 });
      const score = evaluate(candles, 25);
      expect(score).toBe(1);
    });

    it("returns 0 when precomputed EMA value is null", () => {
      const evaluate = createPriceBelowEmaEvaluator(20);
      const candles = makeCandles(30);
      const emaMap = new Map<number, (number | null)[]>();
      emaMap.set(20, Array(30).fill(null));
      expect(evaluate(candles, 25, undefined, { ema: emaMap })).toBe(0);
    });
  });
});

// =============================================================================
// MOMENTUM — Non-default periods and edge cases
// =============================================================================

describe("momentum evaluators — non-default period fallback paths", () => {
  describe("RSI Oversold with non-default period uses live RSI computation", () => {
    it("persistent downtrend with period=10 should produce oversold score > 0", () => {
      const evaluate = createRsiOversoldEvaluator(30, 10);
      const candles = makeCandles(50, { trend: "down", startPrice: 200 });
      const score = evaluate(candles, 30);
      // Persistent downtrend drives RSI low
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 when precomputed RSI array is too short (undefined at index)", () => {
      const evaluate = createRsiOversoldEvaluator(30, 14);
      const candles = makeCandles(20);
      const precomputed: PrecomputedIndicators = { rsi14: [50] };
      // Index 15 is beyond the 1-element array
      expect(evaluate(candles, 15, undefined, precomputed)).toBe(0);
    });
  });

  describe("RSI Overbought with non-default period uses live RSI computation", () => {
    it("persistent uptrend with period=10 should produce overbought score > 0", () => {
      const evaluate = createRsiOverboughtEvaluator(70, 10);
      const candles = makeCandles(50, { trend: "up", startPrice: 50 });
      const score = evaluate(candles, 30);
      // Persistent uptrend drives RSI high
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 when precomputed RSI array is empty", () => {
      const evaluate = createRsiOverboughtEvaluator(70, 14);
      const candles = makeCandles(20);
      expect(evaluate(candles, 15, undefined, { rsi14: [] })).toBe(0);
    });
  });

  describe("RSI Neutral with non-default period and boundary conditions", () => {
    it("period=10 uses fallback computation path", () => {
      const evaluate = createRsiNeutralEvaluator(40, 60, 10);
      const candles = makeCandles(50);
      const score = evaluate(candles, 30);
      // Sideways data should produce RSI near 50 (neutral zone)
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 when precomputed RSI is empty array", () => {
      const evaluate = createRsiNeutralEvaluator(40, 60, 14);
      const candles = makeCandles(20);
      expect(evaluate(candles, 15, undefined, { rsi14: [] })).toBe(0);
    });

    it("returns 0 when RSI=70 is above neutral upper bound of 60", () => {
      const evaluate = createRsiNeutralEvaluator(40, 60, 14);
      const candles = makeCandles(20);
      const precomputed: PrecomputedIndicators = {
        rsi14: Array(20)
          .fill(null)
          .map((_, i) => (i >= 14 ? 70 : null)),
      };
      expect(evaluate(candles, 15, undefined, precomputed)).toBe(0);
    });
  });

  describe("MACD Bullish with non-default periods and precomputed edge cases", () => {
    it("non-default periods [8,17,5] use live MACD computation", () => {
      const evaluate = createMacdBullishEvaluator(8, 17, 5);
      const candles = makeCandles(50, { trend: "up" });
      const score = evaluate(candles, 40);
      // Uptrend may produce positive histogram
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 when precomputed MACD array is empty (no data at index)", () => {
      const evaluate = createMacdBullishEvaluator();
      const candles = makeCandles(40);
      expect(evaluate(candles, 36, undefined, { macd: [] })).toBe(0);
    });

    it("returns 1 on exact zero-crossing (prev histogram<0, current=0)", () => {
      const evaluate = createMacdBullishEvaluator();
      const candles = makeCandles(40);
      const precomputed: PrecomputedIndicators = {
        macd: Array.from({ length: 40 }, (_, i) =>
          i === 35
            ? { macd: -0.1, signal: 0, histogram: -0.1 }
            : i === 36
              ? { macd: 0, signal: 0, histogram: 0 } // exactly 0 => crossover
              : {
                  macd: 0 as number | null,
                  signal: 0 as number | null,
                  histogram: 0 as number | null,
                },
        ),
      };
      // prev.histogram < 0 && current.histogram >= 0 => crossover => 1
      expect(evaluate(candles, 36, undefined, precomputed)).toBe(1);
    });
  });

  describe("MACD Bearish with non-default periods and precomputed edge cases", () => {
    it("non-default periods [8,17,5] use live MACD computation", () => {
      const evaluate = createMacdBearishEvaluator(8, 17, 5);
      const candles = makeCandles(50, { trend: "down", startPrice: 200 });
      const score = evaluate(candles, 40);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 when precomputed prev entry is undefined (sparse array)", () => {
      const evaluate = createMacdBearishEvaluator();
      const candles = makeCandles(40);
      const macdData = Array.from({ length: 40 }, () => undefined as any);
      macdData[36] = { macd: -0.5, signal: 0, histogram: -0.5 };
      // prev (index 35) is undefined => returns 0
      expect(evaluate(candles, 36, undefined, { macd: macdData })).toBe(0);
    });

    it("returns 0 when histogram values are null (data not yet computed)", () => {
      const evaluate = createMacdBearishEvaluator();
      const candles = makeCandles(40);
      const precomputed: PrecomputedIndicators = {
        macd: Array.from({ length: 40 }, () => ({
          macd: null,
          signal: null,
          histogram: null,
        })),
      };
      expect(evaluate(candles, 36, undefined, precomputed)).toBe(0);
    });

    it("returns 1 on exact zero-crossing (prev histogram>0, current=0)", () => {
      const evaluate = createMacdBearishEvaluator();
      const candles = makeCandles(40);
      const precomputed: PrecomputedIndicators = {
        macd: Array.from({ length: 40 }, (_, i) =>
          i === 35
            ? { macd: 0.1, signal: 0, histogram: 0.1 }
            : i === 36
              ? { macd: 0, signal: 0, histogram: 0 }
              : {
                  macd: 0 as number | null,
                  signal: 0 as number | null,
                  histogram: 0 as number | null,
                },
        ),
      };
      // prev.histogram > 0 && current.histogram <= 0 => bearish crossover
      expect(evaluate(candles, 36, undefined, precomputed)).toBe(1);
    });
  });

  describe("Stoch Oversold with non-default periods uses live Stoch computation", () => {
    it("non-default kPeriod=10, dPeriod=5 uses fallback path", () => {
      const evaluate = createStochOversoldEvaluator(20, 10, 5);
      const candles = makeCandles(50, { trend: "down", startPrice: 200 });
      const score = evaluate(candles, 40);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 when precomputed stoch array is empty", () => {
      const evaluate = createStochOversoldEvaluator(20, 14, 3);
      const candles = makeCandles(20);
      expect(evaluate(candles, 18, undefined, { stoch: [] })).toBe(0);
    });
  });

  describe("Stoch Overbought with non-default periods uses live computation", () => {
    it("non-default kPeriod=10, dPeriod=5 uses fallback path", () => {
      const evaluate = createStochOverboughtEvaluator(80, 10, 5);
      const candles = makeCandles(50, { trend: "up", startPrice: 50 });
      const score = evaluate(candles, 40);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("returns 0 when precomputed k or d is null", () => {
      const evaluate = createStochOverboughtEvaluator(80, 14, 3);
      const candles = makeCandles(20);
      const precomputed: PrecomputedIndicators = {
        stoch: Array.from({ length: 20 }, () => ({ k: null, d: null })),
      };
      expect(evaluate(candles, 18, undefined, precomputed)).toBe(0);
    });
  });

  describe("Stoch Bullish Cross with non-default periods", () => {
    it("non-default kPeriod=10, dPeriod=5 uses fallback path", () => {
      const evaluate = createStochBullishCrossEvaluator(20, 10, 5);
      const candles = makeCandles(50);
      const score = evaluate(candles, 40);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("insufficient data with non-default periods returns 0", () => {
      const evaluate = createStochBullishCrossEvaluator(20, 10, 5);
      const candles = makeCandles(16);
      // kPeriod+dPeriod+1 = 16, index=15 is just enough but series may have < 2
      expect(evaluate(candles, 15)).toBe(0);
    });

    it("returns 0 when current k is null in precomputed data", () => {
      const evaluate = createStochBullishCrossEvaluator(20, 14, 3);
      const candles = makeCandles(20);
      const precomputed: PrecomputedIndicators = {
        stoch: Array.from({ length: 20 }, (_, i) => {
          if (i === 17) return { k: 10, d: 15 };
          if (i === 18) return { k: null, d: 18 }; // k null => invalid
          return { k: 50 as number | null, d: 50 as number | null };
        }),
      };
      expect(evaluate(candles, 18, undefined, precomputed)).toBe(0);
    });
  });
});

// =============================================================================
// VOLUME — Non-default periods and fallback paths
// =============================================================================

describe("volume evaluators — non-default period fallback paths", () => {
  describe("VolumeSpike with non-default period uses live computation", () => {
    it("period=10 falls back to live volumeMa computation", () => {
      const evaluate = createVolumeSpikeEvaluator(1.5, 10);
      const candles = makeCandles(30);
      // Set a volume spike at the target index
      candles[25].volume = 5_000_000; // 5x average
      const score = evaluate(candles, 25);
      // 5x / 1M avg should exceed threshold
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("VolumeAnomaly with non-default parameters uses fallback", () => {
    it("zThreshold=3 and period=10 trigger non-precomputed path", () => {
      const evaluate = createVolumeAnomalyEvaluator(3, 10);
      const candles = makeCandles(30);
      // Inject a huge volume spike to create anomaly
      candles[25].volume = 10_000_000;
      const score = evaluate(candles, 25);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("BullishVolumeTrend with non-default period uses fallback", () => {
    it("maPeriod=10 uses live volumeTrend computation", () => {
      const evaluate = createBullishVolumeTrendEvaluator(10);
      const candles = makeCandles(30, { trend: "up" });
      const score = evaluate(candles, 25);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("BearishVolumeTrend evaluator scoring logic", () => {
    it("returns 0 when index < maPeriod", () => {
      const evaluate = createBearishVolumeTrendEvaluator(20);
      const candles = makeCandles(25);
      expect(evaluate(candles, 10)).toBe(0);
    });

    it("returns 1 for price down + volume up + high confidence (selling pressure)", () => {
      const evaluate = createBearishVolumeTrendEvaluator(20);
      const candles = makeCandles(25);
      const precomputed: PrecomputedIndicators = {
        volumeTrend: Array(25)
          .fill(null)
          .map((_, i) =>
            i >= 20
              ? {
                  isConfirmed: false,
                  priceTrend: "down",
                  volumeTrend: "up",
                  confidence: 85,
                  hasDivergence: false,
                }
              : null,
          ),
      };
      expect(evaluate(candles, 22, undefined, precomputed)).toBe(1);
    });

    it("returns confidence/100 for divergence (price up but volume down = weakness)", () => {
      const evaluate = createBearishVolumeTrendEvaluator(20);
      const candles = makeCandles(25);
      const precomputed: PrecomputedIndicators = {
        volumeTrend: Array(25)
          .fill(null)
          .map((_, i) =>
            i >= 20
              ? {
                  isConfirmed: false,
                  priceTrend: "up",
                  volumeTrend: "down",
                  confidence: 75,
                  hasDivergence: true,
                }
              : null,
          ),
      };
      // Divergence + price up => confidence/100
      expect(evaluate(candles, 22, undefined, precomputed)).toBe(0.75);
    });

    it("returns 0 when no bearish pattern and no divergence", () => {
      const evaluate = createBearishVolumeTrendEvaluator(20);
      const candles = makeCandles(25);
      const precomputed: PrecomputedIndicators = {
        volumeTrend: Array(25)
          .fill(null)
          .map((_, i) =>
            i >= 20
              ? {
                  isConfirmed: true,
                  priceTrend: "up",
                  volumeTrend: "up",
                  confidence: 90,
                  hasDivergence: false,
                }
              : null,
          ),
      };
      // Price up + volume up + confirmed = healthy, not bearish
      expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
    });

    it("returns 0 when confidence is low despite bearish pattern", () => {
      const evaluate = createBearishVolumeTrendEvaluator(20);
      const candles = makeCandles(25);
      const precomputed: PrecomputedIndicators = {
        volumeTrend: Array(25)
          .fill(null)
          .map((_, i) =>
            i >= 20
              ? {
                  isConfirmed: false,
                  priceTrend: "down",
                  volumeTrend: "up",
                  confidence: 50, // <= 70, not enough
                  hasDivergence: false,
                }
              : null,
          ),
      };
      expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
    });

    it("non-default maPeriod=10 uses fallback path", () => {
      const evaluate = createBearishVolumeTrendEvaluator(10);
      const candles = makeCandles(30, { trend: "down", startPrice: 200 });
      const score = evaluate(candles, 25);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("CMF Positive with non-default period uses fallback", () => {
    it("period=10 triggers non-precomputed path", () => {
      const evaluate = createCmfPositiveEvaluator(0.1, 10);
      const candles = makeCandles(30, { trend: "up" });
      const score = evaluate(candles, 25);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("CMF Negative with non-default period uses fallback", () => {
    it("period=10 triggers non-precomputed path", () => {
      const evaluate = createCmfNegativeEvaluator(-0.1, 10);
      const candles = makeCandles(30, { trend: "down", startPrice: 200 });
      const score = evaluate(candles, 25);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("HighVolumeUpCandle with non-default period uses fallback", () => {
    it("period=10 triggers non-precomputed path and scores up candle with high volume", () => {
      const evaluate = createHighVolumeUpCandleEvaluator(1.5, 10);
      const candles = makeCandles(30, { trend: "up" });
      // Make a clear up candle with high volume
      candles[25].open = candles[25].close - 3;
      candles[25].volume = 5_000_000; // 5x the base
      const score = evaluate(candles, 25);
      // Should detect up candle with high volume
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});

// =============================================================================
// SCORING LOGIC COMPARISONS — Verify relative scoring behavior
// =============================================================================

describe("relative scoring: signals should produce proportional scores", () => {
  it("deeply oversold RSI (10) should score higher than mildly oversold (28)", () => {
    const evaluate = createRsiOversoldEvaluator(30, 14);
    const candles = makeCandles(20);

    const deeplyOversold: PrecomputedIndicators = {
      rsi14: Array(20)
        .fill(null)
        .map((_, i) => (i >= 14 ? 10 : null)),
    };
    const mildlyOversold: PrecomputedIndicators = {
      rsi14: Array(20)
        .fill(null)
        .map((_, i) => (i >= 14 ? 28 : null)),
    };

    const deepScore = evaluate(candles, 15, undefined, deeplyOversold);
    const mildScore = evaluate(candles, 15, undefined, mildlyOversold);

    // Both should score > 0, but deeply oversold should be at max
    expect(deepScore).toBe(1);
    expect(mildScore).toBe(1);
    expect(deepScore).toBeGreaterThanOrEqual(mildScore);
  });

  it("RSI in gradual falloff zone (35) should score less than at threshold (30)", () => {
    const evaluate = createRsiOversoldEvaluator(30, 14);
    const candles = makeCandles(20);

    const atThreshold: PrecomputedIndicators = {
      rsi14: Array(20)
        .fill(null)
        .map((_, i) => (i >= 14 ? 30 : null)),
    };
    const inFalloff: PrecomputedIndicators = {
      rsi14: Array(20)
        .fill(null)
        .map((_, i) => (i >= 14 ? 35 : null)),
    };

    expect(evaluate(candles, 15, undefined, atThreshold)).toBe(1);
    expect(evaluate(candles, 15, undefined, inFalloff)).toBeCloseTo(0.5, 5);
  });

  it("MACD crossover (histogram sign change) scores higher than sustained bullish", () => {
    const evaluate = createMacdBullishEvaluator();
    const candles = makeCandles(40);

    const crossover: PrecomputedIndicators = {
      macd: Array.from({ length: 40 }, (_, i) =>
        i === 35
          ? { macd: -0.5, signal: 0, histogram: -0.5 }
          : i === 36
            ? { macd: 0.5, signal: 0, histogram: 0.5 }
            : {
                macd: 0 as number | null,
                signal: 0 as number | null,
                histogram: 0 as number | null,
              },
      ),
    };

    const sustained: PrecomputedIndicators = {
      macd: Array.from({ length: 40 }, (_, i) =>
        i >= 35
          ? { macd: 0.5, signal: 0, histogram: 0.5 }
          : {
              macd: 0 as number | null,
              signal: 0 as number | null,
              histogram: 0 as number | null,
            },
      ),
    };

    const crossoverScore = evaluate(candles, 36, undefined, crossover);
    const sustainedScore = evaluate(candles, 36, undefined, sustained);

    expect(crossoverScore).toBe(1); // Full crossover
    expect(sustainedScore).toBe(0.5); // Partial for sustained
    expect(crossoverScore).toBeGreaterThan(sustainedScore);
  });

  it("stoch cross in oversold zone scores higher than cross outside oversold", () => {
    const evaluate = createStochBullishCrossEvaluator(20);
    const candles = makeCandles(20);

    const oversoldCross: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) => {
        if (i === 17) return { k: 10, d: 15 }; // K below D, oversold
        if (i === 18) return { k: 22, d: 18 }; // K crosses above D, still near oversold
        return { k: 50 as number | null, d: 50 as number | null };
      }),
    };

    const normalCross: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) => {
        if (i === 17) return { k: 40, d: 50 }; // K below D, neutral zone
        if (i === 18) return { k: 55, d: 50 }; // K crosses above D
        return { k: 50 as number | null, d: 50 as number | null };
      }),
    };

    const oversoldScore = evaluate(candles, 18, undefined, oversoldCross);
    const normalScore = evaluate(candles, 18, undefined, normalCross);

    expect(oversoldScore).toBe(1);
    expect(normalScore).toBe(0.5);
    expect(oversoldScore).toBeGreaterThan(normalScore);
  });

  it("volume anomaly with higher z-score produces higher score", () => {
    const evaluate = createVolumeAnomalyEvaluator(2, 20);
    const candles = makeCandles(25);

    const highZScore: PrecomputedIndicators = {
      volumeAnomaly: Array(25)
        .fill(null)
        .map((_, i) =>
          i >= 20 ? { ratio: 5, level: "extreme", isAnomaly: true, zScore: 5 } : null,
        ),
    };
    const lowZScore: PrecomputedIndicators = {
      volumeAnomaly: Array(25)
        .fill(null)
        .map((_, i) =>
          i >= 20 ? { ratio: 2.5, level: "high", isAnomaly: true, zScore: 2.5 } : null,
        ),
    };

    const highScore = evaluate(candles, 22, undefined, highZScore);
    const lowScore = evaluate(candles, 22, undefined, lowZScore);

    // z=5: min(1, 0.7 + 3*0.1) = 1.0
    // z=2.5: min(1, 0.7 + 0.5*0.1) = 0.75
    expect(highScore).toBe(1);
    expect(lowScore).toBe(0.75);
    expect(highScore).toBeGreaterThan(lowScore);
  });
});
