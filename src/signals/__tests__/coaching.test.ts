import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { detectCoachingSignals } from "../coaching";

function makeCandle(
  day: number,
  close: number,
  opts: { open?: number; high?: number; low?: number; volume?: number } = {},
): NormalizedCandle {
  return {
    time: new Date(2024, 0, day + 1).getTime(),
    open: opts.open ?? close * 0.999,
    high: opts.high ?? close * 1.005,
    low: opts.low ?? close * 0.995,
    close,
    volume: opts.volume ?? 1000,
  };
}

function generateUptrend(count: number, start = 100, slope = 1): NormalizedCandle[] {
  return Array.from({ length: count }, (_, i) => {
    const price = start + i * slope;
    return makeCandle(i, price, {
      open: price - slope * 0.3,
      high: price + 1,
      low: price - 1,
      volume: 1000,
    });
  });
}

function generateDowntrend(count: number, start = 200, slope = 1): NormalizedCandle[] {
  return Array.from({ length: count }, (_, i) => {
    const price = start - i * slope;
    return makeCandle(i, price, {
      open: price + slope * 0.3,
      high: price + 1,
      low: price - 1,
      volume: 1000,
    });
  });
}

describe("detectCoachingSignals", () => {
  it("returns empty for insufficient data", () => {
    expect(detectCoachingSignals([])).toEqual([]);
    expect(detectCoachingSignals([makeCandle(0, 100)])).toEqual([]);
    expect(detectCoachingSignals([makeCandle(0, 100), makeCandle(1, 101)])).toEqual([]);
  });

  it("returns empty when index < 2", () => {
    const candles = generateUptrend(100);
    expect(detectCoachingSignals(candles, 1)).toEqual([]);
  });

  it("detects volume spike", () => {
    const candles = generateUptrend(50);
    // Add a huge volume spike at the end
    const lastCandle = { ...candles[candles.length - 1], volume: 10000 };
    candles[candles.length - 1] = lastCandle;

    const signals = detectCoachingSignals(candles);
    const volumeSignal = signals.find((s) => s.type === "VOLUME_SPIKE");
    expect(volumeSignal).toBeDefined();
    expect(volumeSignal?.indicator).toBe("Volume");
    expect(volumeSignal?.direction).toBe("info");
  });

  it("detects candlestick doji pattern", () => {
    const candles = generateUptrend(50);
    // Replace last candle with a doji (open ≈ close, range > 0)
    const price = candles[candles.length - 1].close;
    candles[candles.length - 1] = makeCandle(49, price, {
      open: price + 0.01,
      high: price + 5,
      low: price - 5,
    });

    const signals = detectCoachingSignals(candles);
    const dojiSignal = signals.find((s) => s.type === "CANDLE_DOJI");
    expect(dojiSignal).toBeDefined();
    expect(dojiSignal?.indicator).toBe("Candlestick");
  });

  it("all signals have required fields", () => {
    const candles = generateUptrend(100);
    // Create a high-volume candle to guarantee at least one signal
    candles[candles.length - 1] = {
      ...candles[candles.length - 1],
      volume: 20000,
    };

    const signals = detectCoachingSignals(candles);
    for (const s of signals) {
      expect(typeof s.type).toBe("string");
      expect(s.direction).toMatch(/^(bullish|bearish|info)$/);
      expect(s.severity).toMatch(/^(high|medium|low)$/);
      expect(typeof s.message).toBe("string");
      expect(typeof s.detail).toBe("string");
      expect(typeof s.indicator).toBe("string");
    }
  });

  it("respects enabledSignals filter", () => {
    const candles = generateUptrend(100);
    candles[candles.length - 1] = {
      ...candles[candles.length - 1],
      volume: 20000,
    };

    const allSignals = detectCoachingSignals(candles);
    const filtered = detectCoachingSignals(candles, undefined, {
      enabledSignals: ["VOLUME_SPIKE"],
    });

    // Filtered should only contain VOLUME_SPIKE
    for (const s of filtered) {
      expect(s.type).toBe("VOLUME_SPIKE");
    }
    // If there were other signal types before, filtered should be shorter or equal
    expect(filtered.length).toBeLessThanOrEqual(allSignals.length);
  });

  it("defaults index to last candle", () => {
    const candles = generateUptrend(100);
    candles[candles.length - 1] = {
      ...candles[candles.length - 1],
      volume: 20000,
    };

    const defaultResult = detectCoachingSignals(candles);
    const explicitResult = detectCoachingSignals(candles, candles.length - 1);

    expect(defaultResult.length).toBe(explicitResult.length);
    expect(defaultResult.map((s) => s.type)).toEqual(explicitResult.map((s) => s.type));
  });

  it("accepts custom SMA periods", () => {
    const candles = generateUptrend(100, 100, 2);
    // Should not throw
    const signals = detectCoachingSignals(candles, undefined, {
      smaShort: 10,
      smaLong: 50,
    });
    expect(Array.isArray(signals)).toBe(true);
  });

  it("detects bearish engulfing pattern", () => {
    const candles = generateUptrend(50);
    const lastIdx = candles.length - 1;
    // Previous candle: bullish (close > open)
    candles[lastIdx - 1] = makeCandle(lastIdx - 1, 150, {
      open: 145,
      high: 152,
      low: 144,
    });
    // Current candle: bearish engulfing (open >= prev close, close <= prev open)
    candles[lastIdx] = makeCandle(lastIdx, 143, {
      open: 152,
      high: 153,
      low: 142,
    });

    const signals = detectCoachingSignals(candles);
    const engulfingSignal = signals.find((s) => s.type === "CANDLE_BEARISH_ENGULFING");
    expect(engulfingSignal).toBeDefined();
    expect(engulfingSignal?.direction).toBe("bearish");
  });

  it("detects bullish engulfing pattern", () => {
    const candles = generateDowntrend(50);
    const lastIdx = candles.length - 1;
    // Previous candle: bearish (close < open)
    candles[lastIdx - 1] = makeCandle(lastIdx - 1, 145, {
      open: 150,
      high: 152,
      low: 144,
    });
    // Current candle: bullish engulfing (open <= prev close, close >= prev open)
    candles[lastIdx] = makeCandle(lastIdx, 152, {
      open: 143,
      high: 153,
      low: 142,
    });

    const signals = detectCoachingSignals(candles);
    const engulfingSignal = signals.find((s) => s.type === "CANDLE_BULLISH_ENGULFING");
    expect(engulfingSignal).toBeDefined();
    expect(engulfingSignal?.direction).toBe("bullish");
  });
});
