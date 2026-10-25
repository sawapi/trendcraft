/**
 * Oversized inputs are refused with INVALID_INPUT rather than held in memory.
 */

import { describe, expect, it } from "vitest";
import { CandleStore } from "../dispatcher/candle-store";
import {
  type Candle,
  candlesArraySchema,
  candlesTupleArraySchema,
  MAX_CANDLES,
} from "../schemas/candle";
import { calcIndicatorHandler } from "../tools/calc";
import { loadCandlesHandler, MAX_HINT_LENGTH, MAX_SYMBOL_LENGTH } from "../tools/load-candles";

const HOUR = 3_600_000;

function makeCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + Math.sin(i / 4) * 5 + i * 0.1;
    return {
      time: Date.UTC(2024, 0, 2, 14) + i * HOUR,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000 + i * 10,
    };
  });
}

describe("input size limits", () => {
  it("refuses more than MAX_CANDLES candles on calc and load", () => {
    const candles = makeCandles(MAX_CANDLES + 1);
    expect(() => calcIndicatorHandler({ kind: "sma", candles, params: { period: 5 } })).toThrow(
      new RegExp(`^INVALID_INPUT: candles must contain at most ${MAX_CANDLES}`),
    );
    expect(() => loadCandlesHandler({ candles }, new CandleStore())).toThrow(/^INVALID_INPUT/);
  });

  it("refuses an over-long symbol or hint", () => {
    const candles = makeCandles(5);
    const store = new CandleStore();
    expect(() =>
      loadCandlesHandler({ candles, symbol: "X".repeat(MAX_SYMBOL_LENGTH + 1) }, store),
    ).toThrow(/^INVALID_INPUT: symbol must be at most/);
    expect(() =>
      loadCandlesHandler({ candles, hint: "h".repeat(MAX_HINT_LENGTH + 1) }, store),
    ).toThrow(/^INVALID_INPUT: hint must be at most/);
    expect(
      loadCandlesHandler({ candles, symbol: "X".repeat(MAX_SYMBOL_LENGTH) }, store).count,
    ).toBe(5);
  });

  it.each([
    ["candles", () => candlesArraySchema, (): unknown => ({ time: "x" })],
    ["candlesArray", () => candlesTupleArraySchema, (): unknown => ["x"]],
  ] as const)(
    "rejects an oversized %s array by its length, before checking the bars",
    (_name, schema, bad) => {
      // Without a length bound, validation records one issue per invalid bar:
      // a huge array of them could exhaust the server's memory before any
      // handler ran.
      const huge = Array.from({ length: MAX_CANDLES + 1 }, bad);
      const result = schema().safeParse(huge);
      expect(result.success).toBe(false);
      expect(result.error?.issues).toHaveLength(1);
      expect(result.error?.issues[0].message).toMatch(
        new RegExp(`^INVALID_INPUT: candles must contain at most ${MAX_CANDLES}`),
      );
    },
  );
});
