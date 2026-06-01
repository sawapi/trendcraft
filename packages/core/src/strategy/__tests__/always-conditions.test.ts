import { describe, expect, it } from "vitest";
import { runBacktest } from "../../backtest";
import { alwaysFalse, alwaysTrue } from "../../backtest/conditions/core";
import type { NormalizedCandle } from "../../types";
import { loadStrategy } from "../hydrate";
import { backtestRegistry } from "../registry-backtest";
import type { StrategyJSON } from "../types";

function makeCandles(n: number): NormalizedCandle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: 1700000000000 + i * 86400000,
    open: 100 + i,
    high: 102 + i,
    low: 98 + i,
    close: 101 + i,
    volume: 1000,
  }));
}

describe("alwaysTrue / alwaysFalse", () => {
  it("alwaysTrue evaluates true regardless of inputs", () => {
    const cond = alwaysTrue();
    expect(cond.type).toBe("preset");
    expect(cond.name).toBe("alwaysTrue");
    expect(cond.evaluate({}, {} as never, 0, [])).toBe(true);
  });

  it("alwaysFalse evaluates false regardless of inputs", () => {
    const cond = alwaysFalse();
    expect(cond.type).toBe("preset");
    expect(cond.name).toBe("alwaysFalse");
    expect(cond.evaluate({}, {} as never, 0, [])).toBe(false);
  });

  it("registry round-trips the JSON spec", () => {
    const json: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "buy-and-hold",
      name: "Buy and Hold",
      entry: { name: "alwaysTrue" },
      exit: { name: "alwaysFalse" },
    };
    const { entry, exit } = loadStrategy(json, backtestRegistry);
    expect(entry).toMatchObject({ type: "preset", name: "alwaysTrue" });
    expect(exit).toMatchObject({ type: "preset", name: "alwaysFalse" });
  });

  it("alwaysTrue entry + alwaysFalse exit produces a single buy-and-hold trade", () => {
    const candles = makeCandles(20);
    const result = runBacktest(candles, alwaysTrue(), alwaysFalse(), { capital: 10_000 });
    // The condition itself never says "exit"; the engine force-closes the
    // open position at the end of the candle stream. Exact entry bar depends
    // on engine warm-up rules — what we assert here is the engine never
    // takes a second trade because the exit condition never fires.
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].exitTime).toBe(candles[candles.length - 1].time);
  });
});
