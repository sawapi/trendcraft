import { describe, it, expect } from "vitest";
import { createStreamingMtf } from "../mtf";
import type { NormalizedCandle } from "../../types";

function candle(time: number, close: number): NormalizedCandle {
  return { time, open: close, high: close + 1, low: close - 1, close, volume: 100 };
}

/**
 * Simple mock indicator for testing MTF
 */
function createCounterIndicator() {
  let count = 0;
  let lastValue: number | null = null;
  return {
    next(c: NormalizedCandle) {
      count++;
      lastValue = c.close;
      return { time: c.time, value: lastValue };
    },
    peek(c: NormalizedCandle) {
      return { time: c.time, value: c.close };
    },
    getState() {
      return { count, lastValue };
    },
    get count() { return count; },
    get isWarmedUp() { return count > 0; },
  };
}

describe("createStreamingMtf", () => {
  it("should resample 1-min candles into 5-min and process indicators", () => {
    const mtf = createStreamingMtf({
      timeframes: [
        {
          intervalMs: 300_000, // 5 min
          indicators: [
            { name: "close", create: () => createCounterIndicator() },
          ],
        },
      ],
    });

    // Feed 1-min candles for first 5-min period
    for (let i = 0; i < 5; i++) {
      mtf.next(candle(i * 60_000, 100 + i));
    }

    // At 5m, the first 5-min candle completes → indicator should have been called
    const snapshot = mtf.next(candle(300_000, 110));

    // The "5m" key should exist
    expect(snapshot["5m"]).toBeDefined();
  });

  it("should generate correct timeframe keys", () => {
    const mtf = createStreamingMtf({
      timeframes: [
        { intervalMs: 60_000, indicators: [{ name: "val", create: () => createCounterIndicator() }] },
        { intervalMs: 300_000, indicators: [{ name: "val", create: () => createCounterIndicator() }] },
        { intervalMs: 900_000, indicators: [{ name: "val", create: () => createCounterIndicator() }] },
        { intervalMs: 3_600_000, indicators: [{ name: "val", create: () => createCounterIndicator() }] },
        { intervalMs: 86_400_000, indicators: [{ name: "val", create: () => createCounterIndicator() }] },
      ],
    });

    const snapshot = mtf.next(candle(0, 100));
    expect(snapshot["1m"]).toBeDefined();
    expect(snapshot["5m"]).toBeDefined();
    expect(snapshot["15m"]).toBeDefined();
    expect(snapshot["1h"]).toBeDefined();
    expect(snapshot["1d"]).toBeDefined();
  });

  it("should not advance indicators before a higher-TF candle completes", () => {
    let indicatorCallCount = 0;
    const mtf = createStreamingMtf({
      timeframes: [
        {
          intervalMs: 300_000,
          indicators: [
            {
              name: "counter",
              create: () => ({
                next() {
                  indicatorCallCount++;
                  return { time: 0, value: indicatorCallCount };
                },
                peek() {
                  return { time: 0, value: indicatorCallCount };
                },
                getState() {
                  return { count: indicatorCallCount };
                },
              }),
            },
          ],
        },
      ],
    });

    // Feed 4 candles in the first 5-min period
    for (let i = 0; i < 4; i++) {
      mtf.next(candle(i * 60_000, 100));
    }
    // Indicator should NOT have been called yet (no completed 5-min candle)
    expect(indicatorCallCount).toBe(0);

    // 5th candle still in same period
    mtf.next(candle(240_000, 100));
    expect(indicatorCallCount).toBe(0);

    // 6th candle starts new period → first 5-min candle completes
    mtf.next(candle(300_000, 100));
    expect(indicatorCallCount).toBe(1);
  });

  it("should serialize state", () => {
    const mtf = createStreamingMtf({
      timeframes: [
        {
          intervalMs: 300_000,
          indicators: [
            { name: "val", create: () => createCounterIndicator() },
          ],
        },
      ],
    });

    mtf.next(candle(0, 100));
    const state = mtf.getState();
    expect(state.timeframes).toHaveLength(1);
    expect(state.timeframes[0].intervalMs).toBe(300_000);
    expect(state.timeframes[0].resamplerState).toBeDefined();
    expect(state.timeframes[0].indicatorStates).toHaveLength(1);
  });
});
