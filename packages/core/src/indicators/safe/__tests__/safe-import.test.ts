import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { smaSafe } from "../../safe";
import {
  atr,
  bollingerBands,
  ema,
  err,
  flatMap,
  ichimoku,
  macd,
  mapResult,
  ok,
  rsi,
  sma,
  unwrap,
  unwrapOr,
} from "../index";

describe("trendcraft/safe subpath exports", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close * 1.02,
      low: close * 0.98,
      close,
      volume: 1000,
    }));

  const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));

  it("should export functions without Safe suffix", () => {
    expect(typeof sma).toBe("function");
    expect(typeof ema).toBe("function");
    expect(typeof rsi).toBe("function");
    expect(typeof macd).toBe("function");
    expect(typeof bollingerBands).toBe("function");
    expect(typeof atr).toBe("function");
    expect(typeof ichimoku).toBe("function");
  });

  it("should return the same Result as the *Safe version", () => {
    const safeResult = smaSafe(candles, { period: 5 });
    const cleanResult = sma(candles, { period: 5 });

    expect(safeResult.ok).toBe(true);
    expect(cleanResult.ok).toBe(true);
    if (safeResult.ok && cleanResult.ok) {
      expect(cleanResult.value).toEqual(safeResult.value);
    }
  });

  it("should return Err on invalid parameters", () => {
    const result = sma(candles, { period: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("period");
    }
  });

  it("should export Result type utilities", () => {
    expect(typeof ok).toBe("function");
    expect(typeof err).toBe("function");
    expect(typeof unwrap).toBe("function");
    expect(typeof unwrapOr).toBe("function");
    expect(typeof mapResult).toBe("function");
    expect(typeof flatMap).toBe("function");
  });

  it("unwrapOr should work with safe indicator result", () => {
    const result = sma(candles, { period: 0 });
    const fallback = unwrapOr(result, []);
    expect(fallback).toEqual([]);
  });

  it("unwrap should return value for successful result", () => {
    const result = rsi(candles, { period: 14 });
    const value = unwrap(result);
    expect(value.length).toBe(candles.length);
  });
});
