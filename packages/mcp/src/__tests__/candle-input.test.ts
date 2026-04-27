import { describe, expect, it } from "vitest";
import { CandleStore } from "../dispatcher/candle-store";
import type { Candle } from "../schemas/candle";
import { calcIndicatorHandler } from "../tools/calc";
import { detectSignalHandler } from "../tools/detect-signal";
import { loadCandlesHandler } from "../tools/load-candles";

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

function tuplesFromCandles(candles: Candle[]): [number, number, number, number, number, number][] {
  return candles.map((c) => [c.time, c.open, c.high, c.low, c.close, c.volume ?? 0]);
}

describe("calc_indicator with new candle input forms", () => {
  it("accepts candlesRef and produces the same result as inline candles", () => {
    const store = new CandleStore();
    const candles = makeCandles(80);
    const { handle } = loadCandlesHandler({ candles }, store);

    const inline = calcIndicatorHandler({ kind: "rsi", candles, params: { period: 14 } }, store);
    const viaRef = calcIndicatorHandler(
      { kind: "rsi", candlesRef: handle, params: { period: 14 } },
      store,
    );

    expect(viaRef.totalLength).toBe(inline.totalLength);
    expect(viaRef.count).toBe(inline.count);
    expect(viaRef.series).toEqual(inline.series);
  });

  it("accepts candlesArray (compact tuple form) and matches canonical result", () => {
    const store = new CandleStore();
    const candles = makeCandles(60);
    const tuples = tuplesFromCandles(candles);

    const inline = calcIndicatorHandler({ kind: "sma", candles, params: { period: 5 } }, store);
    const viaArray = calcIndicatorHandler(
      { kind: "sma", candlesArray: tuples, params: { period: 5 } },
      store,
    );

    expect(viaArray.series).toEqual(inline.series);
  });

  it("returns INVALID_HANDLE for evicted/missing candlesRef", () => {
    const store = new CandleStore();
    expect(() =>
      calcIndicatorHandler({ kind: "rsi", candlesRef: "cdl_nope", params: { period: 14 } }, store),
    ).toThrow(/INVALID_HANDLE.*load_candles/);
  });

  it("rejects when caller provides no candle input", () => {
    const store = new CandleStore();
    expect(() => calcIndicatorHandler({ kind: "rsi", params: { period: 14 } }, store)).toThrow(
      /INVALID_INPUT.*one of/,
    );
  });

  it("rejects when caller provides multiple candle inputs", () => {
    const store = new CandleStore();
    const candles = makeCandles(20);
    const { handle } = loadCandlesHandler({ candles }, store);
    expect(() =>
      calcIndicatorHandler(
        { kind: "rsi", candles, candlesRef: handle, params: { period: 14 } },
        store,
      ),
    ).toThrow(/INVALID_INPUT.*exactly one/);
  });

  it("INVALID_PARAMETER message embeds manifest paramHints (B4)", () => {
    const store = new CandleStore();
    const candles = makeCandles(50);
    // sma's manifest paramHints includes the word "period"; we only assert the
    // error mentions "paramHints:" so the test stays robust if hint text
    // wording shifts.
    expect(() => calcIndicatorHandler({ kind: "sma", candles }, store)).toThrow(
      /INVALID_PARAMETER.*paramHints:/,
    );
  });
});

describe("detect_signal with new candle input forms", () => {
  function trending(n: number): Candle[] {
    const out: Candle[] = [];
    for (let i = 0; i < n; i++) {
      const close = 100 + i * 0.3 + Math.sin(i / 5) * 2;
      out.push({
        time: i * 86_400_000,
        open: close - 0.4,
        high: close + 0.6,
        low: close - 0.6,
        close,
        volume: 1000 + (i % 7) * 250,
      });
    }
    return out;
  }

  it("accepts candlesRef and matches inline result", () => {
    const store = new CandleStore();
    const candles = trending(80);
    const { handle } = loadCandlesHandler({ candles }, store);

    const inline = detectSignalHandler(
      { kind: "goldenCross", candles, params: { short: 5, long: 25 }, lastN: 0 },
      store,
    );
    const viaRef = detectSignalHandler(
      { kind: "goldenCross", candlesRef: handle, params: { short: 5, long: 25 }, lastN: 0 },
      store,
    );

    expect(viaRef.firedAt).toEqual(inline.firedAt);
    expect(viaRef.totalLength).toBe(inline.totalLength);
  });

  it("returns INVALID_HANDLE for stale candlesRef", () => {
    const store = new CandleStore();
    expect(() =>
      detectSignalHandler({ kind: "goldenCross", candlesRef: "cdl_gone" }, store),
    ).toThrow(/INVALID_HANDLE/);
  });
});
