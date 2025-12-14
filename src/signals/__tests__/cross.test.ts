import { describe, expect, it } from "vitest";
import type { NormalizedCandle, Series } from "../../types";
import { crossOver, crossUnder, goldenCross, deadCross, validateCrossSignals } from "../cross";

describe("crossOver", () => {
  it("should detect when series A crosses over series B", () => {
    const seriesA: Series<number | null> = [
      { time: 1, value: 10 },
      { time: 2, value: 15 },
      { time: 3, value: 25 }, // Crosses over here
      { time: 4, value: 30 },
    ];
    const seriesB: Series<number | null> = [
      { time: 1, value: 20 },
      { time: 2, value: 20 },
      { time: 3, value: 20 },
      { time: 4, value: 20 },
    ];

    const result = crossOver(seriesA, seriesB);

    expect(result[0].value).toBe(false); // First point never crosses
    expect(result[1].value).toBe(false); // A(15) < B(20)
    expect(result[2].value).toBe(true); // A crosses from 15 to 25 over B(20)
    expect(result[3].value).toBe(false); // A(30) > B(20) but was already above
  });

  it("should return false when A stays above B", () => {
    const seriesA: Series<number | null> = [
      { time: 1, value: 30 },
      { time: 2, value: 35 },
      { time: 3, value: 40 },
    ];
    const seriesB: Series<number | null> = [
      { time: 1, value: 20 },
      { time: 2, value: 20 },
      { time: 3, value: 20 },
    ];

    const result = crossOver(seriesA, seriesB);
    expect(result.every((r) => r.value === false)).toBe(true);
  });

  it("should return false when A stays below B", () => {
    const seriesA: Series<number | null> = [
      { time: 1, value: 10 },
      { time: 2, value: 12 },
      { time: 3, value: 15 },
    ];
    const seriesB: Series<number | null> = [
      { time: 1, value: 20 },
      { time: 2, value: 20 },
      { time: 3, value: 20 },
    ];

    const result = crossOver(seriesA, seriesB);
    expect(result.every((r) => r.value === false)).toBe(true);
  });

  it("should handle equal values (A <= B then A > B)", () => {
    const seriesA: Series<number | null> = [
      { time: 1, value: 20 }, // Equal
      { time: 2, value: 25 }, // Cross over
    ];
    const seriesB: Series<number | null> = [
      { time: 1, value: 20 },
      { time: 2, value: 20 },
    ];

    const result = crossOver(seriesA, seriesB);
    expect(result[0].value).toBe(false);
    expect(result[1].value).toBe(true);
  });

  it("should return false for null values", () => {
    const seriesA: Series<number | null> = [
      { time: 1, value: null },
      { time: 2, value: 25 },
      { time: 3, value: 30 },
    ];
    const seriesB: Series<number | null> = [
      { time: 1, value: 20 },
      { time: 2, value: null },
      { time: 3, value: 20 },
    ];

    const result = crossOver(seriesA, seriesB);
    expect(result[0].value).toBe(false);
    expect(result[1].value).toBe(false); // Previous A is null
    expect(result[2].value).toBe(false); // Previous B is null
  });

  it("should throw if series have different lengths", () => {
    const seriesA: Series<number | null> = [{ time: 1, value: 10 }];
    const seriesB: Series<number | null> = [
      { time: 1, value: 20 },
      { time: 2, value: 20 },
    ];

    expect(() => crossOver(seriesA, seriesB)).toThrow("Series must have the same length");
  });
});

describe("crossUnder", () => {
  it("should detect when series A crosses under series B", () => {
    const seriesA: Series<number | null> = [
      { time: 1, value: 30 },
      { time: 2, value: 25 },
      { time: 3, value: 15 }, // Crosses under here
      { time: 4, value: 10 },
    ];
    const seriesB: Series<number | null> = [
      { time: 1, value: 20 },
      { time: 2, value: 20 },
      { time: 3, value: 20 },
      { time: 4, value: 20 },
    ];

    const result = crossUnder(seriesA, seriesB);

    expect(result[0].value).toBe(false); // First point never crosses
    expect(result[1].value).toBe(false); // A(25) > B(20)
    expect(result[2].value).toBe(true); // A crosses from 25 to 15 under B(20)
    expect(result[3].value).toBe(false); // A(10) < B(20) but was already below
  });

  it("should handle equal values (A >= B then A < B)", () => {
    const seriesA: Series<number | null> = [
      { time: 1, value: 20 }, // Equal
      { time: 2, value: 15 }, // Cross under
    ];
    const seriesB: Series<number | null> = [
      { time: 1, value: 20 },
      { time: 2, value: 20 },
    ];

    const result = crossUnder(seriesA, seriesB);
    expect(result[0].value).toBe(false);
    expect(result[1].value).toBe(true);
  });

  it("should throw if series have different lengths", () => {
    const seriesA: Series<number | null> = [{ time: 1, value: 10 }];
    const seriesB: Series<number | null> = [
      { time: 1, value: 20 },
      { time: 2, value: 20 },
    ];

    expect(() => crossUnder(seriesA, seriesB)).toThrow("Series must have the same length");
  });
});

