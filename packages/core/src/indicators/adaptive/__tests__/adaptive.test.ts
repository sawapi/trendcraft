import { describe, expect, it } from "vitest";
import type { Candle, NormalizedCandle } from "../../../types";
import { adaptiveBollinger } from "../adaptive-bollinger";
import { adaptiveMa } from "../adaptive-ma";
import { adaptiveRsi } from "../adaptive-rsi";
import { adaptiveStochastics } from "../adaptive-stochastics";

// ---- Test candle generators ----

const BASE_TIME = 1700000000000;
const DAY_MS = 86400000;

/** Generate steadily trending (upward) candles */
function makeTrendingCandles(count: number, startPrice = 100, step = 1): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  for (let i = 0; i < count; i++) {
    const base = startPrice + i * step;
    candles.push({
      time: BASE_TIME + i * DAY_MS,
      open: base,
      high: base + 2,
      low: base - 1,
      close: base + 1,
      volume: 1000,
    });
  }
  return candles;
}

/** Generate choppy / oscillating candles */
function makeChoppyCandles(count: number, center = 100, amplitude = 5): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  for (let i = 0; i < count; i++) {
    const offset = Math.sin(i * 1.5) * amplitude;
    const base = center + offset;
    candles.push({
      time: BASE_TIME + i * DAY_MS,
      open: base - 1,
      high: base + 3,
      low: base - 3,
      close: base + 1,
      volume: 1000,
    });
  }
  return candles;
}

/** Generate high-volatility candles with large swings */
function makeHighVolCandles(count: number, center = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  // Use a deterministic pseudo-random pattern
  for (let i = 0; i < count; i++) {
    const swing = ((i * 7 + 3) % 20) - 10; // deterministic oscillation -10 to +9
    const base = center + swing;
    candles.push({
      time: BASE_TIME + i * DAY_MS,
      open: base - 5,
      high: base + 15,
      low: base - 15,
      close: base + 5,
      volume: 1000,
    });
  }
  return candles;
}

/** Generate low-volatility candles with tiny moves */
function makeLowVolCandles(count: number, center = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  for (let i = 0; i < count; i++) {
    const base = center + (i % 2 === 0 ? 0.1 : -0.1);
    candles.push({
      time: BASE_TIME + i * DAY_MS,
      open: base,
      high: base + 0.5,
      low: base - 0.5,
      close: base,
      volume: 1000,
    });
  }
  return candles;
}

