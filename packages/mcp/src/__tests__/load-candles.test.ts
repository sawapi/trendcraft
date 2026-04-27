import { describe, expect, it } from "vitest";
import { CandleStore } from "../dispatcher/candle-store";
import type { Candle } from "../schemas/candle";
import { loadCandlesHandler } from "../tools/load-candles";

function makeCandles(n: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      time: i * 60_000,
      open: 100 + i,
      high: 101 + i,
      low: 99 + i,
      close: 100 + i,
      volume: 1000 + i,
    });
  }
  return out;
}

describe("loadCandlesHandler", () => {
  it("accepts canonical candles and returns a usable handle", () => {
    const store = new CandleStore();
    const candles = makeCandles(50);

    const result = loadCandlesHandler({ candles, symbol: "BTC", hint: "1Hour" }, store);

    expect(result.handle).toMatch(/^cdl_/);
    expect(result.count).toBe(50);
    expect(result.span.from).toBe(0);
    expect(result.span.to).toBe(49 * 60_000);
    expect(result.symbol).toBe("BTC");
    expect(result.hint).toBe("1Hour");
    expect(store.get(result.handle)?.length).toBe(50);
  });

  it("accepts compact tuple form via candlesArray", () => {
    const store = new CandleStore();
    const tuples: [number, number, number, number, number, number][] = [
      [0, 100, 101, 99, 100.5, 1000],
      [60_000, 100.5, 102, 100, 101.5, 1100],
      [120_000, 101.5, 103, 101, 102.5, 1200],
    ];

    const result = loadCandlesHandler({ candlesArray: tuples }, store);
    expect(result.count).toBe(3);

    const stored = store.get(result.handle);
    expect(stored).toEqual([
      { time: 0, open: 100, high: 101, low: 99, close: 100.5, volume: 1000 },
      { time: 60_000, open: 100.5, high: 102, low: 100, close: 101.5, volume: 1100 },
      { time: 120_000, open: 101.5, high: 103, low: 101, close: 102.5, volume: 1200 },
    ]);
  });

  it("accepts tuples without volume (5-element form)", () => {
    const store = new CandleStore();
    const tuples: [number, number, number, number, number][] = [[0, 100, 101, 99, 100]];
    const result = loadCandlesHandler({ candlesArray: tuples }, store);
    const stored = store.get(result.handle);
    expect(stored).toEqual([{ time: 0, open: 100, high: 101, low: 99, close: 100 }]);
  });

  it("rejects when neither candles nor candlesArray is provided", () => {
    const store = new CandleStore();
    expect(() => loadCandlesHandler({}, store)).toThrow(/INVALID_INPUT.*one of/);
  });

  it("rejects when both candles and candlesArray are provided", () => {
    const store = new CandleStore();
    expect(() =>
      loadCandlesHandler({ candles: makeCandles(2), candlesArray: [[0, 1, 1, 1, 1]] }, store),
    ).toThrow(/INVALID_INPUT.*exactly one/);
  });

  it("rejects empty arrays with canonical INVALID_INPUT", () => {
    const store = new CandleStore();
    expect(() => loadCandlesHandler({ candles: [] }, store)).toThrow(/INVALID_INPUT.*at least 1/);
  });
});
