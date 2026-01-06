import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { volumeBreakout } from "../volume-breakout";

// Helper to create test candle
function createCandle(
  day: number,
  close: number,
  volume: number,
): NormalizedCandle {
  return {
    time: new Date(2024, 0, day).getTime(),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume,
  };
}

describe("volumeBreakout", () => {
  it("should return empty array for insufficient data", () => {
    const candles = [
      createCandle(1, 100, 1000),
      createCandle(2, 101, 1100),
    ];
    expect(volumeBreakout(candles)).toEqual([]);
  });

  it("should return empty array when period equals candle count", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 1; i <= 20; i++) {
      candles.push(createCandle(i, 100, 1000));
    }
    expect(volumeBreakout(candles, { period: 20 })).toEqual([]);
  });

  it("should detect volume breakout", () => {
    const candles: NormalizedCandle[] = [];
    // 20 days of normal volume
    for (let i = 1; i <= 20; i++) {
      candles.push(createCandle(i, 100, 1000));
    }
    // Day 21: volume spike
    candles.push(createCandle(21, 100, 5000));

    const signals = volumeBreakout(candles, { period: 20 });

    expect(signals.length).toBe(1);
    expect(signals[0].type).toBe("breakout");
    expect(signals[0].volume).toBe(5000);
    expect(signals[0].previousHigh).toBe(1000);
    expect(signals[0].ratio).toBe(5);
  });

  it("should not detect when volume does not exceed previous high", () => {
    const candles: NormalizedCandle[] = [];
    // 20 days with varying volume, max 5000
    for (let i = 1; i <= 20; i++) {
      candles.push(createCandle(i, 100, i === 10 ? 5000 : 1000));
    }
    // Day 21: volume is high but not higher than previous max
    candles.push(createCandle(21, 100, 4000));

    const signals = volumeBreakout(candles, { period: 20 });
    expect(signals.length).toBe(0);
  });

  it("should detect multiple breakouts", () => {
    const candles: NormalizedCandle[] = [];
    // Build up with increasing volume spikes
    for (let i = 1; i <= 60; i++) {
      let volume = 1000;
      if (i === 25) volume = 3000; // First breakout
      if (i === 50) volume = 5000; // Second breakout (exceeds previous high of 3000)
      candles.push(createCandle(i, 100, volume));
    }

    const signals = volumeBreakout(candles, { period: 20 });

    expect(signals.length).toBe(2);
    expect(signals[0].volume).toBe(3000);
    expect(signals[1].volume).toBe(5000);
  });

  it("should return signals with correct structure", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 1; i <= 25; i++) {
      candles.push(createCandle(i, 100, i === 25 ? 5000 : 1000));
    }

    const signals = volumeBreakout(candles, { period: 20 });

    expect(signals.length).toBe(1);
    const signal = signals[0];
    expect(signal).toHaveProperty("time");
    expect(signal).toHaveProperty("type");
    expect(signal.type).toBe("breakout");
    expect(signal).toHaveProperty("volume");
    expect(signal).toHaveProperty("previousHigh");
    expect(signal).toHaveProperty("ratio");
    expect(typeof signal.time).toBe("number");
    expect(typeof signal.volume).toBe("number");
    expect(typeof signal.previousHigh).toBe("number");
    expect(typeof signal.ratio).toBe("number");
  });

  it("should respect period option", () => {
    const candles: NormalizedCandle[] = [];
    // Day 1-5: normal volume
    for (let i = 1; i <= 5; i++) {
      candles.push(createCandle(i, 100, 1000));
    }
    // Day 6: high volume
    candles.push(createCandle(6, 100, 3000));
    // Day 7-11: normal volume
    for (let i = 7; i <= 11; i++) {
      candles.push(createCandle(i, 100, 1000));
    }
    // Day 12: spike that exceeds last 5 days but not last 10 days
    candles.push(createCandle(12, 100, 2000));

    const signalsPeriod5 = volumeBreakout(candles, { period: 5 });
    const signalsPeriod10 = volumeBreakout(candles, { period: 10 });

    // With period 5, day 12's volume (2000) > max of days 7-11 (1000)
    expect(signalsPeriod5.some((s) => s.time === candles[11].time)).toBe(true);
    // With period 10, day 12's volume (2000) < max of days 2-11 which includes day 6 (3000)
    expect(signalsPeriod10.some((s) => s.time === candles[11].time)).toBe(false);
  });

  it("should respect minRatio option", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 1; i <= 20; i++) {
      candles.push(createCandle(i, 100, 1000));
    }
    // Day 21: 1.5x volume
    candles.push(createCandle(21, 100, 1500));

    const signalsNoMin = volumeBreakout(candles, { period: 20 });
    const signalsHighMin = volumeBreakout(candles, { period: 20, minRatio: 2.0 });

    // Without minRatio filter, the 1.5x spike should be detected
    expect(signalsNoMin.length).toBe(1);
    expect(signalsNoMin[0].ratio).toBe(1.5);

    // With minRatio 2.0, the 1.5x spike should not be detected
    expect(signalsHighMin.length).toBe(0);
  });

  it("should throw error for invalid period", () => {
    const candles = [createCandle(1, 100, 1000)];
    expect(() => volumeBreakout(candles, { period: 0 })).toThrow(
      "Volume breakout period must be at least 1",
    );
    expect(() => volumeBreakout(candles, { period: -1 })).toThrow(
      "Volume breakout period must be at least 1",
    );
  });

  it("should handle raw candles with string time", () => {
    const rawCandles = [
      { time: "2024-01-01", open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { time: "2024-01-02", open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { time: "2024-01-03", open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { time: "2024-01-04", open: 100, high: 101, low: 99, close: 100, volume: 5000 },
    ];

    const signals = volumeBreakout(rawCandles, { period: 3 });
    expect(signals.length).toBe(1);
    expect(signals[0].volume).toBe(5000);
  });

  it("should calculate ratio correctly", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 1; i <= 20; i++) {
      candles.push(createCandle(i, 100, 1000));
    }
    // Day 21: exactly 2.5x volume
    candles.push(createCandle(21, 100, 2500));

    const signals = volumeBreakout(candles, { period: 20 });

    expect(signals.length).toBe(1);
    expect(signals[0].ratio).toBe(2.5);
  });

  it("should handle zero volume candles gracefully", () => {
    const candles: NormalizedCandle[] = [];
    // All zero volume
    for (let i = 1; i <= 25; i++) {
      candles.push(createCandle(i, 100, 0));
    }

    const signals = volumeBreakout(candles, { period: 20 });
    // Should not crash and return empty (can't break out from 0)
    expect(signals.length).toBe(0);
  });

  it("should detect breakout correctly at various positions", () => {
    // Test that detection works at different positions in the array
    for (const spikePosition of [21, 30, 50]) {
      const candles: NormalizedCandle[] = [];
      for (let i = 1; i <= spikePosition; i++) {
        candles.push(createCandle(i, 100, i === spikePosition ? 5000 : 1000));
      }

      const signals = volumeBreakout(candles, { period: 20 });
      expect(signals.length).toBe(1);
      expect(signals[0].time).toBe(candles[spikePosition - 1].time);
    }
  });
});
