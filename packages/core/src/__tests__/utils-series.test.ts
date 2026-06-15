import { describe, expect, it } from "vitest";
import { macd } from "../indicators/momentum/macd";
import { rsi } from "../indicators/momentum/rsi";
import { ema } from "../indicators/moving-average/ema";
import { sma } from "../indicators/moving-average/sma";
import { swingPoints } from "../indicators/price/swing-points";
import { atr } from "../indicators/volatility/atr";
import { bollingerBands } from "../indicators/volatility/bollinger-bands";
import type { NormalizedCandle, Series } from "../types";
import {
  alignSeries,
  filterSeries,
  firstValidIndex,
  mapSeries,
  trimWarmup,
  warmupBars,
  zipSeries,
} from "../utils/series";

describe("zipSeries", () => {
  it("should merge two series by aligned timestamps", () => {
    const a: Series<number> = [
      { time: 1, value: 10 },
      { time: 2, value: 20 },
      { time: 3, value: 30 },
    ];
    const b: Series<number> = [
      { time: 2, value: 200 },
      { time: 3, value: 300 },
      { time: 4, value: 400 },
    ];

    const result = zipSeries(a, b, (aVal, bVal) => aVal + bVal);

    expect(result).toEqual([
      { time: 2, value: 220 },
      { time: 3, value: 330 },
    ]);
  });

  it("should return empty when no overlapping timestamps", () => {
    const a: Series<number> = [{ time: 1, value: 10 }];
    const b: Series<number> = [{ time: 2, value: 20 }];

    const result = zipSeries(a, b, (aVal, bVal) => aVal + bVal);
    expect(result).toEqual([]);
  });

  it("should handle complex value types", () => {
    const prices: Series<number> = [
      { time: 1, value: 100 },
      { time: 2, value: 105 },
    ];
    const rsi: Series<number> = [
      { time: 1, value: 35 },
      { time: 2, value: 72 },
    ];

    const result = zipSeries(prices, rsi, (price, rsiVal) => ({
      price,
      rsi: rsiVal,
      signal: rsiVal < 30 ? "buy" : rsiVal > 70 ? "sell" : "hold",
    }));

    expect(result).toHaveLength(2);
    expect(result[0].value).toEqual({ price: 100, rsi: 35, signal: "hold" });
    expect(result[1].value).toEqual({ price: 105, rsi: 72, signal: "sell" });
  });

  it("should handle empty series", () => {
    const a: Series<number> = [];
    const b: Series<number> = [{ time: 1, value: 10 }];

    expect(zipSeries(a, b, (a, b) => a + b)).toEqual([]);
    expect(zipSeries(b, a, (a, b) => a + b)).toEqual([]);
  });
});

describe("mapSeries", () => {
  it("should transform values while preserving timestamps", () => {
    const series: Series<number> = [
      { time: 1, value: 50 },
      { time: 2, value: 75 },
      { time: 3, value: 25 },
    ];

    const result = mapSeries(series, (val) => val / 100);

    expect(result).toEqual([
      { time: 1, value: 0.5 },
      { time: 2, value: 0.75 },
      { time: 3, value: 0.25 },
    ]);
  });

  it("should pass index to transform function", () => {
    const series: Series<string> = [
      { time: 1, value: "a" },
      { time: 2, value: "b" },
    ];

    const result = mapSeries(series, (val, idx) => `${idx}:${val}`);

    expect(result).toEqual([
      { time: 1, value: "0:a" },
      { time: 2, value: "1:b" },
    ]);
  });
});

describe("filterSeries", () => {
  it("should filter values by predicate", () => {
    const series: Series<number> = [
      { time: 1, value: 10 },
      { time: 2, value: 50 },
      { time: 3, value: 25 },
      { time: 4, value: 80 },
    ];

    const result = filterSeries(series, (val) => val > 30);

    expect(result).toEqual([
      { time: 2, value: 50 },
      { time: 4, value: 80 },
    ]);
  });
});

describe("alignSeries", () => {
  it("should align source to target timestamps using most recent prior value", () => {
    const source: Series<number> = [
      { time: 10, value: 100 },
      { time: 30, value: 300 },
      { time: 50, value: 500 },
    ];

    const target: Series<number> = [
      { time: 5, value: 0 },
      { time: 15, value: 0 },
      { time: 25, value: 0 },
      { time: 35, value: 0 },
      { time: 55, value: 0 },
    ];

    const result = alignSeries(source, target);

    expect(result).toEqual([
      { time: 5, value: null }, // No source value at or before time 5
      { time: 15, value: 100 }, // Most recent: time 10 → value 100
      { time: 25, value: 100 }, // Still time 10
      { time: 35, value: 300 }, // Most recent: time 30 → value 300
      { time: 55, value: 500 }, // Most recent: time 50 → value 500
    ]);
  });

  it("should return all nulls for empty source", () => {
    const source: Series<number> = [];
    const target: Series<number> = [
      { time: 1, value: 0 },
      { time: 2, value: 0 },
    ];

    const result = alignSeries(source, target);
    expect(result).toEqual([
      { time: 1, value: null },
      { time: 2, value: null },
    ]);
  });
});

