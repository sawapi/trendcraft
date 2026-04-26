import { describe, expect, it } from "vitest";
import type { Candle } from "../schemas/candle";
import { calcIndicatorHandler } from "../tools/calc";

function makeCandles(n: number, start = 100): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const close = start + Math.sin(i / 4) * 5 + i * 0.1;
    out.push({
      time: i * 60_000,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000 + i * 10,
    });
  }
  return out;
}

describe("calcIndicatorHandler", () => {
  it("computes RSI(14) and slices to last 200 by default", () => {
    const candles = makeCandles(300);
    const result = calcIndicatorHandler({ kind: "rsi", candles, params: { period: 14 } });
    expect(result.kind).toBe("rsi");
    expect(result.totalLength).toBe(300);
    expect(result.count).toBe(200);
    expect(result.truncated).toBe(true);
    const last = result.series.at(-1) as { time: number; value: number | null };
    expect(typeof last.time).toBe("number");
  });

  it("returns full series when lastN=0", () => {
    const candles = makeCandles(50);
    const result = calcIndicatorHandler({ kind: "sma", candles, params: { period: 5 }, lastN: 0 });
    expect(result.count).toBe(result.totalLength);
    expect(result.truncated).toBe(false);
  });

  it("surfaces UNSUPPORTED_KIND for unknown / non-safe kinds", () => {
    const candles = makeCandles(10);
    expect(() => calcIndicatorHandler({ kind: "no-such-indicator", candles })).toThrow(
      /UNSUPPORTED_KIND/,
    );
  });

  it("blocks reserved Result helper names from being treated as indicators", () => {
    const candles = makeCandles(10);
    expect(() => calcIndicatorHandler({ kind: "ok", candles })).toThrow(/UNSUPPORTED_KIND/);
  });

  it("propagates safe-wrapper errors with their canonical code", () => {
    const candles = makeCandles(50);
    // period=0 is invalid → safe wrapper surfaces INVALID_PARAMETER (or INDICATOR_ERROR).
    expect(() => calcIndicatorHandler({ kind: "rsi", candles, params: { period: 0 } })).toThrow(
      /INVALID_PARAMETER|INDICATOR_ERROR|INSUFFICIENT_DATA/,
    );
  });
});
