import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { defineUnifiedCondition, unifiedAnd, unifiedNot, unifiedOr } from "../unified";

const dummyCandle: NormalizedCandle = {
  time: 1000,
  open: 100,
  high: 105,
  low: 95,
  close: 102,
  volume: 5000,
};

describe("defineUnifiedCondition", () => {
  it("creates a unified condition with correct def", () => {
    const cond = defineUnifiedCondition({
      name: "testCond",
      requires: ["rsi"],
      evaluate: (ind) => {
        const rsi = ind.rsi;
        return typeof rsi === "number" && rsi < 30;
      },
    });

    expect(cond.def.name).toBe("testCond");
    expect(cond.def.requires).toEqual(["rsi"]);
  });

  it("toBacktestCondition returns a valid PresetCondition", () => {
    const cond = defineUnifiedCondition({
      name: "rsiOversold",
      requires: ["rsi"],
      evaluate: (ind) => {
        const rsi = ind.rsi;
        return typeof rsi === "number" && rsi < 30;
      },
    });

    const bt = cond.toBacktestCondition();
    expect(bt.type).toBe("preset");
    expect(bt.name).toBe("rsiOversold");

    // Evaluate in backtest context
    const indicators: Record<string, unknown> = { rsi: 25 };
    expect(bt.evaluate(indicators, dummyCandle, 0, [dummyCandle])).toBe(true);
    expect(bt.evaluate({ rsi: 50 }, dummyCandle, 0, [dummyCandle])).toBe(false);
  });

  it("toStreamingCondition returns a valid StreamingPresetCondition", () => {
    const cond = defineUnifiedCondition({
      name: "rsiOversold",
      requires: ["rsi"],
      evaluate: (ind) => {
        const rsi = ind.rsi;
        return typeof rsi === "number" && rsi < 30;
      },
    });

    const sc = cond.toStreamingCondition();
    expect(sc.type).toBe("preset");
    expect(sc.name).toBe("rsiOversold");

    // Evaluate in streaming context
    expect(sc.evaluate({ rsi: 25 }, dummyCandle)).toBe(true);
    expect(sc.evaluate({ rsi: 50 }, dummyCandle)).toBe(false);
  });

  it("evaluate function receives candle", () => {
    const cond = defineUnifiedCondition({
      name: "priceAboveSma",
      requires: ["sma50"],
      evaluate: (ind, candle) => {
        const sma = ind.sma50;
        return typeof sma === "number" && candle.close > sma;
      },
    });

    const bt = cond.toBacktestCondition();
    expect(bt.evaluate({ sma50: 90 }, dummyCandle, 0, [dummyCandle])).toBe(true);
    expect(bt.evaluate({ sma50: 110 }, dummyCandle, 0, [dummyCandle])).toBe(false);
  });
});

describe("unifiedAnd", () => {
  it("requires all conditions to be true", () => {
    const c1 = defineUnifiedCondition({
      name: "a",
      requires: ["rsi"],
      evaluate: (ind) => (ind.rsi as number) < 30,
    });
    const c2 = defineUnifiedCondition({
      name: "b",
      requires: ["macd"],
      evaluate: (ind) => (ind.macd as number) > 0,
    });

    const combined = unifiedAnd(c1, c2);
    const bt = combined.toBacktestCondition();

    expect(bt.evaluate({ rsi: 25, macd: 1 }, dummyCandle, 0, [dummyCandle])).toBe(true);
    expect(bt.evaluate({ rsi: 25, macd: -1 }, dummyCandle, 0, [dummyCandle])).toBe(false);
    expect(bt.evaluate({ rsi: 50, macd: 1 }, dummyCandle, 0, [dummyCandle])).toBe(false);
  });

  it("merges requires from all conditions", () => {
    const c1 = defineUnifiedCondition({
      name: "a",
      requires: ["rsi"],
      evaluate: () => true,
    });
    const c2 = defineUnifiedCondition({
      name: "b",
      requires: ["macd", "rsi"],
      evaluate: () => true,
    });

    const combined = unifiedAnd(c1, c2);
    expect(combined.def.requires).toEqual(["rsi", "macd"]);
  });
});

describe("unifiedOr", () => {
  it("requires any condition to be true", () => {
    const c1 = defineUnifiedCondition({
      name: "a",
      requires: ["rsi"],
      evaluate: (ind) => (ind.rsi as number) < 30,
    });
    const c2 = defineUnifiedCondition({
      name: "b",
      requires: ["macd"],
      evaluate: (ind) => (ind.macd as number) > 0,
    });

    const combined = unifiedOr(c1, c2);
    const sc = combined.toStreamingCondition();

    expect(sc.evaluate({ rsi: 25, macd: -1 }, dummyCandle)).toBe(true);
    expect(sc.evaluate({ rsi: 50, macd: 1 }, dummyCandle)).toBe(true);
    expect(sc.evaluate({ rsi: 50, macd: -1 }, dummyCandle)).toBe(false);
  });
});

describe("unifiedNot", () => {
  it("negates the condition", () => {
    const c1 = defineUnifiedCondition({
      name: "overbought",
      requires: ["rsi"],
      evaluate: (ind) => (ind.rsi as number) > 70,
    });

    const notOverbought = unifiedNot(c1);
    const bt = notOverbought.toBacktestCondition();

    expect(bt.evaluate({ rsi: 50 }, dummyCandle, 0, [dummyCandle])).toBe(true);
    expect(bt.evaluate({ rsi: 80 }, dummyCandle, 0, [dummyCandle])).toBe(false);
  });
});
