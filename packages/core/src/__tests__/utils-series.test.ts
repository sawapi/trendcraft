import { describe, expect, it } from "vitest";
import type { Series } from "../types";
import { alignSeries, filterSeries, mapSeries, zipSeries } from "../utils/series";

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
