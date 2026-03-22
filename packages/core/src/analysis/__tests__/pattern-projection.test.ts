import { describe, expect, it } from "vitest";
import type { PatternSignal } from "../../signals/patterns/types";
import type { NormalizedCandle } from "../../types";
import {
  projectFromPatterns,
  projectFromSeries,
  projectPatternOutcome,
} from "../pattern-projection";

function makeCandles(prices: number[], baseTime = Date.UTC(2024, 0, 1)): NormalizedCandle[] {
  const day = 86400000;
  return prices.map((close, i) => ({
    time: baseTime + i * day,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  }));
}

describe("projectPatternOutcome", () => {
  it("should return empty result for no events", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = projectPatternOutcome(candles, [], (e) => ({ time: e }));

    expect(result.patternCount).toBe(0);
    expect(result.validCount).toBe(0);
    expect(result.avgReturnByBar).toEqual([]);
    expect(result.medianReturnByBar).toEqual([]);
    expect(result.upperBound).toEqual([]);
    expect(result.lowerBound).toEqual([]);
    expect(result.hitRates).toHaveLength(4); // default thresholds
    expect(result.hitRates.every((h) => h.rate === 0)).toBe(true);
  });

  it("should calculate correct returns for known price path", () => {
    // Prices: 100, 105, 110, 115, 120
    const candles = makeCandles([100, 105, 110, 115, 120]);
    const events = [{ time: candles[0].time }];

    const result = projectPatternOutcome(candles, events, (e) => ({ time: e.time }), {
      horizon: 4,
    });

    expect(result.patternCount).toBe(1);
    expect(result.validCount).toBe(1);
    // Returns: (105-100)/100*100=5, (110-100)/100*100=10, etc.
    expect(result.avgReturnByBar[0]).toBe(5);
    expect(result.avgReturnByBar[1]).toBe(10);
    expect(result.avgReturnByBar[2]).toBe(15);
    expect(result.avgReturnByBar[3]).toBe(20);
  });

  it("should calculate avg/median for multiple events", () => {
    // Two events at different base prices
    const candles = makeCandles([100, 110, 200, 220, 300]);
    const events = [
      { time: candles[0].time }, // base=100, next=110 → +10%
      { time: candles[2].time }, // base=200, next=220 → +10%
    ];

    const result = projectPatternOutcome(candles, events, (e) => ({ time: e.time }), {
      horizon: 2,
    });

    expect(result.validCount).toBe(2);
    // Both events have +10% at bar 0
    expect(result.avgReturnByBar[0]).toBe(10);
    expect(result.medianReturnByBar[0]).toBe(10);
  });

  it("should invert returns for bearish direction", () => {
    // Price drops: 100, 90, 80
    const candles = makeCandles([100, 90, 80]);
    const events = [{ time: candles[0].time }];

    const result = projectPatternOutcome(
      candles,
      events,
      (e) => ({ time: e.time, direction: "bearish" as const }),
      { horizon: 2 },
    );

    // Bearish: return inverted → -(90-100)/100*100 = +10
    expect(result.avgReturnByBar[0]).toBe(10);
    expect(result.avgReturnByBar[1]).toBe(20);
  });

  it("should exclude events at data end from validCount", () => {
    const candles = makeCandles([100, 110, 120]);
    const events = [
      { time: candles[0].time }, // valid: has forward data
      { time: candles[2].time }, // invalid: last bar, no forward data
    ];

    const result = projectPatternOutcome(candles, events, (e) => ({ time: e.time }), {
      horizon: 2,
    });

    expect(result.patternCount).toBe(2);
    expect(result.validCount).toBe(1);
  });

  it("should calculate confidence bounds", () => {
    // Create many events with varying returns
    const prices = [100];
    for (let i = 1; i <= 50; i++) {
      prices.push(100 + i * (i % 2 === 0 ? 1 : -0.5));
    }
    const candles = makeCandles(prices);

    const events = [];
    for (let i = 0; i < 40; i += 5) {
      events.push({ time: candles[i].time });
    }

    const result = projectPatternOutcome(candles, events, (e) => ({ time: e.time }), {
      horizon: 5,
      confidenceLevel: 0.9,
    });

    // Upper bound should be >= avg, lower bound should be <= avg
    for (let i = 0; i < result.avgReturnByBar.length; i++) {
      if (result.upperBound[i] !== 0 || result.lowerBound[i] !== 0) {
        expect(result.upperBound[i]).toBeGreaterThanOrEqual(result.avgReturnByBar[i]);
        expect(result.lowerBound[i]).toBeLessThanOrEqual(result.avgReturnByBar[i]);
      }
    }
  });

  it("should calculate hit rates for thresholds", () => {
    // Prices rise 5% per bar
    const candles = makeCandles([100, 105, 110.25, 115.76, 121.55]);
    const events = [{ time: candles[0].time }];

    const result = projectPatternOutcome(candles, events, (e) => ({ time: e.time }), {
      horizon: 4,
      thresholds: [3, 5, 10, 20],
    });

    // Max return within horizon: ~21.55%
    expect(result.hitRates.find((h) => h.threshold === 3)?.rate).toBe(100);
    expect(result.hitRates.find((h) => h.threshold === 5)?.rate).toBe(100);
    expect(result.hitRates.find((h) => h.threshold === 10)?.rate).toBe(100);
    expect(result.hitRates.find((h) => h.threshold === 20)?.rate).toBe(100);
  });

  it("should skip events with non-matching timestamps", () => {
    const candles = makeCandles([100, 110, 120]);
    const events = [{ time: 999999999 }]; // non-existent timestamp

    const result = projectPatternOutcome(candles, events, (e) => ({ time: e.time }));

    expect(result.patternCount).toBe(1);
    expect(result.validCount).toBe(0);
  });
});

