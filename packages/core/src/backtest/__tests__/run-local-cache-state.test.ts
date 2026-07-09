/**
 * Run-local state must never leak through a shared IndicatorCache.
 *
 * The shared cache may only hold values that are a pure function of the
 * candle array. Two things are not: per-run mutable condition state (the
 * perfectOrderPullbackEntry breakdown tracker) and per-run inputs the engine
 * injects (the `fundamentals` option's per/pbr scalars). If either reaches
 * the shared cache, a later run on the same candles + cache inherits the
 * previous run's end state — phantom trades with no way to see why.
 */
import { describe, expect, it } from "vitest";
import {
  createCachedIndicators,
  IndicatorCache,
  RUN_LOCAL_KEY_PREFIX,
} from "../../core/indicator-cache";
import type { NormalizedCandle } from "../../types";
import { perBelow } from "../conditions/fundamentals";
import {
  perfectOrderPullbackEntry,
  perfectOrderPullbackSellEntry,
} from "../conditions/po-pullback";
import { runBacktest } from "../engine";

/** Deterministic seeded PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateCandles(n: number, seed: number): NormalizedCandle[] {
  const rng = mulberry32(seed);
  const candles: NormalizedCandle[] = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    // Uptrend with periodic pullbacks so perfect-order machinery engages
    const change = 0.3 + Math.sin(i / 9) * 0.5 + (rng() - 0.5) * 1.5;
    const open = price;
    const close = Math.max(price + change, 1);
    candles.push({
      time: 1700000000000 + i * 86400000,
      open,
      high: Math.max(open, close) + rng(),
      low: Math.max(Math.min(open, close) - rng(), 0.5),
      close,
      volume: 1000,
    });
    price = close;
  }
  return candles;
}

describe("run-local cache state", () => {
  it("perfectOrderPullbackEntry keeps its mutable state out of the shared cache", () => {
    const candles = generateCandles(200, 17);
    const cache = new IndicatorCache();
    const condition = perfectOrderPullbackEntry();

    // Run 1 through a cache-backed proxy — evaluates every bar, builds state
    const proxy1 = createCachedIndicators(candles, cache);
    candles.forEach((c, i) => condition.evaluate(proxy1, c, i, candles));

    // Only the derived poData series may be shared; the mutable state object
    // must have stayed run-local.
    expect(cache.size).toBe(1);

    // Run 2 (fresh proxy, same cache) must behave exactly like a no-cache run
    const truth = (() => {
      const plain: Record<string, unknown> = {};
      return candles.map((c, i) => condition.evaluate(plain, c, i, candles));
    })();
    const proxy2 = createCachedIndicators(candles, cache);
    const run2 = candles.map((c, i) => condition.evaluate(proxy2, c, i, candles));
    expect(run2).toEqual(truth);
  });

  it("buy/sell and different option sets get separate run-local state slots", () => {
    const candles = generateCandles(120, 5);
    const indicators: Record<string, unknown> = {};

    // Same params: buy + sell share one poData series but must not share state
    perfectOrderPullbackEntry().evaluate(indicators, candles[50], 50, candles);
    perfectOrderPullbackSellEntry().evaluate(indicators, candles[50], 50, candles);
    // Different collapseEps: previously the state key ignored every param
    // except periods, so these silently shared one state object
    perfectOrderPullbackEntry({ collapseEps: 0.05 }).evaluate(indicators, candles[50], 50, candles);

    const stateKeys = Object.keys(indicators).filter((k) => k.startsWith(RUN_LOCAL_KEY_PREFIX));
    expect(stateKeys.length).toBe(3);
  });

  it("fundamentals per/pbr do not leak into a later run that omits them (shared cache)", () => {
    const candles = generateCandles(60, 29);
    const fundamentals = candles.map((c) => ({ time: c.time, per: 10, pbr: 0.8 }));
    const never = { type: "preset" as const, name: "never", evaluate: () => false };
    const cache = new IndicatorCache();

    // Run 1 WITH fundamentals: perBelow(15) fires (per=10 on every bar)
    const run1 = runBacktest(
      candles,
      perBelow(15),
      never,
      { capital: 100000, fundamentals },
      cache,
    );
    expect(run1.trades.length).toBeGreaterThan(0);

    // Run 2 WITHOUT fundamentals on the SAME cache: per must be undefined,
    // so perBelow never fires — identical to the fresh-cache control
    const run2 = runBacktest(candles, perBelow(15), never, { capital: 100000 }, cache);
    const control = runBacktest(candles, perBelow(15), never, { capital: 100000 });
    expect(control.trades.length).toBe(0);
    expect(run2.trades.length).toBe(0);
  });
});
