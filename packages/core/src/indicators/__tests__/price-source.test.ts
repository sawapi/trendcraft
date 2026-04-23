/**
 * Verifies that `source` option on RSI/MACD/CCI is wired up correctly.
 * Default behavior must stay unchanged; non-default sources must alter results.
 */

import { describe, expect, it } from "vitest";
import type { Candle } from "../../types";
import { cci } from "../momentum/cci";
import { macd } from "../momentum/macd";
import { rsi } from "../momentum/rsi";

function makeCandles(count: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const close = 100 + Math.sin(i / 3) * 5 + i * 0.1;
    // Non-constant high/low spread so hl2/hlc3 differ from close by varying amounts
    const highSpread = 1 + Math.abs(Math.cos(i / 2)) * 2;
    const lowSpread = 0.5 + Math.abs(Math.sin(i / 4)) * 1.5;
    out.push({
      time: 1_700_000_000_000 + i * 60_000,
      open: close - 0.5,
      high: close + highSpread,
      low: close - lowSpread,
      close,
      volume: 1000 + i,
    });
  }
  return out;
}

describe("RSI source option", () => {
  const candles = makeCandles(60);

  it("defaults to close (backward compatible)", () => {
    const a = rsi(candles, { period: 14 });
    const b = rsi(candles, { period: 14, source: "close" });
    expect(a.map((p) => p.value)).toEqual(b.map((p) => p.value));
  });

  it("produces different series for hl2 vs close", () => {
    const a = rsi(candles, { period: 14, source: "close" });
    const b = rsi(candles, { period: 14, source: "hl2" });
    const aLast = a.at(-1)?.value;
    const bLast = b.at(-1)?.value;
    expect(aLast).not.toBeNull();
    expect(bLast).not.toBeNull();
    expect(aLast).not.toBeCloseTo(bLast as number, 6);
  });
});

describe("MACD source option", () => {
  const candles = makeCandles(80);

  it("defaults to close", () => {
    const a = macd(candles);
    const b = macd(candles, { source: "close" });
    expect(a.map((p) => p.value.macd)).toEqual(b.map((p) => p.value.macd));
  });

  it("produces different MACD line for hlc3 vs close", () => {
    const a = macd(candles, { source: "close" });
    const b = macd(candles, { source: "hlc3" });
    const aLast = a.at(-1)?.value.macd;
    const bLast = b.at(-1)?.value.macd;
    expect(aLast).not.toBeNull();
    expect(bLast).not.toBeNull();
    expect(aLast).not.toBeCloseTo(bLast as number, 6);
  });
});

describe("CCI source option", () => {
  const candles = makeCandles(60);

  it("defaults to hlc3 (typical price, backward compatible)", () => {
    const a = cci(candles, { period: 20 });
    const b = cci(candles, { period: 20, source: "hlc3" });
    expect(a.map((p) => p.value)).toEqual(b.map((p) => p.value));
  });

  it("produces different series for close vs hlc3", () => {
    const a = cci(candles, { period: 20, source: "hlc3" });
    const b = cci(candles, { period: 20, source: "close" });
    const aLast = a.at(-1)?.value;
    const bLast = b.at(-1)?.value;
    expect(aLast).not.toBeNull();
    expect(bLast).not.toBeNull();
    expect(aLast).not.toBeCloseTo(bLast as number, 4);
  });
});