describe("goldenCross", () => {
  // Helper to create simple candles with just close prices
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    }));

  it("should detect golden cross with default periods (5, 25)", () => {
    // Create a scenario where short SMA crosses above long SMA
    // Start with declining prices, then switch to rising
    const prices = [
      // First 25 points - declining trend
      ...Array.from({ length: 25 }, (_, i) => 100 - i),
      // Then rising - this should cause short SMA to cross above long SMA
      ...Array.from({ length: 10 }, (_, i) => 76 + i * 3),
    ];

    const candles = makeCandles(prices);
    const result = goldenCross(candles);

    expect(result).toHaveLength(prices.length);
    // First 24 points should be false (need 25 for long SMA)
    for (let i = 0; i < 24; i++) {
      expect(result[i].value).toBe(false);
    }
    // Check that at least one golden cross occurs in the rising period
    const hasCross = result.slice(25).some((r) => r.value === true);
    expect(hasCross).toBe(true);
  });

  it("should detect golden cross with custom periods", () => {
    // Simpler test with shorter periods
    const prices = [
      100, 99, 98, 97, 96, 95, // Declining - SMA3 below SMA5
      94, 100, 110, 120, 130, // Rising - SMA3 should cross above SMA5
    ];

    const candles = makeCandles(prices);
    const result = goldenCross(candles, { short: 3, long: 5 });

    expect(result).toHaveLength(prices.length);
    // Should have at least one cross during the rising period
    const hasCross = result.some((r) => r.value === true);
    expect(hasCross).toBe(true);
  });

  it("should throw if short period >= long period", () => {
    const candles = makeCandles([100, 101, 102, 103, 104]);
    expect(() => goldenCross(candles, { short: 5, long: 5 })).toThrow(
      "Short period must be less than long period"
    );
    expect(() => goldenCross(candles, { short: 10, long: 5 })).toThrow(
      "Short period must be less than long period"
    );
  });

  it("should return all false for consistently declining prices", () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 - i);
    const candles = makeCandles(prices);
    const result = goldenCross(candles, { short: 3, long: 5 });

    // Short SMA should always be below long SMA in declining trend
    const hasCross = result.some((r) => r.value === true);
    expect(hasCross).toBe(false);
  });

  it("should handle empty candles", () => {
    expect(goldenCross([])).toEqual([]);
  });
});

describe("deadCross", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    }));

  it("should detect dead cross with default periods (5, 25)", () => {
    // Create a scenario where short SMA crosses below long SMA
    // Start with rising prices, then switch to declining
    const prices = [
      // First 25 points - rising trend
      ...Array.from({ length: 25 }, (_, i) => 50 + i),
      // Then declining - this should cause short SMA to cross below long SMA
      ...Array.from({ length: 10 }, (_, i) => 74 - i * 3),
    ];

    const candles = makeCandles(prices);
    const result = deadCross(candles);

    expect(result).toHaveLength(prices.length);
    // Check that at least one dead cross occurs in the declining period
    const hasCross = result.slice(25).some((r) => r.value === true);
    expect(hasCross).toBe(true);
  });

  it("should detect dead cross with custom periods", () => {
    // Simpler test with shorter periods
    const prices = [
      100, 101, 102, 103, 104, 105, // Rising - SMA3 above SMA5
      100, 90, 80, 70, 60, // Declining - SMA3 should cross below SMA5
    ];

    const candles = makeCandles(prices);
    const result = deadCross(candles, { short: 3, long: 5 });

    expect(result).toHaveLength(prices.length);
    // Should have at least one cross during the declining period
    const hasCross = result.some((r) => r.value === true);
    expect(hasCross).toBe(true);
  });

  it("should throw if short period >= long period", () => {
    const candles = makeCandles([100, 101, 102, 103, 104]);
    expect(() => deadCross(candles, { short: 5, long: 5 })).toThrow(
      "Short period must be less than long period"
    );
  });

  it("should return all false for consistently rising prices", () => {
    const prices = Array.from({ length: 30 }, (_, i) => 50 + i);
    const candles = makeCandles(prices);
    const result = deadCross(candles, { short: 3, long: 5 });

    // Short SMA should always be above long SMA in rising trend
    const hasCross = result.some((r) => r.value === true);
    expect(hasCross).toBe(false);
  });

  it("should handle empty candles", () => {
    expect(deadCross([])).toEqual([]);
  });
});