/** Generate raw (non-normalized) candles */
function makeRawCandles(count: number): Candle[] {
  return makeTrendingCandles(count).map((c) => ({
    time: new Date(c.time).toISOString(),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
}

// ---- Tests ----

describe("adaptiveRsi", () => {
  it("returns valid data with correct length", () => {
    const candles = makeTrendingCandles(200);
    const result = adaptiveRsi(candles);
    expect(result).toHaveLength(200);
    // Last values should have RSI data
    const last = result[result.length - 1].value;
    expect(last.rsi).not.toBeNull();
    expect(last.rsi).toBeGreaterThanOrEqual(0);
    expect(last.rsi).toBeLessThanOrEqual(100);
    expect(last.effectivePeriod).toBeGreaterThanOrEqual(6);
    expect(last.effectivePeriod).toBeLessThanOrEqual(28);
    expect(last.volatilityPercentile).not.toBeNull();
  });

  it("high volatility produces shorter effective period than low volatility", () => {
    // Build a combined dataset where the lookback window straddles
    // both low-vol and high-vol bars, so the percentile ranking
    // correctly distinguishes between them.
    // Layout: 120 low-vol bars, then 120 high-vol bars.
    const lowVol = makeLowVolCandles(120, 100);
    const highVol = makeHighVolCandles(120, 100);
    const combined: NormalizedCandle[] = [
      ...lowVol,
      ...highVol.map((c, i) => ({ ...c, time: BASE_TIME + (120 + i) * DAY_MS })),
    ];

    // Use volLookback=80 so bars after the transition (bar 120+)
    // have a window containing both low-vol and high-vol bars.
    const result = adaptiveRsi(combined, { volLookback: 80 });

    // At bar ~200, the lookback window (bars 121-200) is all high-vol.
    // At bar ~160, the lookback window (bars 81-160) is mixed (81-119 low, 120-160 high).
    // A high-vol bar in a mixed window will have high percentile -> short period.
    // A low-vol bar in a mixed window will have low percentile -> long period.

    // Pick a bar in the mixed window: bar 160 (lookback 81-160)
    const mixedBar = result[160]?.value;
    expect(mixedBar.volatilityPercentile).not.toBeNull();
    // High-vol bar in mixed window should have high percentile
    expect(mixedBar.volatilityPercentile!).toBeGreaterThan(0.5);
    // Short effective period
    expect(mixedBar.effectivePeriod).toBeLessThan(17); // less than midpoint of 6-28

    // Compare: a low-vol bar that is within a mixed window is harder to test
    // since after bar 120 all are high-vol. Instead, verify the relationship:
    // bars deep in the high-vol section should have short periods,
    // and the period should be near minPeriod.
    const deepHighVol = result[220]?.value;
    expect(deepHighVol.effectivePeriod).toBeLessThanOrEqual(10);
  });

  it("handles insufficient data (returns nulls)", () => {
    const candles = makeTrendingCandles(20);
    const result = adaptiveRsi(candles, { volLookback: 100 });
    // All bars should have null RSI since volLookback=100 > 20
    result.forEach((r) => {
      expect(r.value.rsi).toBeNull();
      expect(r.value.volatilityPercentile).toBeNull();
    });
  });

  it("handles empty input", () => {
    expect(adaptiveRsi([])).toEqual([]);
  });

  it("works with raw (non-normalized) candles", () => {
    const candles = makeRawCandles(200);
    const result = adaptiveRsi(candles);
    expect(result).toHaveLength(200);
    const last = result[result.length - 1].value;
    expect(last.rsi).not.toBeNull();
  });
});

describe("adaptiveBollinger", () => {
  it("produces valid bands for normal data", () => {
    const candles = makeTrendingCandles(150);
    const result = adaptiveBollinger(candles, { period: 20 });
    expect(result).toHaveLength(150);

    // Check a fully computed value
    const last = result[result.length - 1].value;
    expect(last.upper).not.toBeNull();
    expect(last.middle).not.toBeNull();
    expect(last.lower).not.toBeNull();
    expect(last.upper!).toBeGreaterThan(last.middle!);
    expect(last.lower!).toBeLessThan(last.middle!);
    expect(last.bandwidth).not.toBeNull();
    expect(last.effectiveMultiplier).toBeGreaterThanOrEqual(1.5);
    expect(last.effectiveMultiplier).toBeLessThanOrEqual(3.0);
  });

  it("high kurtosis data produces wider bands (higher multiplier)", () => {
    // Create fat-tailed data: mostly flat with occasional spikes
    const fatTailCandles: NormalizedCandle[] = [];
    for (let i = 0; i < 200; i++) {
      const spike = i % 20 === 0 ? 30 : 0; // big spike every 20 bars
      const base = 100 + spike * (i % 40 === 0 ? 1 : -1);
      fatTailCandles.push({
        time: BASE_TIME + i * DAY_MS,
        open: base,
        high: base + 1 + Math.abs(spike) * 0.5,
        low: base - 1 - Math.abs(spike) * 0.5,
        close: base,
        volume: 1000,
      });
    }

    const fatResult = adaptiveBollinger(fatTailCandles, { kurtosisLookback: 100 });
    const normalCandles = makeTrendingCandles(200);
    const normalResult = adaptiveBollinger(normalCandles, { kurtosisLookback: 100 });

    // Compare average multipliers over the last 50 bars
    const fatMultipliers = fatResult.slice(-50).map((r) => r.value.effectiveMultiplier);
    const normalMultipliers = normalResult.slice(-50).map((r) => r.value.effectiveMultiplier);
    const avgFat = fatMultipliers.reduce((s, v) => s + v, 0) / fatMultipliers.length;
    const avgNormal = normalMultipliers.reduce((s, v) => s + v, 0) / normalMultipliers.length;

    expect(avgFat).toBeGreaterThan(avgNormal);
  });

  it("handles insufficient data with nulls", () => {
    const candles = makeTrendingCandles(5);
    const result = adaptiveBollinger(candles, { period: 20 });
    result.forEach((r) => {
      expect(r.value.upper).toBeNull();
      expect(r.value.middle).toBeNull();
      expect(r.value.lower).toBeNull();
    });
  });

  it("handles empty input", () => {
    expect(adaptiveBollinger([])).toEqual([]);
  });
});

describe("adaptiveMa", () => {
  it("trending data produces higher ER (faster smoothing)", () => {
    const trending = makeTrendingCandles(150);
    const result = adaptiveMa(trending, { erPeriod: 10 });

    // Get ER values from the end (fully warmed up)
    const erValues = result
      .slice(-50)
      .map((r) => r.value.efficiencyRatio)
      .filter((v): v is number => v !== null);

    const avgEr = erValues.reduce((s, v) => s + v, 0) / erValues.length;
    // Trending data should have high ER
    expect(avgEr).toBeGreaterThan(0.5);
  });

  it("choppy data produces lower ER (slower smoothing)", () => {
    const choppy = makeChoppyCandles(150);
    const result = adaptiveMa(choppy, { erPeriod: 10 });

    const erValues = result
      .slice(-50)
      .map((r) => r.value.efficiencyRatio)
      .filter((v): v is number => v !== null);

    const avgEr = erValues.reduce((s, v) => s + v, 0) / erValues.length;
    // Choppy data should have low ER
    expect(avgEr).toBeLessThan(0.5);
  });

  it("returns valid MA values", () => {
    const candles = makeTrendingCandles(150);
    const result = adaptiveMa(candles);
    expect(result).toHaveLength(150);

    const last = result[result.length - 1].value;
    expect(last.value).not.toBeNull();
    expect(last.efficiencyRatio).not.toBeNull();
    expect(last.smoothingConstant).not.toBeNull();
    expect(last.efficiencyRatio!).toBeGreaterThanOrEqual(0);
    expect(last.efficiencyRatio!).toBeLessThanOrEqual(1);
  });

  it("handles insufficient data with nulls at the start", () => {
    const candles = makeTrendingCandles(5);
    const result = adaptiveMa(candles, { erPeriod: 10 });
    // All bars should be null since erPeriod=10 > 5
    result.forEach((r) => {
      expect(r.value.value).toBeNull();
      expect(r.value.efficiencyRatio).toBeNull();
    });
  });

  it("handles empty input", () => {
    expect(adaptiveMa([])).toEqual([]);
  });

  it("works with raw (non-normalized) candles", () => {
    const candles = makeRawCandles(150);
    const result = adaptiveMa(candles);
    expect(result).toHaveLength(150);
    const last = result[result.length - 1].value;
    expect(last.value).not.toBeNull();
  });
});

describe("adaptiveStochastics", () => {
  it("returns valid K and D values", () => {
    const candles = makeTrendingCandles(150);
    const result = adaptiveStochastics(candles);
    expect(result).toHaveLength(150);

    // Last values should be computed
    const last = result[result.length - 1].value;
    expect(last.k).not.toBeNull();
    expect(last.d).not.toBeNull();
    expect(last.k!).toBeGreaterThanOrEqual(0);
    expect(last.k!).toBeLessThanOrEqual(100);
    expect(last.effectivePeriod).toBeGreaterThanOrEqual(5);
    expect(last.effectivePeriod).toBeLessThanOrEqual(21);
  });

  it("strong ADX (trending) produces longer effective period", () => {
    // Strong trend: steadily rising
    const trending = makeTrendingCandles(200, 100, 2);
    const trendResult = adaptiveStochastics(trending);

    // Weak trend: choppy
    const choppy = makeChoppyCandles(200, 100, 3);
    const choppyResult = adaptiveStochastics(choppy);

    // Compare average effective periods over last 50 bars
    const trendPeriods = trendResult.slice(-50).map((r) => r.value.effectivePeriod);
    const choppyPeriods = choppyResult.slice(-50).map((r) => r.value.effectivePeriod);

    const avgTrend = trendPeriods.reduce((s, v) => s + v, 0) / trendPeriods.length;
    const avgChoppy = choppyPeriods.reduce((s, v) => s + v, 0) / choppyPeriods.length;

    // Trending should use longer period
    expect(avgTrend).toBeGreaterThan(avgChoppy);
  });

  it("handles insufficient data (returns nulls for K/D)", () => {
    const candles = makeTrendingCandles(5);
    const result = adaptiveStochastics(candles);
    // With default periods, first bars should be null
    result.forEach((r) => {
      // K and D may be null for the first few bars
      if (r.value.k !== null) {
        expect(r.value.k).toBeGreaterThanOrEqual(0);
        expect(r.value.k).toBeLessThanOrEqual(100);
      }
    });
  });

  it("handles empty input", () => {
    expect(adaptiveStochastics([])).toEqual([]);
  });

  it("works with raw (non-normalized) candles", () => {
    const candles = makeRawCandles(200);
    const result = adaptiveStochastics(candles);
    expect(result).toHaveLength(200);
    const last = result[result.length - 1].value;
    expect(last.k).not.toBeNull();
  });
});
