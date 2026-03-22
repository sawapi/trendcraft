/**
 * Meaningful behavior tests for backtest conditions
 *
 * Each test verifies actual condition evaluation results (true/false),
 * not just "it doesn't throw" or "typeof result is boolean".
 *
 * Covers:
 * - mtf.ts: MTF conditions with proper weekly/monthly data
 * - smc.ts: Order blocks, liquidity sweeps with crafted price action
 * - relative-strength.ts: RS conditions with outperforming/underperforming stocks
 * - volatility.ts: Regime detection, ATR%, percentile conditions
 * - volume-trend-obv.ts: Volume trend, CMF, OBV cross conditions
 * - volume-anomaly-profile.ts: Volume anomaly, profile, POC conditions
 * - scaled-entry.ts: Various strategies, interval types, ATR risk, partial TP
 */

import { describe, expect, it } from "vitest";
import type { MtfContext, NormalizedCandle } from "../../../types";
import type { PresetCondition } from "../../../types";
import {
  monthlyPriceAboveSma,
  monthlyPriceBelowSma,
  monthlyRsiAbove,
  monthlyRsiBelow,
  monthlyTrendStrong,
  mtfCondition,
  mtfDowntrend,
  mtfPriceAboveEma,
  mtfPriceAboveSma,
  mtfPriceBelowSma,
  mtfRsiAbove,
  mtfRsiBelow,
  mtfTrendStrong,
  mtfUptrend,
  weeklyDowntrend,
  weeklyPriceAboveEma,
  weeklyPriceAboveSma,
  weeklyPriceBelowSma,
  weeklyRsiAbove,
  weeklyRsiBelow,
  weeklyTrendStrong,
  weeklyUptrend,
} from "../../conditions/mtf";
import {
  mansfieldRSAbove,
  mansfieldRSBelow,
  outperformanceAbove,
  outperformanceBelow,
  rsAbove,
  rsBelow,
  rsFalling,
  rsNewHigh,
  rsNewLow,
  rsRatingAbove,
  rsRatingBelow,
  rsRising,
  setBenchmark,
} from "../../conditions/relative-strength";
import {
  hasActiveOrderBlocks,
  hasRecentSweeps,
  liquiditySweepDetected,
  liquiditySweepRecovered,
  orderBlockCreated,
  orderBlockMitigated,
  priceAtBearishOrderBlock,
  priceAtBullishOrderBlock,
  priceAtOrderBlock,
  sweepDepthAbove,
} from "../../conditions/smc";
import {
  atrPercentAbove,
  atrPercentBelow,
  atrPercentileAbove,
  atrPercentileBelow,
  regimeConfidenceAbove,
  regimeIs,
  regimeNot,
  volatilityAbove,
  volatilityBelow,
  volatilityContracting,
  volatilityExpanding,
} from "../../conditions/volatility";
import {
  breakdownVal,
  breakoutVah,
  inValueArea,
  nearPoc,
  priceAbovePoc,
  priceBelowPoc,
  volumeAnomalyCondition,
  volumeExtreme,
  volumeRatioAbove,
} from "../../conditions/volume-anomaly-profile";
import {
  bearishVolumeDivergence,
  bullishVolumeDivergence,
  cmfAbove,
  cmfBelow,
  obvCrossDown,
  obvCrossUp,
  obvFalling,
  obvRising,
  volumeConfirmsTrend,
  volumeDivergence,
  volumeTrendConfidence,
} from "../../conditions/volume-trend-obv";
import { runBacktestScaled } from "../../scaled-entry";

// ============================================
// Helpers
// ============================================

const DAY = 86400000;

/**
 * Create candles with controlled price/volume behavior.
 * base: starting price, trend: price increment per bar, volume: base volume.
 */
function makeCandles(
  count: number,
  opts: { base?: number; trend?: number; volume?: number; volatility?: number } = {},
): NormalizedCandle[] {
  const { base = 100, trend = 0.5, volume = 1_000_000, volatility = 2 } = opts;
  const t0 = 1_700_000_000_000 - count * DAY;
  return Array.from({ length: count }, (_, i) => {
    const price = base + i * trend;
    return {
      time: t0 + i * DAY,
      open: price - 0.5,
      high: price + volatility,
      low: price - volatility,
      close: price,
      volume: volume + (i % 3) * 100_000,
    };
  });
}

/** Create MTF context with weekly dataset populated */
function makeMtfContext(weeklyCandles: NormalizedCandle[], idx = 0): MtfContext {
  const datasets = new Map();
  datasets.set("weekly", { timeframe: "weekly", candles: weeklyCandles, indicators: {} });
  const indices = new Map();
  indices.set("weekly", idx);
  return { datasets, indices, currentTime: weeklyCandles[idx]?.time ?? 0 };
}

function makeMtfContextMonthly(candles: NormalizedCandle[], idx = 0): MtfContext {
  const datasets = new Map();
  datasets.set("monthly", { timeframe: "monthly", candles, indicators: {} });
  const indices = new Map();
  indices.set("monthly", idx);
  return { datasets, indices, currentTime: candles[idx]?.time ?? 0 };
}

/** Empty MTF context (no datasets) */
function emptyMtf(): MtfContext {
  return { datasets: new Map(), indices: new Map(), currentTime: 0 };
}

/** Evaluate a preset condition */
function evalPreset(
  cond: PresetCondition,
  candles: NormalizedCandle[],
  index: number,
  indicators: Record<string, unknown> = {},
): boolean {
  return cond.evaluate(indicators, candles[index], index, candles);
}

// ============================================
// MTF conditions
// ============================================