describe("warmup detection", () => {
  // 60 candles with a varied (non-flat) price so momentum indicators warm up.
  const candles: NormalizedCandle[] = Array.from({ length: 60 }, (_, i) => {
    const close = 100 + Math.sin(i / 5) * 10;
    return {
      time: 1700000000 + i * 86400,
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000,
    };
  });

  describe("firstValidIndex", () => {
    it("matches the known warmup of period-based indicators (scalar output)", () => {
      expect(firstValidIndex(sma(candles, { period: 3 }))).toBe(2); // period - 1
      expect(firstValidIndex(sma(candles, { period: 20 }))).toBe(19);
      expect(firstValidIndex(ema(candles, { period: 3 }))).toBe(2);
      expect(firstValidIndex(rsi(candles, { period: 14 }))).toBe(14);
      expect(firstValidIndex(atr(candles, { period: 14 }))).toBe(14);
    });

    it("resolves an object-valued indicator's warmup via a field predicate", () => {
      const bb = bollingerBands(candles, { period: 20 });
      // Name the basis (middle) band as the marker of a real value.
      const idx = firstValidIndex(bb, (v) => v.middle !== null);
      expect(idx).toBe(19); // period - 1, same as the underlying SMA
      expect(bb[idx - 1].value.middle).toBeNull();
      expect(bb[idx].value.middle).not.toBeNull();
    });

    it("lets the predicate choose which component defines validity (MACD)", () => {
      const m = macd(candles);
      // The MACD line warms up before the signal line, so requiring the signal
      // too pushes the warmup boundary later.
      const lineIdx = firstValidIndex(m, (v) => v.macd !== null);
      const fullIdx = firstValidIndex(m, (v) => v.macd !== null && v.signal !== null);
      expect(m[lineIdx].value.macd).not.toBeNull();
      expect(fullIdx).toBeGreaterThan(lineIdx);
    });

    it("handles event-style outputs with semantic nulls via a predicate", () => {
      // swingPoints emits boolean flags from the first bar; swingHighPrice /
      // swingLowPrice stay null until a swing prints. There is no generic rule
      // for this — the caller names what a real value means.
      const sp = swingPoints(candles, { leftBars: 2, rightBars: 2 });
      // "Any output at all" — emitted from the first bar.
      expect(firstValidIndex(sp, () => true)).toBe(0);
      // "First actual swing" — a later, data-driven bar.
      const firstSwing = firstValidIndex(sp, (v) => v.isSwingHigh || v.isSwingLow);
      expect(firstSwing).toBeGreaterThan(0);
    });

    it("requires an explicit predicate for object-valued series (compile-time)", () => {
      // Object value cannot use the scalar default; omitting the predicate is a
      // type error, which prevents silently-wrong warmup for these shapes.
      const guard = () =>
        // @ts-expect-error object-valued series requires a validity predicate
        firstValidIndex(bollingerBands(candles, { period: 20 }));
      expect(typeof guard).toBe("function");
    });

    it("returns -1 when nothing is ever valid", () => {
      const allNull: Series<number | null> = [
        { time: 1, value: null },
        { time: 2, value: null },
      ];
      expect(firstValidIndex(allNull)).toBe(-1);
    });

    it("treats NaN and Infinity as warmup placeholders", () => {
      const s: Series<number> = [
        { time: 1, value: Number.NaN },
        { time: 2, value: Number.POSITIVE_INFINITY },
        { time: 3, value: 42 },
      ];
      expect(firstValidIndex(s)).toBe(2);
    });
  });

  describe("warmupBars", () => {
    it("counts the leading warmup region", () => {
      expect(warmupBars(sma(candles, { period: 20 }))).toBe(19);
    });

    it("equals the series length when the indicator never warms up", () => {
      const short = candles.slice(0, 5);
      const s = sma(short, { period: 20 });
      expect(warmupBars(s)).toBe(s.length);
    });
  });

  describe("trimWarmup", () => {
    it("drops the warmup region and keeps valid bars", () => {
      const s = sma(candles, { period: 20 });
      const trimmed = trimWarmup(s);
      expect(trimmed).toHaveLength(s.length - 19);
      expect(trimmed[0].value).not.toBeNull();
      expect(trimmed[0].time).toBe(s[19].time);
    });

    it("returns an empty series when nothing is valid", () => {
      const s = sma(candles.slice(0, 5), { period: 20 });
      expect(trimWarmup(s)).toEqual([]);
    });

    it("preserves the element type of a non-null numeric series (compile-time)", () => {
      const s: Series<number> = [
        { time: 1, value: 1 },
        { time: 2, value: 2 },
      ];
      // Must stay Series<number>, not widen to Series<number | null>.
      const trimmed: Series<number> = trimWarmup(s);
      expect(trimmed).toHaveLength(2);
    });
  });
});
