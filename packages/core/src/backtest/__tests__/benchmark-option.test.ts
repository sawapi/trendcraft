import { describe, expect, it } from "vitest";
import { IndicatorCache } from "../../core/indicator-cache";
import type { NormalizedCandle } from "../../types";
import { rsAbove, rsBelow } from "../conditions/relative-strength";
import { runBacktest } from "../engine";
import { runBacktestScaled } from "../scaled-entry";

const DAY = 86_400_000;
const BASE_TIME = new Date("2024-01-01T00:00:00Z").getTime();

/** Linear price series: `base + i * trend` per bar. */
function makeCandles(count: number, base: number, trend: number): NormalizedCandle[] {
  return Array.from({ length: count }, (_, i) => {
    const price = base + i * trend;
    return {
      time: BASE_TIME + i * DAY,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1_000_000,
    };
  });
}

describe("runBacktest — benchmark option", () => {
  // Stock climbs faster than the benchmark, so RS stays above 1.0.
  const stock = makeCandles(150, 100, 0.8);
  const weakBenchmark = makeCandles(150, 100, 0.2);

  it("seeds benchmark candles so RS conditions can enter", () => {
    const result = runBacktest(stock, rsAbove(1.0), rsBelow(1.0), {
      capital: 1_000_000,
      takeProfit: 5,
      benchmark: weakBenchmark,
    });

    expect(result.tradeCount).toBeGreaterThan(0);
  });

  it("produces no trades when benchmark is omitted (RS conditions evaluate false)", () => {
    const result = runBacktest(stock, rsAbove(1.0), rsBelow(1.0), {
      capital: 1_000_000,
      takeProfit: 5,
    });

    expect(result.tradeCount).toBe(0);
  });

  it("does not leak the benchmark into a later run that omits it (shared cache)", () => {
    const cache = new IndicatorCache();

    const seededRun = runBacktest(
      stock,
      rsAbove(1.0),
      rsBelow(1.0),
      { capital: 1_000_000, takeProfit: 5, benchmark: weakBenchmark },
      cache,
    );
    // Same cache + candles, but no benchmark this time: the option contract says
    // RS conditions evaluate false, so no trades — the prior benchmark must not
    // have been persisted into the shared cache.
    const omittedRun = runBacktest(
      stock,
      rsAbove(1.0),
      rsBelow(1.0),
      { capital: 1_000_000, takeProfit: 5 },
      cache,
    );

    expect(seededRun.tradeCount).toBeGreaterThan(0);
    expect(omittedRun.tradeCount).toBe(0);
  });

  it("does not reuse stale RS data when the benchmark changes on a shared cache", () => {
    // Stock outperforms the weak benchmark (RS > 1.0 → rsAbove enters) but
    // underperforms the strong one (RS < 1.0 → rsAbove never enters).
    const strongBenchmark = makeCandles(150, 100, 1.5);
    const cache = new IndicatorCache();

    const weakRun = runBacktest(
      stock,
      rsAbove(1.0),
      rsBelow(1.0),
      { capital: 1_000_000, takeProfit: 5, benchmark: weakBenchmark },
      cache,
    );
    // Reuse the same cache + same candles, but a stronger benchmark.
    const strongRun = runBacktest(
      stock,
      rsAbove(1.0),
      rsBelow(1.0),
      { capital: 1_000_000, takeProfit: 5, benchmark: strongBenchmark },
      cache,
    );

    expect(weakRun.tradeCount).toBeGreaterThan(0);
    // If RS data were reused from the weak-benchmark run, this would also trade.
    expect(strongRun.tradeCount).toBe(0);
  });
});

describe("runBacktestScaled — benchmark option", () => {
  const stock = makeCandles(150, 100, 0.8);
  const weakBenchmark = makeCandles(150, 100, 0.2);
  const scaledEntry = {
    tranches: 3,
    strategy: "equal" as const,
    intervalType: "signal" as const,
  };

  it("seeds benchmark in the scaled tranche path so RS conditions can enter", () => {
    const result = runBacktestScaled(stock, rsAbove(1.0), rsBelow(1.0), {
      capital: 1_000_000,
      takeProfit: 5,
      scaledEntry,
      benchmark: weakBenchmark,
    });

    expect(result.tradeCount).toBeGreaterThan(0);
  });

  it("produces no trades when benchmark is omitted", () => {
    const result = runBacktestScaled(stock, rsAbove(1.0), rsBelow(1.0), {
      capital: 1_000_000,
      takeProfit: 5,
      scaledEntry,
    });

    expect(result.tradeCount).toBe(0);
  });
});