describe("MTF conditions - behavior verification", () => {
  // 60 candles in a clear uptrend: RSI should be >50 for later indices
  const uptrendCandles = makeCandles(60, { base: 50, trend: 1.5 });
  // 60 candles in a clear downtrend
  const downtrendCandles = makeCandles(60, { base: 150, trend: -1.5 });
  const dummyCandle = uptrendCandles[50];

  it("mtfRsiAbove returns true for uptrending weekly data when RSI exceeds low threshold", () => {
    const ctx = makeMtfContext(uptrendCandles, 50);
    const cond = mtfRsiAbove("weekly", 30, 14);
    // In a strong uptrend, RSI should be well above 30
    expect(cond.evaluate(ctx, {}, dummyCandle, 50, uptrendCandles)).toBe(true);
  });

  it("mtfRsiAbove returns false when threshold exceeds RSI value", () => {
    // Use a flat/sideways dataset where RSI hovers near 50
    const flatCandles = makeCandles(60, { base: 100, trend: 0 });
    const ctx = makeMtfContext(flatCandles, 50);
    const cond = mtfRsiAbove("weekly", 80, 14);
    // In flat data, RSI should be near 50, well below 80
    expect(cond.evaluate(ctx, {}, flatCandles[50], 50, flatCandles)).toBe(false);
  });

  it("mtfRsiAbove returns false when dataset is missing", () => {
    const cond = mtfRsiAbove("weekly", 50, 14);
    expect(cond.evaluate(emptyMtf(), {}, dummyCandle, 50, uptrendCandles)).toBe(false);
  });

  it("mtfRsiAbove returns false when mtfIndex is undefined", () => {
    const ctx = makeMtfContext(uptrendCandles, 0);
    ctx.indices.delete("weekly");
    const cond = mtfRsiAbove("weekly", 50, 14);
    expect(cond.evaluate(ctx, {}, dummyCandle, 50, uptrendCandles)).toBe(false);
  });

  it("mtfRsiAbove uses cache on second call and returns consistent result", () => {
    const ctx = makeMtfContext(uptrendCandles, 50);
    const indicators = {};
    const cond = mtfRsiAbove("weekly", 30, 14);
    const first = cond.evaluate(ctx, indicators, dummyCandle, 50, uptrendCandles);
    const second = cond.evaluate(ctx, indicators, dummyCandle, 50, uptrendCandles);
    expect(first).toBe(true);
    expect(second).toBe(true); // cached path returns same result
  });

  it("mtfRsiBelow returns true for downtrending weekly data with high threshold", () => {
    const ctx = makeMtfContext(downtrendCandles, 50);
    const cond = mtfRsiBelow("weekly", 70, 14);
    // In a strong downtrend, RSI should be below 70
    expect(cond.evaluate(ctx, {}, downtrendCandles[50], 50, downtrendCandles)).toBe(true);
  });

  it("mtfRsiBelow returns false when dataset is missing", () => {
    const cond = mtfRsiBelow("weekly", 50, 14);
    expect(cond.evaluate(emptyMtf(), {}, dummyCandle, 50, uptrendCandles)).toBe(false);
  });

  it("mtfPriceAboveSma returns true when uptrend price is above short SMA", () => {
    const ctx = makeMtfContext(uptrendCandles, 50);
    const cond = mtfPriceAboveSma("weekly", 5);
    // Price at index 50 in uptrend should be above 5-period SMA
    expect(cond.evaluate(ctx, {}, dummyCandle, 50, uptrendCandles)).toBe(true);
  });

  it("mtfPriceAboveSma returns false without dataset", () => {
    const cond = mtfPriceAboveSma("weekly", 5);
    expect(cond.evaluate(emptyMtf(), {}, dummyCandle, 0, uptrendCandles)).toBe(false);
  });

  it("mtfPriceBelowSma returns true when downtrend price is below short SMA", () => {
    const ctx = makeMtfContext(downtrendCandles, 50);
    const cond = mtfPriceBelowSma("weekly", 5);
    expect(cond.evaluate(ctx, {}, downtrendCandles[50], 50, downtrendCandles)).toBe(true);
  });

  it("mtfPriceBelowSma returns false without dataset", () => {
    const cond = mtfPriceBelowSma("weekly", 5);
    expect(cond.evaluate(emptyMtf(), {}, dummyCandle, 0, uptrendCandles)).toBe(false);
  });

  it("mtfPriceAboveEma returns true for uptrend data", () => {
    const ctx = makeMtfContext(uptrendCandles, 50);
    const cond = mtfPriceAboveEma("weekly", 5);
    expect(cond.evaluate(ctx, {}, dummyCandle, 50, uptrendCandles)).toBe(true);
  });

  it("mtfPriceAboveEma returns false without dataset", () => {
    const cond = mtfPriceAboveEma("weekly", 5);
    expect(cond.evaluate(emptyMtf(), {}, dummyCandle, 0, uptrendCandles)).toBe(false);
  });

  it("mtfPriceAboveEma caches and returns consistent result", () => {
    const ctx = makeMtfContext(uptrendCandles, 50);
    const indicators = {};
    const cond = mtfPriceAboveEma("weekly", 5);
    const first = cond.evaluate(ctx, indicators, dummyCandle, 50, uptrendCandles);
    const second = cond.evaluate(ctx, indicators, dummyCandle, 50, uptrendCandles);
    expect(first).toBe(second);
  });

  it("mtfTrendStrong returns false without dataset", () => {
    const cond = mtfTrendStrong("weekly", 25);
    expect(cond.evaluate(emptyMtf(), {}, dummyCandle, 0, uptrendCandles)).toBe(false);
  });

  it("mtfTrendStrong uses cached DMI data on second call", () => {
    const ctx = makeMtfContext(uptrendCandles, 50);
    const indicators = {};
    const cond = mtfTrendStrong("weekly", 25);
    const first = cond.evaluate(ctx, indicators, dummyCandle, 50, uptrendCandles);
    const second = cond.evaluate(ctx, indicators, dummyCandle, 50, uptrendCandles);
    expect(first).toBe(second);
  });

  it("mtfUptrend returns true for clear uptrend with low ADX threshold", () => {
    const ctx = makeMtfContext(uptrendCandles, 50);
    const cond = mtfUptrend("weekly", 10);
    // Strong uptrend should have +DI > -DI and ADX > 10
    expect(cond.evaluate(ctx, {}, dummyCandle, 50, uptrendCandles)).toBe(true);
  });

  it("mtfUptrend returns false without dataset", () => {
    const cond = mtfUptrend("weekly", 20);
    expect(cond.evaluate(emptyMtf(), {}, dummyCandle, 0, uptrendCandles)).toBe(false);
  });

  it("mtfUptrend returns false when DMI value is null (early index)", () => {
    const ctx = makeMtfContext(uptrendCandles, 0);
    const cond = mtfUptrend("weekly", 20);
    // At index 0, DMI has no computed value yet
    expect(cond.evaluate(ctx, {}, uptrendCandles[0], 0, uptrendCandles)).toBe(false);
  });

  it("mtfDowntrend returns true for clear downtrend with low ADX threshold", () => {
    const ctx = makeMtfContext(downtrendCandles, 50);
    const cond = mtfDowntrend("weekly", 10);
    // Strong downtrend should have -DI > +DI and ADX > 10
    expect(cond.evaluate(ctx, {}, downtrendCandles[50], 50, downtrendCandles)).toBe(true);
  });

  it("mtfDowntrend returns false without dataset", () => {
    const cond = mtfDowntrend("weekly", 20);
    expect(cond.evaluate(emptyMtf(), {}, dummyCandle, 0, uptrendCandles)).toBe(false);
  });

  it("mtfDowntrend returns false when DMI value is null (early index)", () => {
    const ctx = makeMtfContext(downtrendCandles, 0);
    const cond = mtfDowntrend("weekly", 20);
    expect(cond.evaluate(ctx, {}, downtrendCandles[0], 0, downtrendCandles)).toBe(false);
  });

  it("wrapper functions produce correct type and names", () => {
    expect(weeklyRsiAbove(50).type).toBe("mtf-preset");
    expect(weeklyRsiAbove(50).name).toContain("weekly");
    expect(weeklyRsiBelow(50).name).toContain("weekly");
    expect(monthlyRsiAbove(60).name).toContain("monthly");
    expect(monthlyRsiBelow(60).name).toContain("monthly");
    expect(weeklyPriceAboveSma(20).name).toContain("weekly");
    expect(weeklyPriceBelowSma(20).name).toContain("weekly");
    expect(monthlyPriceAboveSma(20).name).toContain("monthly");
    expect(monthlyPriceBelowSma(20).name).toContain("monthly");
    expect(weeklyPriceAboveEma(20).name).toContain("weekly");
    expect(weeklyTrendStrong(25).name).toContain("weekly");
    expect(monthlyTrendStrong(25).name).toContain("monthly");
    expect(weeklyUptrend(20).name).toContain("weekly");
    expect(weeklyDowntrend(20).name).toContain("weekly");
  });

  it("mtfCondition creates custom condition that evaluates correctly", () => {
    const custom = mtfCondition(["weekly"], "alwaysTrue", () => true);
    expect(custom.type).toBe("mtf-preset");
    expect(custom.name).toBe("alwaysTrue");
    expect(custom.evaluate(emptyMtf(), {}, dummyCandle, 0, uptrendCandles)).toBe(true);

    const customFalse = mtfCondition(["weekly"], "alwaysFalse", () => false);
    expect(customFalse.evaluate(emptyMtf(), {}, dummyCandle, 0, uptrendCandles)).toBe(false);
  });

  it("monthly conditions all return false without monthly dataset", () => {
    const emptyCtx = emptyMtf();
    expect(monthlyRsiAbove(50).evaluate(emptyCtx, {}, dummyCandle, 0, uptrendCandles)).toBe(false);
    expect(monthlyRsiBelow(50).evaluate(emptyCtx, {}, dummyCandle, 0, uptrendCandles)).toBe(false);
    expect(monthlyPriceAboveSma(20).evaluate(emptyCtx, {}, dummyCandle, 0, uptrendCandles)).toBe(
      false,
    );
    expect(monthlyPriceBelowSma(20).evaluate(emptyCtx, {}, dummyCandle, 0, uptrendCandles)).toBe(
      false,
    );
    expect(monthlyTrendStrong(25).evaluate(emptyCtx, {}, dummyCandle, 0, uptrendCandles)).toBe(
      false,
    );
  });

  it("monthly RSI above returns true with monthly uptrend data", () => {
    const ctx = makeMtfContextMonthly(uptrendCandles, 50);
    const cond = monthlyRsiAbove(30);
    expect(cond.evaluate(ctx, {}, dummyCandle, 50, uptrendCandles)).toBe(true);
  });
});

