import { describe, expect, it } from "vitest";
import { macd } from "../../indicators/momentum/macd";
import { rsi } from "../../indicators/momentum/rsi";
import { ema } from "../../indicators/moving-average/ema";
import { sma } from "../../indicators/moving-average/sma";
import { bollingerBands } from "../../indicators/volatility/bollinger-bands";
import type { BollingerBandsValue, MacdValue, NormalizedCandle, Series } from "../../types";
import { combineSeries, extractField, mapValues, seriesToCandles } from "../adapters";
import { applyIndicator, compose, pipe, through } from "../pipe";

/**
 * Generate realistic test candles with trending price action.
 * Starts at basePrice and trends upward with some noise.
 */
function generateCandles(count: number, basePrice = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = basePrice;
  const dayMs = 86400000;

  for (let i = 0; i < count; i++) {
    // Add some pseudo-random noise for realistic OHLCV
    const change = Math.sin(i * 0.5) * 2 + Math.cos(i * 0.3) * 1.5 + 0.1;
    price += change;

    const open = price;
    const high = price + Math.abs(Math.sin(i * 0.7)) * 3 + 0.5;
    const low = price - Math.abs(Math.cos(i * 0.9)) * 3 - 0.5;
    const close = price + Math.sin(i * 1.1) * 1.5;
    const volume = 1000000 + Math.floor(Math.sin(i * 0.4) * 500000);

    candles.push({
      time: dayMs * i,
      open,
      high,
      low,
      close,
      volume: Math.max(volume, 100000),
    });
  }

  return candles;
}

describe("seriesToCandles", () => {
  it("should convert Series to pseudo-candles with OHLC = value", () => {
    const series: Series<number | null> = [
      { time: 1000, value: 50 },
      { time: 2000, value: 75 },
      { time: 3000, value: null },
    ];

    const candles = seriesToCandles(series);

    expect(candles).toHaveLength(3);
    expect(candles[0]).toEqual({ time: 1000, open: 50, high: 50, low: 50, close: 50, volume: 0 });
    expect(candles[1]).toEqual({ time: 2000, open: 75, high: 75, low: 75, close: 75, volume: 0 });
    // null becomes 0
    expect(candles[2]).toEqual({ time: 3000, open: 0, high: 0, low: 0, close: 0, volume: 0 });
  });

  it("should preserve timestamps", () => {
    const series: Series<number | null> = [
      { time: 100, value: 10 },
      { time: 200, value: 20 },
    ];

    const candles = seriesToCandles(series);
    expect(candles[0].time).toBe(100);
    expect(candles[1].time).toBe(200);
  });

  it("should handle empty series", () => {
    const candles = seriesToCandles([]);
    expect(candles).toEqual([]);
  });
});

describe("extractField", () => {
  it("should extract MACD histogram from complex series", () => {
    const macdSeries: Series<MacdValue> = [
      { time: 1000, value: { macd: 1.5, signal: 1.0, histogram: 0.5 } },
      { time: 2000, value: { macd: 2.0, signal: 1.2, histogram: 0.8 } },
      { time: 3000, value: { macd: null, signal: null, histogram: null } },
    ];

    const histogram = extractField(macdSeries, "histogram");

    expect(histogram).toHaveLength(3);
    expect(histogram[0]).toEqual({ time: 1000, value: 0.5 });
    expect(histogram[1]).toEqual({ time: 2000, value: 0.8 });
    expect(histogram[2]).toEqual({ time: 3000, value: null });
  });

  it("should extract Bollinger %B from complex series", () => {
    const bbSeries: Series<BollingerBandsValue> = [
      { time: 1000, value: { upper: 110, middle: 100, lower: 90, percentB: 0.7, bandwidth: 0.2 } },
    ];

    const percentB = extractField(bbSeries, "percentB");
    expect(percentB[0].value).toBe(0.7);
  });
});

describe("mapValues", () => {
  it("should transform series values", () => {
    const series: Series<number | null> = [
      { time: 1000, value: 50 },
      { time: 2000, value: null },
      { time: 3000, value: 100 },
    ];

    const normalized = mapValues(series, (v) => (v !== null ? v / 100 : null));

    expect(normalized[0].value).toBe(0.5);
    expect(normalized[1].value).toBeNull();
    expect(normalized[2].value).toBe(1.0);
  });

  it("should pass index to transform function", () => {
    const series: Series<number | null> = [
      { time: 1000, value: 10 },
      { time: 2000, value: 20 },
    ];

    const indexed = mapValues(series, (v, i) => (v !== null ? v + i : null));

    expect(indexed[0].value).toBe(10); // 10 + 0
    expect(indexed[1].value).toBe(21); // 20 + 1
  });
});

describe("combineSeries", () => {
  it("should combine two series point-by-point", () => {
    const seriesA: Series<number | null> = [
      { time: 1000, value: 10 },
      { time: 2000, value: 20 },
      { time: 3000, value: null },
    ];
    const seriesB: Series<number | null> = [
      { time: 1000, value: 5 },
      { time: 2000, value: 15 },
      { time: 3000, value: 25 },
    ];

    const spread = combineSeries(seriesA, seriesB, (a, b) =>
      a !== null && b !== null ? a - b : null,
    );

    expect(spread).toHaveLength(3);
    expect(spread[0].value).toBe(5); // 10 - 5
    expect(spread[1].value).toBe(5); // 20 - 15
    expect(spread[2].value).toBeNull(); // null - 25
  });

  it("should use minimum length of both series", () => {
    const short: Series<number | null> = [{ time: 1000, value: 10 }];
    const long: Series<number | null> = [
      { time: 1000, value: 5 },
      { time: 2000, value: 15 },
    ];

    const result = combineSeries(short, long, (a, b) => (a !== null && b !== null ? a + b : null));

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(15);
  });

  it("should use timestamps from the first series", () => {
    const a: Series<number | null> = [{ time: 100, value: 1 }];
    const b: Series<number | null> = [{ time: 200, value: 2 }];

    const result = combineSeries(a, b, (va, vb) => (va ?? 0) + (vb ?? 0));
    expect(result[0].time).toBe(100);
  });
});