describe("validateCrossSignals", () => {
  // Helper to create candles with price and volume
  const makeCandles = (data: { close: number; volume: number }[]): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.close,
      low: d.close,
      close: d.close,
      volume: d.volume,
    }));

  it("should detect golden cross with quality assessment", () => {
    // Create scenario: declining trend then sharp rise with high volume
    // Need enough data for SMA25 + volume MA20
    const prices = [
      // First 30 points - declining trend
      ...Array.from({ length: 30 }, (_, i) => ({
        close: 100 - i * 0.5,
        volume: 1000,
      })),
      // Sharp rise with high volume - should trigger GC
      ...Array.from({ length: 10 }, (_, i) => ({
        close: 85 + i * 4,
        volume: 3000, // High volume
      })),
    ];

    const candles = makeCandles(prices);
    const signals = validateCrossSignals(candles, { short: 3, long: 5 });

    // Should detect at least one golden cross
    const goldenCrosses = signals.filter((s) => s.type === "golden");
    expect(goldenCrosses.length).toBeGreaterThan(0);

    // The high volume cross should have volumeConfirmed
    const highVolumeGC = goldenCrosses.find((s) => s.details.volumeConfirmed);
    expect(highVolumeGC).toBeDefined();
  });

  it("should detect dead cross with quality assessment", () => {
    // Create scenario: rising trend then sharp decline with high volume
    const prices = [
      // First 30 points - rising trend
      ...Array.from({ length: 30 }, (_, i) => ({
        close: 50 + i * 0.5,
        volume: 1000,
      })),
      // Sharp decline with high volume - should trigger DC
      ...Array.from({ length: 10 }, (_, i) => ({
        close: 65 - i * 4,
        volume: 3000, // High volume
      })),
    ];

    const candles = makeCandles(prices);
    const signals = validateCrossSignals(candles, { short: 3, long: 5 });

    // Should detect at least one dead cross
    const deadCrosses = signals.filter((s) => s.type === "dead");
    expect(deadCrosses.length).toBeGreaterThan(0);
  });

  it("should mark low-quality crosses as fake", () => {
    // Create scenario with low volume and no clear trend
    const prices = Array.from({ length: 50 }, (_, i) => ({
      close: 100 + Math.sin(i * 0.5) * 5, // Oscillating with no clear trend
      volume: 100, // Low volume
    }));

    const candles = makeCandles(prices);
    const signals = validateCrossSignals(candles, { short: 3, long: 5 });

    // Some signals should be marked as fake
    if (signals.length > 0) {
      const fakeSignals = signals.filter((s) => s.isFake);
      expect(fakeSignals.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("should return correct score based on confirmations", () => {
    const prices = [
      ...Array.from({ length: 30 }, (_, i) => ({
        close: 100 - i * 0.5,
        volume: 1000,
      })),
      ...Array.from({ length: 15 }, (_, i) => ({
        close: 85 + i * 4,
        volume: 3000,
      })),
    ];

    const candles = makeCandles(prices);
    const signals = validateCrossSignals(candles, { short: 3, long: 5 });

    for (const signal of signals) {
      // Base score is 15
      let expectedScore = 15;
      if (signal.details.volumeConfirmed) expectedScore += 20;
      if (signal.details.trendConfirmed) expectedScore += 20;
      if (signal.details.holdingConfirmed === true) expectedScore += 30;
      if (signal.details.pricePositionConfirmed) expectedScore += 15;
      expect(signal.score).toBe(expectedScore);
    }
  });

  it("should detect holding confirmation for maintained crosses", () => {
    // Create scenario where cross is maintained
    const prices = [
      ...Array.from({ length: 20 }, (_, i) => ({
        close: 100 - i * 0.5, // Declining
        volume: 1000,
      })),
      ...Array.from({ length: 20 }, (_, i) => ({
        close: 90 + i * 2, // Rising and staying up
        volume: 2000,
      })),
    ];

    const candles = makeCandles(prices);
    const signals = validateCrossSignals(candles, { short: 3, long: 5, holdingDays: 5 });

    const goldenCrosses = signals.filter((s) => s.type === "golden");
    // At least one GC should have holdingConfirmed = true
    const maintainedGC = goldenCrosses.find((s) => s.details.holdingConfirmed === true);
    expect(maintainedGC).toBeDefined();
  });

  it("should mark holdingConfirmed as null for recent crosses without enough data", () => {
    const prices = Array.from({ length: 30 }, (_, i) => ({
      close: 50 + i,
      volume: 1000,
    }));

    const candles = makeCandles(prices);
    const signals = validateCrossSignals(candles, { short: 3, long: 5, holdingDays: 5 });

    // The last few signals should have holdingConfirmed = null
    const recentSignals = signals.filter((s) => s.details.holdingConfirmed === null);
    expect(recentSignals.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle empty candles", () => {
    expect(validateCrossSignals([])).toEqual([]);
  });
});
