import { describe, it, expect } from "vitest";
import type { NormalizedCandle } from "../../types";
import { runBacktest } from "../engine";
import { rsiBelow, rsiAbove } from "../conditions";

const DAY = 24 * 60 * 60 * 1000;

function makeCandle(
  i: number,
  overrides?: Partial<NormalizedCandle>,
): NormalizedCandle {
  const price = 100 + i;
  return {
    time: Date.now() - (100 - i) * DAY,
    open: price - 0.5,
    high: price + 1,
    low: price - 1,
    close: price,
    volume: 1_000_000,
    ...overrides,
  };
}

describe("runBacktest with validateData", () => {
  it("should throw on invalid OHLC data", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 50; i++) {
      candles.push(makeCandle(i));
    }
    // Inject an invalid candle: high < close
    candles[25] = makeCandle(25, { high: 120, low: 130, close: 125, open: 124 });

    expect(() =>
      runBacktest(candles, rsiBelow(30), rsiAbove(70), {
        capital: 1_000_000,
        validateData: true,
      }),
    ).toThrow("Data validation failed");
  });

  it("should pass validation on clean data", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 50; i++) {
      candles.push(makeCandle(i));
    }

    // Should not throw
    const result = runBacktest(candles, rsiBelow(30), rsiAbove(70), {
      capital: 1_000_000,
      validateData: true,
    });

    expect(result.initialCapital).toBe(1_000_000);
  });

  it("should not validate when validateData is false", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 50; i++) {
      candles.push(makeCandle(i));
    }
    // Inject bad candle
    candles[25] = makeCandle(25, { high: 120, low: 130, close: 125, open: 124 });

    // Should not throw when validation is disabled
    expect(() =>
      runBacktest(candles, rsiBelow(30), rsiAbove(70), {
        capital: 1_000_000,
      }),
    ).not.toThrow();
  });

  it("should accept ValidationOptions object", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 50; i++) {
      candles.push(makeCandle(i));
    }

    // Pass with specific validation options (disable OHLC check)
    const result = runBacktest(candles, rsiBelow(30), rsiAbove(70), {
      capital: 1_000_000,
      validateData: { ohlc: false, gaps: false, duplicates: false, spikes: false, volumeAnomalies: false, stale: false },
    });

    expect(result.initialCapital).toBe(1_000_000);
  });
});
