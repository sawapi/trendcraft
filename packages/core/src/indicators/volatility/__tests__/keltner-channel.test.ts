import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { keltnerChannel } from "../keltner-channel";

describe("keltnerChannel", () => {
  // Sample data for testing (need enough for default EMA period of 20)
  const generateCandles = (count: number, basePrice = 100): NormalizedCandle[] => {
    const candles: NormalizedCandle[] = [];
    let price = basePrice;
    for (let i = 0; i < count; i++) {
      const volatility = Math.sin(i * 0.5) * 5;
      const high = price + 2 + Math.abs(volatility);
      const low = price - 2 - Math.abs(volatility);
      const close = price + volatility * 0.5;
      candles.push({
        time: i + 1,
        open: price,
        high,
        low,
        close,
        volume: 1000 + i * 100,
      });
      price = close;
    }
    return candles;
  };

  const sampleCandles = generateCandles(30);

  it("should return empty array for empty input", () => {
    const result = keltnerChannel([]);
    expect(result).toEqual([]);
  });

  it("should return null values when not enough data", () => {
    const result = keltnerChannel(sampleCandles);

    // First values should be null (need period for EMA and ATR)
    expect(result[0].value.upper).toBeNull();
    expect(result[0].value.middle).toBeNull();
    expect(result[0].value.lower).toBeNull();
  });

  it("should calculate Keltner Channel values", () => {
    const result = keltnerChannel(sampleCandles, { emaPeriod: 10, atrPeriod: 10 });

    // After enough data, values should be calculated
    const lastValue = result[result.length - 1].value;
    expect(lastValue.upper).not.toBeNull();
    expect(lastValue.middle).not.toBeNull();
    expect(lastValue.lower).not.toBeNull();
  });

  it("should have upper > middle > lower", () => {
    const result = keltnerChannel(sampleCandles, { emaPeriod: 10, atrPeriod: 10 });

    // Check relationship for all computed values
    for (const r of result) {
      if (r.value.upper !== null && r.value.middle !== null && r.value.lower !== null) {
        expect(r.value.upper).toBeGreaterThan(r.value.middle);
        expect(r.value.middle).toBeGreaterThan(r.value.lower);
      }
    }
  });

  it("should respect custom parameters", () => {
    const defaultResult = keltnerChannel(sampleCandles);
    const customResult = keltnerChannel(sampleCandles, {
      emaPeriod: 10,
      atrPeriod: 5,
      multiplier: 1.5,
    });

    // Different parameters should produce different results
    const defaultLast = defaultResult[defaultResult.length - 1].value;
    const customLast = customResult[customResult.length - 1].value;

    // With smaller multiplier, bands should be narrower
    if (
      defaultLast.upper !== null &&
      defaultLast.lower !== null &&
      customLast.upper !== null &&
      customLast.lower !== null
    ) {
      const defaultWidth = defaultLast.upper - defaultLast.lower;
      const customWidth = customLast.upper - customLast.lower;
      // Custom has multiplier 1.5 vs default 2, so should be narrower
      // But also different periods, so just check they're different
      expect(defaultWidth).not.toBe(customWidth);
    }
  });

  it("should throw error for invalid EMA period", () => {
    expect(() => keltnerChannel(sampleCandles, { emaPeriod: 0 })).toThrow(
      "Keltner Channel EMA period must be at least 1",
    );
    expect(() => keltnerChannel(sampleCandles, { emaPeriod: -5 })).toThrow(
      "Keltner Channel EMA period must be at least 1",
    );
  });

  it("should throw error for invalid ATR period", () => {
    expect(() => keltnerChannel(sampleCandles, { atrPeriod: 0 })).toThrow(
      "Keltner Channel ATR period must be at least 1",
    );
    expect(() => keltnerChannel(sampleCandles, { atrPeriod: -5 })).toThrow(
      "Keltner Channel ATR period must be at least 1",
    );
  });

  it("should throw error for invalid multiplier", () => {
    expect(() => keltnerChannel(sampleCandles, { multiplier: 0 })).toThrow(
      "Keltner Channel multiplier must be positive",
    );
    expect(() => keltnerChannel(sampleCandles, { multiplier: -1 })).toThrow(
      "Keltner Channel multiplier must be positive",
    );
  });

  it("should have correct length", () => {
    const result = keltnerChannel(sampleCandles);
    expect(result.length).toBe(sampleCandles.length);
  });

  it("should preserve timestamps", () => {
    const result = keltnerChannel(sampleCandles);
    for (let i = 0; i < result.length; i++) {
      expect(result[i].time).toBe(sampleCandles[i].time);
    }
  });

  it("band width should scale with multiplier", () => {
    const result1 = keltnerChannel(sampleCandles, { emaPeriod: 10, atrPeriod: 10, multiplier: 1 });
    const result2 = keltnerChannel(sampleCandles, { emaPeriod: 10, atrPeriod: 10, multiplier: 2 });

    const lastIdx = result1.length - 1;
    const v1 = result1[lastIdx].value;
    const v2 = result2[lastIdx].value;

    if (
      v1.upper !== null &&
      v1.lower !== null &&
      v1.middle !== null &&
      v2.upper !== null &&
      v2.lower !== null &&
      v2.middle !== null
    ) {
      const width1 = v1.upper - v1.lower;
      const width2 = v2.upper - v2.lower;

      // Width with multiplier 2 should be approximately 2x width with multiplier 1
      expect(width2 / width1).toBeCloseTo(2, 1);
    }
  });
});