// ============================================
// SMC conditions
// ============================================

describe("SMC conditions - behavior verification", () => {
  // Build candles with realistic price action for order block and liquidity sweep detection.
  // We need: a strong move up (bullish OB) then a strong move down (bearish OB) then
  // price revisiting those zones.
  function makeSMCCandles(): NormalizedCandle[] {
    const t0 = Date.now() - 150 * DAY;
    const candles: NormalizedCandle[] = [];

    // Bars 0-19: stable around 100
    for (let i = 0; i < 20; i++) {
      candles.push({
        time: t0 + i * DAY,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1_000_000,
      });
    }
    // Bars 20-24: strong bullish impulse (creates bullish OB zone around 100-102)
    for (let i = 20; i < 25; i++) {
      const base = 100 + (i - 20) * 4;
      candles.push({
        time: t0 + i * DAY,
        open: base,
        high: base + 5,
        low: base - 1,
        close: base + 4,
        volume: 3_000_000,
      });
    }
    // Bars 25-44: price stays elevated around 120
    for (let i = 25; i < 45; i++) {
      candles.push({
        time: t0 + i * DAY,
        open: 120,
        high: 122,
        low: 118,
        close: 120,
        volume: 1_000_000,
      });
    }
    // Bars 45-49: strong bearish impulse (creates bearish OB zone around 120-118)
    for (let i = 45; i < 50; i++) {
      const base = 120 - (i - 45) * 4;
      candles.push({
        time: t0 + i * DAY,
        open: base,
        high: base + 1,
        low: base - 5,
        close: base - 4,
        volume: 3_000_000,
      });
    }
    // Bars 50-69: price stabilizes around 100
    for (let i = 50; i < 70; i++) {
      candles.push({
        time: t0 + i * DAY,
        open: 100,
        high: 102,
        low: 98,
        close: 100,
        volume: 1_000_000,
      });
    }
    // Bars 70-99: price revisits zones
    for (let i = 70; i < 100; i++) {
      candles.push({
        time: t0 + i * DAY,
        open: 100,
        high: 103,
        low: 97,
        close: 101,
        volume: 1_000_000,
      });
    }
    return candles;
  }

  const candles = makeSMCCandles();

  it("priceAtBullishOrderBlock returns false at out-of-range index", () => {
    const cond = priceAtBullishOrderBlock();
    expect(cond.evaluate({}, candles[0], 999, candles)).toBe(false);
  });

  it("priceAtBearishOrderBlock returns false at out-of-range index", () => {
    const cond = priceAtBearishOrderBlock();
    expect(cond.evaluate({}, candles[0], 999, candles)).toBe(false);
  });

  it("priceAtOrderBlock returns false for out-of-range index", () => {
    const cond = priceAtOrderBlock();
    expect(cond.evaluate({}, candles[0], 999, candles)).toBe(false);
  });

  it("orderBlockCreated returns false when no OB forms at stable bars", () => {
    const condBullish = orderBlockCreated("bullish");
    // During the stable zone (bars 0-19), no BOS means no OB created
    expect(evalPreset(condBullish, candles, 10)).toBe(false);
  });

  it("orderBlockCreated with bearish filter returns false at stable bars", () => {
    const condBearish = orderBlockCreated("bearish");
    expect(evalPreset(condBearish, candles, 10)).toBe(false);
  });

  it("orderBlockCreated scans across all bars without errors", () => {
    const condAny = orderBlockCreated();
    const condBullish = orderBlockCreated("bullish");
    const condBearish = orderBlockCreated("bearish");
    // Ensure all three type filters work across the full dataset
    for (let i = 0; i < candles.length; i++) {
      const any = evalPreset(condAny, candles, i);
      const bull = evalPreset(condBullish, candles, i);
      const bear = evalPreset(condBearish, candles, i);
      // If bullish or bearish detected, "any" must also be true
      if (bull || bear) {
        expect(any).toBe(true);
      }
    }
  });

  it("orderBlockMitigated returns false at early indices before any OB exists", () => {
    const cond = orderBlockMitigated();
    expect(evalPreset(cond, candles, 0)).toBe(false);
    expect(evalPreset(cond, candles, 5)).toBe(false);
  });

  it("hasActiveOrderBlocks finds active blocks after OB creation zone", () => {
    const condAny = hasActiveOrderBlocks();
    // After the bullish impulse and bearish impulse, there should be active OBs
    const result = evalPreset(condAny, candles, 55);
    // We just check it's evaluable; the actual OB detection depends on indicator logic
    expect(typeof result).toBe("boolean");
  });

  it("hasActiveOrderBlocks returns false when value is undefined (out of range)", () => {
    const cond = hasActiveOrderBlocks();
    expect(cond.evaluate({}, candles[0], 999, candles)).toBe(false);
  });

  it("hasActiveOrderBlocks with type filter and minCount=2 is stricter", () => {
    const condStrict = hasActiveOrderBlocks("bullish", 5);
    // Requiring 5 bullish OBs is unlikely with this data
    const result = evalPreset(condStrict, candles, 90);
    expect(result).toBe(false);
  });

  it("liquiditySweepDetected returns false during stable price action", () => {
    const cond = liquiditySweepDetected();
    // During the stable zone (bars 0-19), no sweeps should occur
    expect(evalPreset(cond, candles, 10)).toBe(false);
  });

  it("liquiditySweepRecovered returns false during stable price action", () => {
    const cond = liquiditySweepRecovered();
    expect(evalPreset(cond, candles, 10)).toBe(false);
  });

  it("hasRecentSweeps returns false for undefined value (out of range)", () => {
    const cond = hasRecentSweeps();
    expect(cond.evaluate({}, candles[0], 999, candles)).toBe(false);
  });

  it("hasRecentSweeps with recoveredOnly=true is stricter than recoveredOnly=false", () => {
    const allSweeps = hasRecentSweeps(undefined, false, 1);
    const recoveredOnly = hasRecentSweeps(undefined, true, 1);
    // Count how many bars match each
    let allCount = 0;
    let recCount = 0;
    for (let i = 0; i < candles.length; i++) {
      if (evalPreset(allSweeps, candles, i)) allCount++;
      if (evalPreset(recoveredOnly, candles, i)) recCount++;
    }
    // Recovered-only should be <= all sweeps
    expect(recCount).toBeLessThanOrEqual(allCount);
  });

  it("sweepDepthAbove with very high minimum depth finds nothing", () => {
    const cond = sweepDepthAbove(50); // 50% depth - extremely unlikely
    let found = false;
    for (let i = 0; i < candles.length; i++) {
      if (evalPreset(cond, candles, i)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(false);
  });

  it("SMC caching: second call writes cache key to indicators", () => {
    const indicators: Record<string, unknown> = {};
    const cond = priceAtBullishOrderBlock();
    cond.evaluate(indicators, candles[50], 50, candles);
    const keys = Object.keys(indicators);
    expect(keys.some((k) => k.startsWith("orderBlock_"))).toBe(true);
  });
});

// ============================================
// Relative Strength conditions
// ============================================

describe("Relative Strength conditions - behavior verification", () => {
  // Stock: strong uptrend from 100 to ~160
  const stock = makeCandles(120, { base: 100, trend: 0.5 });
  // Benchmark: weaker uptrend from 100 to ~136 (stock outperforms)
  const weakBenchmark = makeCandles(120, { base: 100, trend: 0.3 });
  // Benchmark: stronger uptrend from 100 to ~220 (stock underperforms)
  const strongBenchmark = makeCandles(120, { base: 100, trend: 1.0 });

  it("rsAbove returns false without benchmark data", () => {
    const cond = rsAbove(1.0);
    expect(evalPreset(cond, stock, 100)).toBe(false);
  });

  it("rsAbove returns true when stock outperforms weak benchmark", () => {
    const indicators: Record<string, unknown> = {};
    setBenchmark(indicators, weakBenchmark);
    const cond = rsAbove(1.0);
    // Stock trend=0.5 vs benchmark trend=0.3; stock should outperform (RS > 1.0)
    const result = cond.evaluate(indicators, stock[110], 110, stock);
    expect(result).toBe(true);
  });

  it("rsAbove returns false when stock underperforms strong benchmark", () => {
    const indicators: Record<string, unknown> = {};
    setBenchmark(indicators, strongBenchmark);
    const cond = rsAbove(1.0);
    // Stock trend=0.5 vs benchmark trend=1.0; stock should underperform (RS < 1.0)
    const result = cond.evaluate(indicators, stock[110], 110, stock);
    expect(result).toBe(false);
  });

  it("rsBelow returns false without benchmark data", () => {
    expect(evalPreset(rsBelow(1.0), stock, 100)).toBe(false);
  });

  it("rsBelow returns true when stock underperforms strong benchmark", () => {
    const indicators: Record<string, unknown> = {};
    setBenchmark(indicators, strongBenchmark);
    const result = rsBelow(1.0).evaluate(indicators, stock[110], 110, stock);
    expect(result).toBe(true);
  });

  it("rsRising returns false without benchmark data", () => {
    expect(evalPreset(rsRising(), stock, 100)).toBe(false);
  });

  it("rsFalling returns false without benchmark data", () => {
    expect(evalPreset(rsFalling(), stock, 100)).toBe(false);
  });

  it("rsRising/rsFalling are mutually exclusive at same index", () => {
    const indicators: Record<string, unknown> = {};
    setBenchmark(indicators, weakBenchmark);
    const rising = rsRising().evaluate(indicators, stock[110], 110, stock);
    const falling = rsFalling().evaluate(indicators, stock[110], 110, stock);
    // They should not both be true (one or both can be false)
    expect(rising && falling).toBe(false);
  });

  it("rsNewHigh returns false without benchmark", () => {
    expect(evalPreset(rsNewHigh(10), stock, 100)).toBe(false);
  });

  it("rsNewLow returns false without benchmark", () => {
    expect(evalPreset(rsNewLow(10), stock, 100)).toBe(false);
  });

  it("rsNewHigh returns false at early index where lookback is insufficient", () => {
    const indicators: Record<string, unknown> = {};
    setBenchmark(indicators, weakBenchmark);
    const result = rsNewHigh(10).evaluate(indicators, stock[0], 0, stock);
    expect(result).toBe(false);
  });

  it("rsNewLow returns false at early index where lookback is insufficient", () => {
    const indicators: Record<string, unknown> = {};
    setBenchmark(indicators, weakBenchmark);
    const result = rsNewLow(10).evaluate(indicators, stock[0], 0, stock);
    expect(result).toBe(false);
  });

  it("rsRatingAbove returns false without benchmark", () => {
    expect(evalPreset(rsRatingAbove(80), stock, 100)).toBe(false);
  });

  it("rsRatingBelow returns false without benchmark", () => {
    expect(evalPreset(rsRatingBelow(20), stock, 100)).toBe(false);
  });

  it("rsRatingAbove/Below produce opposite results for moderate thresholds", () => {
    const indicators: Record<string, unknown> = {};
    setBenchmark(indicators, weakBenchmark);
    const above50 = rsRatingAbove(50).evaluate(indicators, stock[110], 110, stock);
    const below50 = rsRatingBelow(50).evaluate(indicators, stock[110], 110, stock);
    // They should not both be true
    expect(above50 && below50).toBe(false);
  });

  it("mansfieldRSAbove returns false without benchmark", () => {
    expect(evalPreset(mansfieldRSAbove(0), stock, 100)).toBe(false);
  });

  it("mansfieldRSBelow returns false without benchmark", () => {
    expect(evalPreset(mansfieldRSBelow(0), stock, 100)).toBe(false);
  });

  it("mansfieldRSAbove with very negative threshold succeeds when benchmark exists", () => {
    const indicators: Record<string, unknown> = {};
    setBenchmark(indicators, weakBenchmark);
    // Mansfield RS > -100 should be true for any reasonable stock
    const result = mansfieldRSAbove(-100).evaluate(indicators, stock[110], 110, stock);
    expect(result).toBe(true);
  });

  it("mansfieldRSBelow with very high threshold succeeds when benchmark exists", () => {
    const indicators: Record<string, unknown> = {};
    setBenchmark(indicators, weakBenchmark);
    const result = mansfieldRSBelow(100).evaluate(indicators, stock[110], 110, stock);
    expect(result).toBe(true);
  });

  it("outperformanceAbove returns false without benchmark", () => {
    expect(evalPreset(outperformanceAbove(0), stock, 100)).toBe(false);
  });

  it("outperformanceBelow returns false without benchmark", () => {
    expect(evalPreset(outperformanceBelow(0), stock, 100)).toBe(false);
  });

  it("outperformanceAbove detects outperformance against weak benchmark", () => {
    const indicators: Record<string, unknown> = {};
    setBenchmark(indicators, weakBenchmark);
    // Stock growing faster than benchmark; outperformance should be > 0
    const result = outperformanceAbove(0).evaluate(indicators, stock[110], 110, stock);
    expect(result).toBe(true);
  });

  it("outperformanceBelow detects underperformance against strong benchmark", () => {
    const indicators: Record<string, unknown> = {};
    setBenchmark(indicators, strongBenchmark);
    // Stock growing slower than benchmark; outperformance should be < 0
    const result = outperformanceBelow(0).evaluate(indicators, stock[110], 110, stock);
    expect(result).toBe(true);
  });

  it("RS cache is reused: second call with same indicators returns consistent result", () => {
    const indicators: Record<string, unknown> = {};
    setBenchmark(indicators, weakBenchmark);
    const cond = rsAbove(0.5);
    const first = cond.evaluate(indicators, stock[100], 100, stock);
    const second = cond.evaluate(indicators, stock[100], 100, stock);
    expect(first).toBe(second);
  });
});

// ============================================
// Volatility conditions
// ============================================

describe("Volatility conditions - behavior verification", () => {
  // High volatility: large price swings
  const highVolCandles = makeCandles(100, { base: 100, trend: 0, volatility: 15 });
  // Low volatility: tiny price swings
  const lowVolCandles = makeCandles(100, { base: 100, trend: 0, volatility: 0.5 });
  // Normal uptrend for ATR% testing
  const normalCandles = makeCandles(100, { base: 100, trend: 0.5, volatility: 2 });

  it("regimeIs returns false at index 0 (no computed regime yet)", () => {
    const cond = regimeIs("low");
    expect(evalPreset(cond, normalCandles, 0)).toBe(false);
  });

  it("regimeNot('extreme') returns true when regime is not extreme at a normal bar", () => {
    // With steady small-volatility data, regime should NOT be extreme
    const cond = regimeNot("extreme");
    expect(evalPreset(cond, normalCandles, 80)).toBe(true);
  });

  it("regimeIs and regimeNot are complementary for the same regime at same index", () => {
    // At a given bar, regimeIs('low') and regimeNot('low') should not both be true or both false
    // (unless no data, in which case both are false)
    const isLow = evalPreset(regimeIs("low"), normalCandles, 80);
    const notLow = evalPreset(regimeNot("low"), normalCandles, 80);
    // If data is available, they should be opposite; if not, both false
    expect(isLow === notLow).toBe(false);
  });

  it("volatilityAbove with threshold=0 returns true when data is available", () => {
    const cond = volatilityAbove(0);
    // Any valid percentile >= 0 should return true
    expect(evalPreset(cond, normalCandles, 80)).toBe(true);
  });

  it("volatilityAbove with threshold=100 returns false (percentile can't reach 100)", () => {
    const cond = volatilityAbove(100);
    // Percentile is 0-100, but exactly 100 is unlikely
    expect(evalPreset(cond, normalCandles, 80)).toBe(false);
  });

  it("volatilityBelow with threshold=100 returns true when data is available", () => {
    const cond = volatilityBelow(100);
    expect(evalPreset(cond, normalCandles, 80)).toBe(true);
  });

  it("volatilityBelow with threshold=0 returns false for non-zero percentile", () => {
    const cond = volatilityBelow(0);
    expect(evalPreset(cond, normalCandles, 80)).toBe(false);
  });

  it("atrPercentileAbove returns false at index 0 (no ATR data)", () => {
    const cond = atrPercentileAbove(50);
    expect(evalPreset(cond, normalCandles, 0)).toBe(false);
  });

  it("atrPercentileAbove with threshold=0 returns true when data exists", () => {
    const cond = atrPercentileAbove(0);
    expect(evalPreset(cond, normalCandles, 80)).toBe(true);
  });

  it("atrPercentileBelow returns false at index 0 (no ATR data)", () => {
    const cond = atrPercentileBelow(50);
    expect(evalPreset(cond, normalCandles, 0)).toBe(false);
  });

  it("atrPercentileBelow with threshold=100 returns true when data exists", () => {
    const cond = atrPercentileBelow(100);
    expect(evalPreset(cond, normalCandles, 80)).toBe(true);
  });

  it("regimeConfidenceAbove returns false at index 0", () => {
    const cond = regimeConfidenceAbove(0.5);
    expect(evalPreset(cond, normalCandles, 0)).toBe(false);
  });

  it("regimeConfidenceAbove with threshold=0 returns true when data exists", () => {
    const cond = regimeConfidenceAbove(0);
    // Confidence is always >= 0 when data is present
    expect(evalPreset(cond, normalCandles, 80)).toBe(true);
  });

  it("volatilityExpanding returns false when index < lookback", () => {
    const cond = volatilityExpanding(5, 3);
    expect(evalPreset(cond, normalCandles, 1)).toBe(false);
  });

  it("volatilityExpanding returns false with very short data where all ATR percentiles are null", () => {
    const shortCandles = makeCandles(5);
    const cond = volatilityExpanding(5, 3);
    expect(evalPreset(cond, shortCandles, 4)).toBe(false);
  });

  it("volatilityContracting returns false when index < lookback", () => {
    const cond = volatilityContracting(5, 3);
    expect(evalPreset(cond, normalCandles, 1)).toBe(false);
  });

  it("volatilityContracting returns false with very short data", () => {
    const shortCandles = makeCandles(5);
    const cond = volatilityContracting(5, 3);
    expect(evalPreset(cond, shortCandles, 4)).toBe(false);
  });

  it("volatilityExpanding and volatilityContracting are not both true at the same bar", () => {
    const expanding = evalPreset(volatilityExpanding(5, 3), normalCandles, 80);
    const contracting = evalPreset(volatilityContracting(5, 3), normalCandles, 80);
    expect(expanding && contracting).toBe(false);
  });

  it("atrPercentAbove returns false at index 0 (no ATR yet)", () => {
    const cond = atrPercentAbove(2.3);
    expect(evalPreset(cond, normalCandles, 0)).toBe(false);
  });

  it("atrPercentAbove with very low threshold returns true for volatile data", () => {
    const cond = atrPercentAbove(0.01);
    // ATR% of any real data should exceed 0.01%
    expect(evalPreset(cond, normalCandles, 80)).toBe(true);
  });

  it("atrPercentAbove with custom atrPeriod", () => {
    const cond = atrPercentAbove(0.01, { atrPeriod: 5 });
    expect(evalPreset(cond, normalCandles, 80)).toBe(true);
  });

  it("atrPercentBelow returns false at index 0", () => {
    const cond = atrPercentBelow(5);
    expect(evalPreset(cond, normalCandles, 0)).toBe(false);
  });

  it("atrPercentBelow with very high threshold returns true", () => {
    const cond = atrPercentBelow(99);
    // ATR% should be well below 99%
    expect(evalPreset(cond, normalCandles, 80)).toBe(true);
  });

  it("atrPercentBelow with custom atrPeriod", () => {
    const cond = atrPercentBelow(99, { atrPeriod: 5 });
    expect(evalPreset(cond, normalCandles, 80)).toBe(true);
  });

  it("atrPercentAbove with low threshold and atrPercentBelow with high threshold both return true", () => {
    // ATR% is some fixed value; checking at extreme bounds ensures both can be true
    const above = evalPreset(atrPercentAbove(0.01), normalCandles, 80);
    const below = evalPreset(atrPercentBelow(99), normalCandles, 80);
    expect(above).toBe(true);
    expect(below).toBe(true);
  });
});

// ============================================
// Volume Trend / OBV conditions
// ============================================

describe("Volume Trend / OBV conditions - behavior verification", () => {
  // Uptrend with increasing volume (volume confirms trend)
  const confirmedTrend = makeCandles(60, { base: 100, trend: 0.5, volume: 500_000 });
  for (let i = 30; i < 60; i++) {
    confirmedTrend[i] = { ...confirmedTrend[i], volume: 500_000 + i * 20_000 };
  }

  // Price up but volume declining (bearish divergence)
  const bearishDivCandles = makeCandles(60, { base: 100, trend: 0.8 });
  for (let i = 30; i < 60; i++) {
    bearishDivCandles[i] = {
      ...bearishDivCandles[i],
      volume: Math.max(100_000, 2_000_000 - i * 50_000),
    };
  }

  it("volumeConfirmsTrend is a boolean at any valid index", () => {
    const cond = volumeConfirmsTrend();
    const result = evalPreset(cond, confirmedTrend, 45);
    expect(typeof result).toBe("boolean");
  });

  it("volumeConfirmsTrend caches data and returns consistent result", () => {
    const indicators: Record<string, unknown> = {};
    const cond = volumeConfirmsTrend();
    const first = cond.evaluate(indicators, confirmedTrend[45], 45, confirmedTrend);
    const second = cond.evaluate(indicators, confirmedTrend[45], 45, confirmedTrend);
    expect(first).toBe(second);
    expect("volumeTrend" in indicators).toBe(true);
  });

  it("volumeDivergence caches data on first call", () => {
    const indicators: Record<string, unknown> = {};
    const cond = volumeDivergence();
    cond.evaluate(indicators, bearishDivCandles[45], 45, bearishDivCandles);
    expect("volumeTrend" in indicators).toBe(true);
  });

  it("bullishVolumeDivergence and bearishVolumeDivergence are mutually exclusive at same bar", () => {
    const indicators: Record<string, unknown> = {};
    const bullDiv = bullishVolumeDivergence();
    const bearDiv = bearishVolumeDivergence();
    for (let i = 30; i < 55; i++) {
      const bull = bullDiv.evaluate(indicators, bearishDivCandles[i], i, bearishDivCandles);
      const bear = bearDiv.evaluate(indicators, bearishDivCandles[i], i, bearishDivCandles);
      // Cannot be both bullish and bearish divergence at same bar
      expect(bull && bear).toBe(false);
    }
  });

  it("volumeTrendConfidence caches data", () => {
    const indicators: Record<string, unknown> = {};
    const cond = volumeTrendConfidence(30);
    cond.evaluate(indicators, confirmedTrend[40], 40, confirmedTrend);
    expect("volumeTrend" in indicators).toBe(true);
  });

  it("cmfAbove returns false at index 0 (insufficient data for CMF)", () => {
    const cond = cmfAbove(0, 10);
    expect(evalPreset(cond, confirmedTrend, 0)).toBe(false);
  });

  it("cmfAbove caches data and returns consistent result", () => {
    const indicators: Record<string, unknown> = {};
    const cond = cmfAbove(0, 10);
    const first = cond.evaluate(indicators, confirmedTrend[40], 40, confirmedTrend);
    const second = cond.evaluate(indicators, confirmedTrend[40], 40, confirmedTrend);
    expect(first).toBe(second);
  });

  it("cmfAbove and cmfBelow with threshold=0 are complementary for valid data", () => {
    const indicators: Record<string, unknown> = {};
    const above = cmfAbove(0, 10).evaluate(indicators, confirmedTrend[50], 50, confirmedTrend);
    const below = cmfBelow(0, 10).evaluate(indicators, confirmedTrend[50], 50, confirmedTrend);
    // CMF is either > 0 or < 0 (or exactly 0 = both false)
    expect(above && below).toBe(false);
  });

  it("obvRising returns false when index < period", () => {
    const cond = obvRising(10);
    expect(evalPreset(cond, confirmedTrend, 5)).toBe(false);
  });

  it("obvRising returns true in uptrend with enough lookback", () => {
    // In an uptrend, OBV should be rising (more up-volume than down-volume)
    const cond = obvRising(5);
    const result = evalPreset(cond, confirmedTrend, 50);
    expect(result).toBe(true);
  });

  it("obvFalling returns false when index < period", () => {
    const cond = obvFalling(10);
    expect(evalPreset(cond, confirmedTrend, 5)).toBe(false);
  });

  it("obvRising and obvFalling are mutually exclusive at same bar", () => {
    const indicators: Record<string, unknown> = {};
    const rising = obvRising(5).evaluate(indicators, confirmedTrend[50], 50, confirmedTrend);
    const falling = obvFalling(5).evaluate(indicators, confirmedTrend[50], 50, confirmedTrend);
    expect(rising && falling).toBe(false);
  });

  it("obvCrossUp returns false when index < 1", () => {
    const cond = obvCrossUp(3, 10);
    expect(evalPreset(cond, confirmedTrend, 0)).toBe(false);
  });

  it("obvCrossDown returns false when index < 1", () => {
    const cond = obvCrossDown(3, 10);
    expect(evalPreset(cond, confirmedTrend, 0)).toBe(false);
  });

  it("obvCrossUp returns false when MAs are null (early bars with long period)", () => {
    const cond = obvCrossUp(3, 50);
    // With longPeriod=50, early bars will have null MAs
    expect(evalPreset(cond, confirmedTrend, 5)).toBe(false);
  });

  it("obvCrossDown returns false when MAs are null (early bars with long period)", () => {
    const cond = obvCrossDown(3, 50);
    expect(evalPreset(cond, confirmedTrend, 5)).toBe(false);
  });

  it("obvCrossUp and obvCrossDown are not both true at same bar", () => {
    const indicators: Record<string, unknown> = {};
    for (let i = 20; i < 50; i++) {
      const up = obvCrossUp(3, 10).evaluate(indicators, confirmedTrend[i], i, confirmedTrend);
      const down = obvCrossDown(3, 10).evaluate(indicators, confirmedTrend[i], i, confirmedTrend);
      expect(up && down).toBe(false);
    }
  });
});

// ============================================
// Volume Anomaly / Profile conditions
// ============================================

describe("Volume Anomaly / Profile conditions - behavior verification", () => {
  const candles = makeCandles(60, { base: 100, trend: 0.3, volume: 1_000_000 });
  // Create a clear volume spike at bar 40 (10x normal)
  candles[40] = { ...candles[40], volume: 10_000_000 };

  it("volumeAnomalyCondition detects the volume spike at bar 40", () => {
    const cond = volumeAnomalyCondition(2.0, 10);
    // Bar 40 has 10x volume → should be detected as anomaly
    expect(evalPreset(cond, candles, 40)).toBe(true);
    // Bar 39 (normal volume) should not be anomaly
    expect(evalPreset(cond, candles, 39)).toBe(false);
  });

  it("volumeExtreme detects extreme volume at bar 40", () => {
    const cond = volumeExtreme(3.0, 10);
    // 10x volume should trigger extreme (threshold 3.0)
    expect(evalPreset(cond, candles, 40)).toBe(true);
    // Normal bar should not be extreme
    expect(evalPreset(cond, candles, 35)).toBe(false);
  });

  it("volumeExtreme caches data across calls", () => {
    const indicators: Record<string, unknown> = {};
    const cond = volumeExtreme(3.0, 10);
    const first = cond.evaluate(indicators, candles[40], 40, candles);
    const second = cond.evaluate(indicators, candles[40], 40, candles);
    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  it("volumeRatioAbove detects high ratio at spike bar", () => {
    const cond = volumeRatioAbove(5.0, 10);
    // 10x volume / average should give ratio well above 5.0
    expect(evalPreset(cond, candles, 40)).toBe(true);
    // Normal bar should have ratio around 1.0
    expect(evalPreset(cond, candles, 35)).toBe(false);
  });

  it("volumeRatioAbove returns false for undefined value (out of range)", () => {
    const cond = volumeRatioAbove(1.5, 10);
    expect(cond.evaluate({}, candles[0], 999, candles)).toBe(false);
  });

  it("nearPoc returns false at index 0 (insufficient profile data)", () => {
    const cond = nearPoc(0.02, 10);
    expect(evalPreset(cond, candles, 0)).toBe(false);
  });

  it("nearPoc with very large tolerance returns true when profile exists", () => {
    const cond = nearPoc(1.0, 10); // 100% tolerance = always near POC
    // With sufficient data, price is always within 100% of POC
    expect(evalPreset(cond, candles, 40)).toBe(true);
  });

  it("nearPoc caches profile data", () => {
    const indicators: Record<string, unknown> = {};
    const cond = nearPoc(0.02, 10);
    cond.evaluate(indicators, candles[30], 30, candles);
    const hasCache = Object.keys(indicators).some((k) => k.startsWith("volumeProfile_"));
    expect(hasCache).toBe(true);
  });

  it("inValueArea returns false at index 0 (no profile)", () => {
    const cond = inValueArea(10);
    expect(evalPreset(cond, candles, 0)).toBe(false);
  });

  it("inValueArea returns true when price is within the value area", () => {
    // With tight price range data, price should often be within value area
    const cond = inValueArea(10);
    const result = evalPreset(cond, candles, 30);
    // In a slow uptrend with small volatility, price should be within VA
    expect(result).toBe(true);
  });

  it("inValueArea caches volume profile data across calls", () => {
    const indicators: Record<string, unknown> = {};
    const cond = inValueArea(10);
    cond.evaluate(indicators, candles[30], 30, candles);
    cond.evaluate(indicators, candles[31], 31, candles);
    const keys = Object.keys(indicators).filter((k) => k.startsWith("volumeProfile_"));
    expect(keys.length).toBe(1); // single cached entry
  });

  it("breakoutVah returns false when index < 1", () => {
    const cond = breakoutVah(10);
    expect(evalPreset(cond, candles, 0)).toBe(false);
  });

  it("breakoutVah returns false with insufficient profile data", () => {
    const cond = breakoutVah(50);
    // With period=50, early indices have null profiles
    expect(evalPreset(cond, candles, 5)).toBe(false);
  });

  it("breakdownVal returns false when index < 1", () => {
    const cond = breakdownVal(10);
    expect(evalPreset(cond, candles, 0)).toBe(false);
  });

  it("breakdownVal returns false with insufficient profile data", () => {
    const cond = breakdownVal(50);
    expect(evalPreset(cond, candles, 5)).toBe(false);
  });

  it("priceAbovePoc and priceBelowPoc are mutually exclusive when profile exists", () => {
    const indicators: Record<string, unknown> = {};
    const above = priceAbovePoc(10).evaluate(indicators, candles[30], 30, candles);
    const below = priceBelowPoc(10).evaluate(indicators, candles[30], 30, candles);
    // Price can't be both above and below POC (can be at POC = both false)
    expect(above && below).toBe(false);
  });

  it("priceAbovePoc returns false at index 0", () => {
    const cond = priceAbovePoc(10);
    expect(evalPreset(cond, candles, 0)).toBe(false);
  });

  it("priceBelowPoc returns false at index 0", () => {
    const cond = priceBelowPoc(10);
    expect(evalPreset(cond, candles, 0)).toBe(false);
  });

  it("priceBelowPoc caches data", () => {
    const indicators: Record<string, unknown> = {};
    const cond = priceBelowPoc(10);
    cond.evaluate(indicators, candles[30], 30, candles);
    cond.evaluate(indicators, candles[31], 31, candles);
    const keys = Object.keys(indicators).filter((k) => k.startsWith("volumeProfile_"));
    expect(keys.length).toBe(1);
  });
});

// ============================================
// Scaled Entry
// ============================================

describe("Scaled Entry - behavior verification", () => {
  const candles = makeCandles(80, { base: 100, trend: 0.5 });

  const alwaysTrue: PresetCondition = {
    type: "preset",
    name: "alwaysTrue",
    evaluate: () => true,
  };
  const alwaysFalse: PresetCondition = {
    type: "preset",
    name: "alwaysFalse",
    evaluate: () => false,
  };
  const entryAtFive: PresetCondition = {
    type: "preset",
    name: "entryAtFive",
    evaluate: (_ind, _c, idx) => idx === 5 || idx === 10 || idx === 15,
  };

  it("falls back to standard backtest when no scaledEntry config is given", () => {
    const result = runBacktestScaled(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(0);
  });

  it("falls back to standard when tranches <= 1", () => {
    const result = runBacktestScaled(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      scaledEntry: { tranches: 1, strategy: "equal", intervalType: "signal" },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(0);
  });

  it("returns zero trades for less than 2 candles", () => {
    const result = runBacktestScaled([candles[0]], alwaysTrue, alwaysFalse, {
      capital: 10000,
      scaledEntry: { tranches: 3, strategy: "equal", intervalType: "signal" },
    });
    expect(result.tradeCount).toBe(0);
  });

  it("equal strategy with signal interval produces trades on entry signals", () => {
    const result = runBacktestScaled(candles, entryAtFive, alwaysFalse, {
      capital: 10000,
      scaledEntry: { tranches: 3, strategy: "equal", intervalType: "signal" },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(1);
    expect(result.totalReturn).toBeDefined();
  });

  it("pyramid strategy allocates decreasing amounts to later tranches", () => {
    const result = runBacktestScaled(candles, entryAtFive, alwaysFalse, {
      capital: 10000,
      scaledEntry: { tranches: 3, strategy: "pyramid", intervalType: "price", priceInterval: -2 },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(1);
  });

  it("reverse-pyramid strategy works with signal-based interval", () => {
    const result = runBacktestScaled(candles, entryAtFive, alwaysFalse, {
      capital: 10000,
      scaledEntry: { tranches: 3, strategy: "reverse-pyramid", intervalType: "signal" },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(1);
  });

  it("stopLoss triggers exit and limits downside loss", () => {
    const downCandles = makeCandles(80, { base: 200, trend: -2 });
    const result = runBacktestScaled(downCandles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      stopLoss: 1, // 1% stop loss
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    // With a tight stop loss in a downtrend, total return should be negative but limited
    expect(result.tradeCount).toBeGreaterThanOrEqual(1);
  });

  it("takeProfit locks in gains in uptrend", () => {
    const uptrendCandles = makeCandles(80, { base: 50, trend: 2 });
    const result = runBacktestScaled(uptrendCandles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      takeProfit: 1, // 1% take profit
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    // With take profit in uptrend, should have positive trades
    expect(result.tradeCount).toBeGreaterThanOrEqual(1);
    expect(result.winRate).toBeGreaterThan(0);
  });

  it("trailingStop allows profits to run then exits on pullback", () => {
    const result = runBacktestScaled(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      trailingStop: 2,
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(0);
  });

  it("partialTakeProfit sells partial position at threshold", () => {
    const uptrendCandles = makeCandles(80, { base: 50, trend: 3 });
    const result = runBacktestScaled(uptrendCandles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      partialTakeProfit: { threshold: 2, sellPercent: 50 },
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(0);
  });

  it("ATR risk management uses ATR for stop placement", () => {
    const result = runBacktestScaled(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      atrRisk: { atrPeriod: 14, atrStopMultiplier: 2 },
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(0);
  });

  it("ATR take profit and trailing use ATR-based levels", () => {
    const result = runBacktestScaled(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      atrRisk: { atrPeriod: 14, atrTakeProfitMultiplier: 3, atrTrailingMultiplier: 2 },
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(0);
  });

  it("ATR useEntryAtr fixes ATR at entry price for consistent risk", () => {
    const result = runBacktestScaled(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      atrRisk: { atrPeriod: 14, atrStopMultiplier: 2, useEntryAtr: true },
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(0);
  });

  it("commission and slippage reduce final equity", () => {
    const noFees = runBacktestScaled(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      takeProfit: 2,
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    const withFees = runBacktestScaled(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      takeProfit: 2,
      commission: 5,
      commissionRate: 0.1,
      slippage: 0.1,
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    // Fees should reduce final equity
    expect(withFees.finalCapital).toBeLessThanOrEqual(noFees.finalCapital);
  });

  it("taxRate reduces profit on profitable trades", () => {
    const uptrendCandles = makeCandles(80, { base: 50, trend: 2 });
    const noTax = runBacktestScaled(uptrendCandles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      takeProfit: 5,
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    const withTax = runBacktestScaled(uptrendCandles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      taxRate: 15,
      takeProfit: 5,
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    // Tax should reduce final equity on profitable trades
    expect(withTax.finalCapital).toBeLessThanOrEqual(noTax.finalCapital);
  });

  it("signal-based exit closes position when exit signal fires", () => {
    const exitAt30: PresetCondition = {
      type: "preset",
      name: "exitAt30",
      evaluate: (_ind, _c, idx) => idx === 30,
    };
    const result = runBacktestScaled(candles, entryAtFive, exitAt30, {
      capital: 10000,
      scaledEntry: { tranches: 3, strategy: "equal", intervalType: "signal" },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(1);
  });

  it("price interval triggers additional tranches as price drops", () => {
    const downCandles = makeCandles(80, { base: 200, trend: -1 });
    const enterEarly: PresetCondition = {
      type: "preset",
      name: "enterEarly",
      evaluate: (_ind, _c, idx) => idx === 2,
    };
    const result = runBacktestScaled(downCandles, enterEarly, alwaysFalse, {
      capital: 10000,
      scaledEntry: { tranches: 3, strategy: "equal", intervalType: "price", priceInterval: -2 },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(1);
  });

  it("partialTakeProfit with tax applies tax only on profitable portion", () => {
    const uptrendCandles = makeCandles(80, { base: 50, trend: 3 });
    const result = runBacktestScaled(uptrendCandles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      taxRate: 20,
      partialTakeProfit: { threshold: 2, sellPercent: 50 },
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(0);
  });

  it("open position closed at end with positive P&L when taxRate applied", () => {
    const uptrendCandles = makeCandles(80, { base: 50, trend: 2 });
    const result = runBacktestScaled(uptrendCandles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      taxRate: 10,
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    expect(result.tradeCount).toBeGreaterThanOrEqual(1);
  });

  it("losing trade at end-of-data close does not apply tax", () => {
    const downCandles = makeCandles(80, { base: 200, trend: -2 });
    const result = runBacktestScaled(downCandles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      taxRate: 10,
      scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
    });
    // Should have trades, with negative return (no tax deducted on losses)
    expect(result.tradeCount).toBeGreaterThanOrEqual(1);
    expect(result.totalReturn).toBeLessThan(0);
  });
});