describe("applyIndicator", () => {
  it("should apply EMA to an RSI series", () => {
    const candles = generateCandles(50);
    const rsiSeries = rsi(candles, { period: 14 });

    const smoothed = applyIndicator(rsiSeries, ema, { period: 9 });

    expect(smoothed.length).toBe(rsiSeries.length);
    // Should have some non-null values (RSI needs 15 candles, then EMA needs 9 more)
    const nonNull = smoothed.filter((p) => p.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);
  });
});

describe("pipe", () => {
  it("should chain RSI then EMA", () => {
    const candles = generateCandles(50);

    const result = pipe(
      candles,
      (c) => rsi(c, { period: 14 }),
      (s) => applyIndicator(s, ema, { period: 9 }),
    );

    expect(result.length).toBe(candles.length);
    const nonNull = result.filter((p) => p.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);

    // Verify the result matches manual chaining
    const manual = ema(seriesToCandles(rsi(candles, { period: 14 })), { period: 9 });
    expect(result).toEqual(manual);
  });

  it("should work with a single transform", () => {
    const candles = generateCandles(30);

    const result = pipe(candles, (c) => sma(c, { period: 5 }));

    expect(result.length).toBe(candles.length);
  });
});

describe("through", () => {
  it("should create reusable transform steps", () => {
    const candles = generateCandles(50);

    const result = pipe(candles, (c) => rsi(c, { period: 14 }), through(ema, { period: 9 }));

    // Should produce same result as applyIndicator
    const expected = pipe(
      candles,
      (c) => rsi(c, { period: 14 }),
      (s) => applyIndicator(s, ema, { period: 9 }),
    );

    expect(result).toEqual(expected);
  });

  it("should allow multiple through steps", () => {
    const candles = generateCandles(50);

    const result = pipe(
      candles,
      (c) => rsi(c, { period: 14 }),
      through(ema, { period: 9 }),
      through(sma, { period: 3 }),
    );

    expect(result.length).toBeGreaterThan(0);
    // Should have some valid values after triple processing
    const nonNull = result.filter((p) => p.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);
  });
});

describe("compose", () => {
  it("should compose transforms in reverse order", () => {
    const candles = generateCandles(50);

    const smoothedRsi = compose(
      (s: Series<number | null>) => applyIndicator(s, ema, { period: 9 }),
      (c: NormalizedCandle[]) => rsi(c, { period: 14 }),
    );

    const result = smoothedRsi(candles);

    // Should match pipe equivalent
    const expected = pipe(
      candles,
      (c) => rsi(c, { period: 14 }),
      (s) => applyIndicator(s, ema, { period: 9 }),
    );

    expect(result).toEqual(expected);
  });

  it("should work with single function", () => {
    const candles = generateCandles(30);

    const rsi14 = compose((c: NormalizedCandle[]) => rsi(c, { period: 14 }));

    const result = rsi14(candles);
    const expected = rsi(candles, { period: 14 });
    expect(result).toEqual(expected);
  });
});

describe("Integration: pipe with extractField", () => {
  it("should pipe MACD histogram through EMA", () => {
    const candles = generateCandles(60);

    const result = pipe(
      candles,
      (c) => macd(c),
      (s) => extractField(s, "histogram"),
      through(ema, { period: 9 }),
    );

    expect(result.length).toBe(candles.length);
    const nonNull = result.filter((p) => p.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);
  });

  it("should pipe MACD histogram through Bollinger Bands", () => {
    const candles = generateCandles(80);

    const result = pipe(
      candles,
      (c) => macd(c),
      (s) => extractField(s, "histogram"),
      through(bollingerBands, { period: 20 }),
    );

    expect(result.length).toBe(candles.length);
    // Bollinger Bands returns complex values
    const nonNullUpper = result.filter((p) => p.value.upper !== null);
    expect(nonNullUpper.length).toBeGreaterThan(0);
  });
});

describe("Integration: full pipeline with mapValues and combineSeries", () => {
  it("should normalize RSI and combine with EMA signal", () => {
    const candles = generateCandles(50);

    // RSI normalized to 0-1 range
    const normalizedRsi = pipe(
      candles,
      (c) => rsi(c, { period: 14 }),
      (s) => mapValues(s, (v) => (v !== null ? v / 100 : null)),
    );

    // SMA as a price reference (also normalized)
    const smaPrice = sma(candles, { period: 20 });

    // Combine them
    const combined = combineSeries(normalizedRsi, smaPrice, (rsiVal, smaVal) =>
      rsiVal !== null && smaVal !== null ? rsiVal : null,
    );

    expect(combined.length).toBe(Math.min(normalizedRsi.length, smaPrice.length));

    // Check normalized RSI values are in 0-1 range
    for (const point of normalizedRsi) {
      if (point.value !== null) {
        expect(point.value).toBeGreaterThanOrEqual(0);
        expect(point.value).toBeLessThanOrEqual(1);
      }
    }
  });
});
