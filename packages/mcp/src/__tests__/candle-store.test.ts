import { describe, expect, it } from "vitest";
import { CandleStore } from "../dispatcher/candle-store";
import type { Candle } from "../schemas/candle";

function makeCandles(n: number, start = 100): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const close = start + i;
    out.push({
      time: i * 60_000,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000 + i,
    });
  }
  return out;
}

describe("CandleStore", () => {
  it("stores and retrieves candles by handle, exposing count + span metadata", () => {
    const store = new CandleStore();
    const candles = makeCandles(124);
    const meta = store.put(candles, { symbol: "AAPL" });

    expect(meta.handle).toMatch(/^cdl_/);
    expect(meta.count).toBe(124);
    expect(meta.span.from).toBe(0);
    expect(meta.span.to).toBe(123 * 60_000);
    expect(meta.symbol).toBe("AAPL");

    const retrieved = store.get(meta.handle);
    expect(retrieved).toBe(candles);
  });

  it("returns undefined for unknown handles", () => {
    const store = new CandleStore();
    expect(store.get("cdl_nope")).toBeUndefined();
  });

  it("rejects empty candle arrays at put-time", () => {
    const store = new CandleStore();
    expect(() => store.put([])).toThrow(/INVALID_INPUT/);
  });

  it("evicts oldest entry when capacity is exceeded (LRU by insertion)", () => {
    const store = new CandleStore(3);
    const a = store.put(makeCandles(2));
    const b = store.put(makeCandles(2));
    const c = store.put(makeCandles(2));
    const d = store.put(makeCandles(2));

    // a should have been evicted
    expect(store.get(a.handle)).toBeUndefined();
    expect(store.get(b.handle)).not.toBeUndefined();
    expect(store.get(c.handle)).not.toBeUndefined();
    expect(store.get(d.handle)).not.toBeUndefined();
    expect(store.size()).toBe(3);
  });

  it("get() touches the entry so it is not the oldest anymore", () => {
    const store = new CandleStore(3);
    const a = store.put(makeCandles(2));
    const b = store.put(makeCandles(2));
    const c = store.put(makeCandles(2));

    // Touch a so b becomes oldest
    store.get(a.handle);

    const d = store.put(makeCandles(2));

    expect(store.get(a.handle)).not.toBeUndefined();
    expect(store.get(b.handle)).toBeUndefined();
    expect(store.get(c.handle)).not.toBeUndefined();
    expect(store.get(d.handle)).not.toBeUndefined();
  });

  it("generates unique handles across rapid puts", () => {
    const store = new CandleStore(100);
    const handles = new Set<string>();
    for (let i = 0; i < 50; i++) {
      handles.add(store.put(makeCandles(1)).handle);
    }
    expect(handles.size).toBe(50);
  });
});
