/**
 * The reference lines each indicator is read against: MACD's zero line,
 * CMO's ±50 with its zero line, Connors RSI's 10/90 and the zero line of
 * cumulative returns.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import type { SeriesMeta } from "../../types/candle";
import { cmo } from "../momentum/cmo";
import { connorsRsi } from "../momentum/connors-rsi";
import { macd } from "../momentum/macd";
import { cumulativeReturns } from "../price/returns";

const candles: NormalizedCandle[] = Array.from({ length: 60 }, (_, i) => {
  const close = 100 + Math.sin(i / 4) * 5;
  return {
    time: i * 86_400_000,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  };
});

function lines(series: unknown): number[] | undefined {
  return (series as { __meta?: SeriesMeta }).__meta?.referenceLines;
}

describe("indicator reference lines", () => {
  it("MACD has a zero line", () => {
    expect(lines(macd(candles))).toEqual([0]);
  });

  it("CMO has ±50 and a zero line", () => {
    expect(lines(cmo(candles))).toEqual([-50, 0, 50]);
  });

  it("Connors RSI has 10 and 90", () => {
    expect(lines(connorsRsi(candles))).toEqual([10, 90]);
  });

  it("cumulative returns have a zero line", () => {
    expect(lines(cumulativeReturns(candles))).toEqual([0]);
  });
});
