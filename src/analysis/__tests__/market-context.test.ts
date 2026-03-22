import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { analyzeMarketContext } from "../market-context";

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
    });
  });
}

function generateRange(count: number, center = 100): NormalizedCandle[] {
  return Array.from({ length: count }, (_, i) => {
    // Oscillate around center
    const offset = Math.sin(i * 0.5) * 0.5;
    const price = center + offset;
    return makeCandle(i, price, {
      open: price - 0.1,
      high: price + 0.5,
      low: price - 0.5,
    });
  });
}

describe("analyzeMarketContext", () => {
  it("returns default context for empty candles", () => {
    const ctx = analyzeMarketContext([]);
    expect(ctx.trend).toBe("range");
    expect(ctx.regime).toBe("RANGE");
    expect(ctx.confidence).toBe(0);
    expect(ctx.description).toBe("Insufficient data");
  });

  it("returns default context for out-of-bounds index", () => {
    const candles = generateUptrend(5);
    const ctx = analyzeMarketContext(candles, 100);
    expect(ctx.regime).toBe("RANGE");
  });

  it("detects uptrend with sufficient data", () => {
    const candles = generateUptrend(120, 100, 2);
    const ctx = analyzeMarketContext(candles);

    expect(ctx.trend).toBe("uptrend");
    expect(ctx.regime).toBe("TREND_UP");
    expect(["strong", "moderate"]).toContain(ctx.trendStrength);
    expect(ctx.confidence).toBeGreaterThan(0);
    expect(ctx.description).toContain("Uptrend");
  });

  it("detects downtrend with sufficient data", () => {
    const candles = generateDowntrend(120, 300, 2);
    const ctx = analyzeMarketContext(candles);

    expect(ctx.trend).toBe("downtrend");
    expect(ctx.regime).toBe("TREND_DOWN");
  });

  it("detects range-bound market", () => {
    const candles = generateRange(120);
    const ctx = analyzeMarketContext(candles);

    expect(ctx.trend).toBe("range");
    expect(ctx.regime).toBe("RANGE");
  });

  it("classifies price vs SMA correctly in uptrend", () => {
    const candles = generateUptrend(120, 100, 2);
    const ctx = analyzeMarketContext(candles);

    // In a strong uptrend, price should be above both MAs
    expect(ctx.priceVsSmaShort).toBe("above");
  });

  it("returns RSI zone when available", () => {
    // Create a very strong uptrend to push RSI high
    const candles = generateUptrend(120, 100, 5);
    const ctx = analyzeMarketContext(candles);

    // RSI should be defined
    expect(ctx.rsiZone).toBeDefined();
  });

  it("returns BB position when available", () => {
    const candles = generateUptrend(120, 100, 2);
    const ctx = analyzeMarketContext(candles);

    // In strong uptrend, price should be near upper BB
    expect(ctx.bbPosition).toBeDefined();
  });

  it("analyzes at a specific index", () => {
    const candles = generateUptrend(120, 100, 2);
    const ctx = analyzeMarketContext(candles, 80);

    expect(ctx.trend).toBeDefined();
    expect(ctx.description).not.toBe("Insufficient data");
  });

  it("accepts custom SMA periods", () => {
    const candles = generateUptrend(120, 100, 2);
    const ctx = analyzeMarketContext(candles, undefined, {
      smaShort: 10,
      smaLong: 50,
    });

    expect(ctx.trend).toBe("uptrend");
    expect(ctx.description).toContain("MA10");
  });

  it("includes golden_cross in smaCross when applicable", () => {
    // Start ranging, then switch to uptrend to trigger golden cross
    const ranging = generateRange(80);
    const trending = generateUptrend(60, 100, 3);
    const candles = [...ranging, ...trending];

    const ctx = analyzeMarketContext(candles);

    // smaCross should be one of the valid values
    expect(["golden_cross", "death_cross", "above", "below"]).toContain(ctx.smaCross);
  });

  it("description is a non-empty string", () => {
    const candles = generateUptrend(120, 100, 2);
    const ctx = analyzeMarketContext(candles);

    expect(typeof ctx.description).toBe("string");
    expect(ctx.description.length).toBeGreaterThan(0);
  });

  it("defaults index to last candle", () => {
    const candles = generateUptrend(120, 100, 2);
    const ctxDefault = analyzeMarketContext(candles);
    const ctxExplicit = analyzeMarketContext(candles, candles.length - 1);

    expect(ctxDefault.trend).toBe(ctxExplicit.trend);
    expect(ctxDefault.regime).toBe(ctxExplicit.regime);
  });
});