describe("projectFromSeries", () => {
  it("should extract events from boolean series", () => {
    const candles = makeCandles([100, 105, 110, 108, 112]);
    const series = [
      { time: candles[0].time, value: true },
      { time: candles[1].time, value: false },
      { time: candles[2].time, value: true },
    ];

    const result = projectFromSeries(candles, series, { horizon: 2 });

    expect(result.validCount).toBe(2); // two truthy events
  });

  it("should extract events from numeric series", () => {
    const candles = makeCandles([100, 105, 110, 108, 112]);
    const series = [
      { time: candles[0].time, value: 1 },
      { time: candles[1].time, value: 0 },
      { time: candles[2].time, value: -1 },
    ];

    const result = projectFromSeries(candles, series, { horizon: 2 });

    expect(result.validCount).toBe(2); // two non-zero events
  });
});

describe("projectFromPatterns", () => {
  it("should auto-detect direction from pattern type", () => {
    // Price drops: pattern says double_top (bearish)
    const candles = makeCandles([100, 95, 90, 85, 80]);

    const signal: PatternSignal = {
      time: candles[0].time,
      type: "double_top",
      pattern: {
        startTime: candles[0].time,
        endTime: candles[0].time,
        keyPoints: [],
      },
      confidence: 80,
      confirmed: true,
    };

    const result = projectFromPatterns(candles, [signal], { horizon: 3 });

    // Bearish: returns are inverted, so price drop = positive return
    expect(result.avgReturnByBar[0]).toBe(5);
    expect(result.avgReturnByBar[1]).toBe(10);
  });

  it("should treat double_bottom as bullish", () => {
    const candles = makeCandles([100, 105, 110]);

    const signal: PatternSignal = {
      time: candles[0].time,
      type: "double_bottom",
      pattern: {
        startTime: candles[0].time,
        endTime: candles[0].time,
        keyPoints: [],
      },
      confidence: 80,
      confirmed: true,
    };

    const result = projectFromPatterns(candles, [signal], { horizon: 2 });

    expect(result.avgReturnByBar[0]).toBe(5);
    expect(result.avgReturnByBar[1]).toBe(10);
  });

  it("should handle empty signals", () => {
    const candles = makeCandles([100, 105]);
    const result = projectFromPatterns(candles, [], { horizon: 1 });
    expect(result.patternCount).toBe(0);
  });
});
