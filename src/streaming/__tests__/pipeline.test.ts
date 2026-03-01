import { describe, it, expect } from "vitest";
import { createPipeline } from "../pipeline";
import { rsiBelow, rsiAbove, and, priceAbove } from "../conditions";
import type { NormalizedCandle } from "../../types";

/**
 * Minimal mock indicator that returns a fixed value sequence
 */
function createMockIndicator(values: (number | null)[]) {
  let idx = 0;
  let state = { idx: 0, values };
  return {
    next(candle: NormalizedCandle) {
      const value = idx < values.length ? values[idx] : values[values.length - 1] ?? null;
      idx++;
      state = { idx, values };
      return { time: candle.time, value };
    },
    peek(candle: NormalizedCandle) {
      const value = idx < values.length ? values[idx] : values[values.length - 1] ?? null;
      return { time: candle.time, value };
    },
    getState() {
      return state;
    },
    get count() { return idx; },
    get isWarmedUp() { return idx > 0; },
  };
}

function candle(time: number, close: number): NormalizedCandle {
  return { time, open: close, high: close + 1, low: close - 1, close, volume: 100 };
}

describe("createPipeline", () => {
  it("should process candles and build snapshot", () => {
    const rsiValues = [null, null, 45, 25, 75];
    const pipeline = createPipeline({
      indicators: [
        { name: "rsi", create: () => createMockIndicator(rsiValues) },
      ],
    });

    const r0 = pipeline.next(candle(0, 100));
    expect(r0.snapshot.rsi).toBeNull();

    const r1 = pipeline.next(candle(1, 101));
    expect(r1.snapshot.rsi).toBeNull();

    const r2 = pipeline.next(candle(2, 102));
    expect(r2.snapshot.rsi).toBe(45);
  });

  it("should evaluate entry and exit conditions", () => {
    const rsiValues = [25, 50, 75];
    const pipeline = createPipeline({
      indicators: [
        { name: "rsi", create: () => createMockIndicator(rsiValues) },
      ],
      entry: rsiBelow(30),
      exit: rsiAbove(70),
    });

    const r0 = pipeline.next(candle(0, 100));
    expect(r0.entrySignal).toBe(true);
    expect(r0.exitSignal).toBe(false);

    const r1 = pipeline.next(candle(1, 101));
    expect(r1.entrySignal).toBe(false);
    expect(r1.exitSignal).toBe(false);

    const r2 = pipeline.next(candle(2, 102));
    expect(r2.entrySignal).toBe(false);
    expect(r2.exitSignal).toBe(true);
  });

  it("should evaluate named signals", () => {
    const rsiValues = [25, 75, 50];
    const pipeline = createPipeline({
      indicators: [
        { name: "rsi", create: () => createMockIndicator(rsiValues) },
      ],
      signals: [
        { name: "oversold", condition: rsiBelow(30) },
        { name: "overbought", condition: rsiAbove(70) },
      ],
    });

    expect(pipeline.next(candle(0, 100)).signals).toEqual(["oversold"]);
    expect(pipeline.next(candle(1, 101)).signals).toEqual(["overbought"]);
    expect(pipeline.next(candle(2, 102)).signals).toEqual([]);
  });

  it("should evaluate combined conditions", () => {
    const rsiValues = [25, 25, 75];
    const smaValues = [90, 110, 90];
    const pipeline = createPipeline({
      indicators: [
        { name: "rsi", create: () => createMockIndicator(rsiValues) },
        { name: "sma20", create: () => createMockIndicator(smaValues) },
      ],
      entry: and(rsiBelow(30), priceAbove("sma20")),
    });

    // RSI=25, SMA=90, close=100 → price above SMA + RSI below 30 → entry
    expect(pipeline.next(candle(0, 100)).entrySignal).toBe(true);
    // RSI=25, SMA=110, close=101 → price below SMA → no entry
    expect(pipeline.next(candle(1, 101)).entrySignal).toBe(false);
    // RSI=75, SMA=90, close=102 → RSI too high → no entry
    expect(pipeline.next(candle(2, 102)).entrySignal).toBe(false);
  });

  it("should support peek without advancing state", () => {
    const rsiValues = [25, 50];
    const pipeline = createPipeline({
      indicators: [
        { name: "rsi", create: () => createMockIndicator(rsiValues) },
      ],
      entry: rsiBelow(30),
    });

    const peeked = pipeline.peek(candle(0, 100));
    expect(peeked.entrySignal).toBe(true);

    // peek doesn't advance, so next should get same value
    const nexted = pipeline.next(candle(0, 100));
    expect(nexted.entrySignal).toBe(true);
  });

  it("should return false for entry/exit when not configured", () => {
    const pipeline = createPipeline({
      indicators: [
        { name: "rsi", create: () => createMockIndicator([50]) },
      ],
    });

    const result = pipeline.next(candle(0, 100));
    expect(result.entrySignal).toBe(false);
    expect(result.exitSignal).toBe(false);
    expect(result.signals).toEqual([]);
  });

  it("should serialize state", () => {
    const pipeline = createPipeline({
      indicators: [
        { name: "rsi", create: () => createMockIndicator([25, 50]) },
      ],
    });

    pipeline.next(candle(0, 100));
    const state = pipeline.getState();
    expect(state.indicatorStates).toHaveLength(1);
    expect(state.indicatorStates[0].name).toBe("rsi");
  });
});
