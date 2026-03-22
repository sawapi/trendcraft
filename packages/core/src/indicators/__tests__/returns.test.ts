import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { cumulativeReturns, returns } from "../price/returns";

describe("returns", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close + 5,
      low: close - 5,
      close,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([100, 110]);
    expect(() => returns(candles, { period: 0 })).toThrow();
  });

  it("should return empty array for empty input", () => {
    expect(returns([])).toEqual([]);
  });

  it("should calculate simple returns correctly", () => {
    const candles = makeCandles([100, 110, 105, 115]);
    const result = returns(candles, { period: 1, type: "simple" });

    expect(result[0].value).toBeNull(); // No previous price
    expect(result[1].value).toBeCloseTo(0.1, 10); // (110 - 100) / 100 = 0.1
    expect(result[2].value).toBeCloseTo(-0.0455, 3); // (105 - 110) / 110
    expect(result[3].value).toBeCloseTo(0.0952, 3); // (115 - 105) / 105
  });

  it("should calculate log returns correctly", () => {
    const candles = makeCandles([100, 110, 105]);
    const result = returns(candles, { period: 1, type: "log" });

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeCloseTo(Math.log(110 / 100), 10);
    expect(result[2].value).toBeCloseTo(Math.log(105 / 110), 10);
  });

  it("should calculate multi-period returns", () => {
    const candles = makeCandles([100, 105, 110, 115, 120]);
    const result = returns(candles, { period: 2 });

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeCloseTo(0.1, 10); // (110 - 100) / 100
    expect(result[3].value).toBeCloseTo(0.0952, 3); // (115 - 105) / 105
  });

  it("should use default values (period=1, type=simple)", () => {
    const candles = makeCandles([100, 110, 120]);

    const resultDefault = returns(candles);
    const resultExplicit = returns(candles, { period: 1, type: "simple" });

    expect(resultDefault).toEqual(resultExplicit);
  });

  it("should handle zero price", () => {
    const candles = makeCandles([0, 100, 110]);
    const result = returns(candles, { period: 1 });

    expect(result[1].value).toBeNull(); // Division by zero
    expect(result[2].value).toBeCloseTo(0.1, 10);
  });
});

describe("cumulativeReturns", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close + 5,
      low: close - 5,
      close,
      volume: 1000,
    }));

  it("should return empty array for empty input", () => {
    expect(cumulativeReturns([])).toEqual([]);
  });

  it("should calculate simple cumulative returns", () => {
    const candles = makeCandles([100, 110, 120, 90]);
    const result = cumulativeReturns(candles, "simple");

    expect(result[0].value).toBeCloseTo(0, 10); // (100 - 100) / 100 = 0
    expect(result[1].value).toBeCloseTo(0.1, 10); // (110 - 100) / 100 = 0.1
    expect(result[2].value).toBeCloseTo(0.2, 10); // (120 - 100) / 100 = 0.2
    expect(result[3].value).toBeCloseTo(-0.1, 10); // (90 - 100) / 100 = -0.1
  });

  it("should calculate log cumulative returns", () => {
    const candles = makeCandles([100, 110, 120]);
    const result = cumulativeReturns(candles, "log");

    expect(result[0].value).toBeCloseTo(0, 10);
    expect(result[1].value).toBeCloseTo(Math.log(110 / 100), 10);
    expect(result[2].value).toBeCloseTo(Math.log(120 / 100), 10);
  });

  it("should use simple returns by default", () => {
    const candles = makeCandles([100, 120, 150]);

    const resultDefault = cumulativeReturns(candles);
    const resultSimple = cumulativeReturns(candles, "simple");

    expect(resultDefault).toEqual(resultSimple);
  });
});
