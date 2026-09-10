import { describe, expect, it } from "vitest";
import { EMPTY_EXTENDED_METRICS_FIXTURE } from "../../backtest/__tests__/backtest-result-fixture";
import type { BacktestResult, Trade } from "../../types";
import { rotateStrategies } from "../strategy-rotation";

function makeTrade(i: number, returnAmt: number): Trade {
  return {
    entryTime: 1_700_000_000_000 + i * 86_400_000 * 2,
    entryPrice: 100,
    exitTime: 1000000 + (i * 2 + 1) * 86400000,
    exitPrice: 100 + returnAmt / 100,
    return: returnAmt,
    returnPercent: (returnAmt / 10000) * 100,
    holdingDays: 1,
  };
}

function makeResult(tradeReturns: number[]): BacktestResult {
  const trades = tradeReturns.map((r, i) => makeTrade(i, r));
  const totalReturn = tradeReturns.reduce((s, r) => s + r, 0);
  return {
    initialCapital: 10000,
    finalCapital: 10000 + totalReturn,
    totalReturn,
    totalReturnPercent: (totalReturn / 10000) * 100,
    tradeCount: trades.length,
    winRate: trades.filter((t) => t.return > 0).length / (trades.length || 1),
    maxDrawdown: 0.1,
    sharpeRatio: 1.0,
    ...EMPTY_EXTENDED_METRICS_FIXTURE,
    profitFactor: 1.5,
    avgHoldingDays: 1,
    trades,
    settings: {
      fillMode: "next-bar-open",
      slTpMode: "close-only",
      slippage: 0,
      commission: 0,
      commissionRate: 0,
      taxRate: 0,
    },
    drawdownPeriods: [],
  };
}

describe("rotateStrategies", () => {
  it("returns empty for empty input", () => {
    const result = rotateStrategies([]);
    expect(result.allocations).toHaveLength(0);
    expect(result.activeCount).toBe(0);
    expect(result.rankings).toHaveLength(0);
  });

  it("gives 100% to single strategy", () => {
    const result = rotateStrategies([makeResult([100, 200, 100])]);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].weight).toBeCloseTo(1);
  });

  it("ranks strategies by returnPercent by default", () => {
    const best = makeResult(Array.from({ length: 20 }, () => 300));
    const mid = makeResult(Array.from({ length: 20 }, () => 100));
    const worst = makeResult(Array.from({ length: 20 }, () => -100));

    const result = rotateStrategies([worst, best, mid]);
    // Rankings should put index 1 (best) first
    expect(result.rankings[0]).toBe(1);
    expect(result.rankings[1]).toBe(2);
    expect(result.rankings[2]).toBe(0);
  });

  it("proportional allocation gives more weight to better strategies", () => {
    const best = makeResult(Array.from({ length: 20 }, () => 300));
    const mid = makeResult(Array.from({ length: 20 }, () => 100));

    const result = rotateStrategies([best, mid], {
      allocationMethod: "proportional",
    });

    const bestAlloc = result.allocations.find((a) => a.strategyIndex === 0);
    const midAlloc = result.allocations.find((a) => a.strategyIndex === 1);
    expect(bestAlloc!.weight).toBeGreaterThan(midAlloc!.weight);
  });

  it("equal allocation gives same weight to all", () => {
    const a = makeResult(Array.from({ length: 20 }, () => 300));
    const b = makeResult(Array.from({ length: 20 }, () => 100));
    const c = makeResult(Array.from({ length: 20 }, () => 50));

    const result = rotateStrategies([a, b, c], {
      allocationMethod: "equal",
    });

    for (const alloc of result.allocations) {
      expect(alloc.weight).toBeCloseTo(1 / 3, 5);
    }
  });

  it("topN with maxActiveStrategies=1 gives 100% to best", () => {
    const a = makeResult(Array.from({ length: 20 }, () => 100));
    const b = makeResult(Array.from({ length: 20 }, () => 300));

    const result = rotateStrategies([a, b], {
      allocationMethod: "topN",
      maxActiveStrategies: 1,
    });

    expect(result.activeCount).toBe(1);
    expect(result.allocations[0].strategyIndex).toBe(1);
    expect(result.allocations[0].weight).toBeCloseTo(1);
  });

  it("weights sum to 1", () => {
    const results = [
      makeResult(Array.from({ length: 20 }, () => 200)),
      makeResult(Array.from({ length: 20 }, () => 100)),
      makeResult(Array.from({ length: 20 }, () => 50)),
    ];

    for (const method of ["equal", "proportional", "topN"] as const) {
      const rotation = rotateStrategies(results, { allocationMethod: method });
      const totalWeight = rotation.allocations.reduce((s, a) => s + a.weight, 0);
      expect(totalWeight).toBeCloseTo(1, 5);
    }
  });

  it("uses lookbackTrades for ranking", () => {
    // Strategy A: good early, bad recently
    const aReturns = [
      ...Array.from({ length: 20 }, () => 300),
      ...Array.from({ length: 10 }, () => -200),
    ];
    // Strategy B: bad early, good recently
    const bReturns = [
      ...Array.from({ length: 20 }, () => -200),
      ...Array.from({ length: 10 }, () => 300),
    ];

    const result = rotateStrategies([makeResult(aReturns), makeResult(bReturns)], {
      lookbackTrades: 10,
      allocationMethod: "proportional",
    });

    // B should rank higher based on recent performance
    expect(result.rankings[0]).toBe(1);
  });

  it("handles all-negative strategies gracefully", () => {
    const results = [
      makeResult(Array.from({ length: 20 }, () => -100)),
      makeResult(Array.from({ length: 20 }, () => -200)),
    ];

    const result = rotateStrategies(results, {
      allocationMethod: "proportional",
    });

    // Should fall back to equal weight
    const totalWeight = result.allocations.reduce((s, a) => s + a.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
  });
});

describe("non-finite ranking metrics", () => {
  const allWinners = makeResult(Array.from({ length: 10 }, () => 100));
  const mixed = makeResult([200, 200, 200, 200, 200, 200, -100, -100, -100, -100]);

  it("a single all-winning strategy ranked by profit factor gets weight 1, not NaN", () => {
    const rotation = rotateStrategies([allWinners], {
      rankingMetric: "profitFactor",
      allocationMethod: "proportional",
    });
    expect(rotation.allocations).toEqual([
      { strategyIndex: 0, weight: 1, metricValue: Number.POSITIVE_INFINITY },
    ]);
    expect(rotation.activeCount).toBe(1);
  });

  it("an infinite profit factor takes the whole proportional allocation; the finite one gets 0", () => {
    const rotation = rotateStrategies([mixed, allWinners], {
      rankingMetric: "profitFactor",
      allocationMethod: "proportional",
    });
    // Stimulus: the metric really is infinite for the all-winning strategy.
    expect(rotation.allocations.map((a) => a.metricValue)).toEqual([Number.POSITIVE_INFINITY, 3]);
    expect(rotation.allocations.map((a) => [a.strategyIndex, a.weight])).toEqual([
      [1, 1],
      [0, 0],
    ]);
    expect(rotation.rankings).toEqual([1, 0]);
    expect(rotation.activeCount).toBe(1);
  });

  it("two infinite profit factors share the allocation equally, in input order", () => {
    const rotation = rotateStrategies([allWinners, allWinners, mixed], {
      rankingMetric: "profitFactor",
      allocationMethod: "proportional",
    });
    expect(rotation.rankings).toEqual([0, 1, 2]);
    expect(rotation.allocations.map((a) => [a.strategyIndex, a.weight])).toEqual([
      [0, 0.5],
      [1, 0.5],
      [2, 0],
    ]);
    expect(rotation.activeCount).toBe(2);
  });

  it("returns finite weights on a simplex for every numeric class of trade return", () => {
    const classes = [
      0,
      -0,
      1,
      -1,
      100,
      -100,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_VALUE,
      -Number.MAX_VALUE,
      Number.MIN_VALUE,
    ];
    let seed = 7;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
    const metrics = ["returnPercent", "sharpeRatio", "profitFactor", "winRate"] as const;
    const methods = ["equal", "proportional", "topN"] as const;
    let infiniteMetricRuns = 0;
    let overflowRuns = 0;
    let zeroWeightRuns = 0;
    for (let i = 0; i < 20000; i++) {
      const n = 1 + Math.floor(rnd() * 4);
      const results = Array.from({ length: n }, () =>
        // One strategy in ten is "huge but finite": a metric near MAX_VALUE
        // whose raw sum with a sibling overflows to Infinity.
        rnd() < 0.1
          ? makeResult([Number.MAX_VALUE, -1])
          : makeResult(Array.from({ length: Math.floor(rnd() * 6) }, () => pick(classes))),
      );
      const maxActiveStrategies = 1 + Math.floor(rnd() * n);
      const rotation = rotateStrategies(results, {
        rankingMetric: pick(metrics),
        allocationMethod: pick(methods),
        maxActiveStrategies,
        minAllocation: pick([0, 0.05, 0.3]),
      });
      const weights = rotation.allocations.map((a) => a.weight);
      for (const w of weights) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
      expect(weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 9);
      expect(rotation.allocations).toHaveLength(maxActiveStrategies);
      expect(rotation.activeCount).toBe(weights.filter((w) => w > 0).length);
      expect([...rotation.rankings].sort()).toEqual(results.map((_, k) => k).sort());
      const metricValues = rotation.allocations.map((a) => a.metricValue);
      if (metricValues.includes(Number.POSITIVE_INFINITY)) infiniteMetricRuns++;
      const finitePositive = metricValues.filter((v) => v > 0 && Number.isFinite(v));
      if (finitePositive.reduce((s, v) => s + v, 0) === Number.POSITIVE_INFINITY) overflowRuns++;
      if (weights.some((w) => w === 0)) zeroWeightRuns++;
    }
    expect(infiniteMetricRuns).toBeGreaterThan(500);
    expect(overflowRuns).toBeGreaterThan(50);
    expect(zeroWeightRuns).toBeGreaterThan(500);
  });

  it("handles a very large number of strategies (no argument-list spread)", () => {
    const many = Array.from({ length: 150_000 }, (_, i) => makeResult([1 + (i % 7)]));
    const rotation = rotateStrategies(many, { allocationMethod: "proportional", minAllocation: 0 });
    expect(rotation.allocations).toHaveLength(150_000);
    const sum = rotation.allocations.reduce((s, a) => s + a.weight, 0);
    expect(sum).toBeCloseTo(1, 9);
    expect(rotation.allocations[0].metricValue).toBeCloseTo(0.07, 12);
  });

  it("two huge but finite metrics whose sum overflows still split the allocation", () => {
    const huge = makeResult([Number.MAX_VALUE, -1]);
    const rotation = rotateStrategies([huge, huge], {
      rankingMetric: "profitFactor",
      allocationMethod: "proportional",
    });
    // Stimulus: both metrics are finite and their raw sum is not.
    expect(rotation.allocations.every((a) => Number.isFinite(a.metricValue))).toBe(true);
    expect(rotation.allocations.reduce((s, a) => s + a.metricValue, 0)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(rotation.allocations.map((a) => a.weight)).toEqual([0.5, 0.5]);
    expect(rotation.activeCount).toBe(2);
  });
});

describe("minAllocation redistribution", () => {
  const strong = makeResult(Array.from({ length: 10 }, () => 1000));
  const losing = makeResult(Array.from({ length: 10 }, () => -100));

  it("keeps a zero-weight strategy in the output when another one falls below the minimum", () => {
    const tiny = makeResult(Array.from({ length: 10 }, () => 20));
    const rotation = rotateStrategies([strong, tiny, losing], { allocationMethod: "proportional" });
    // Stimulus: the redistribution branch fired — `tiny` was pruned to 0.
    expect(rotation.allocations.map((a) => [a.strategyIndex, a.weight])).toEqual([
      [0, 1],
      [1, 0],
      [2, 0],
    ]);
    // The row that used to vanish still carries its metric (sum of returnPercent).
    expect(rotation.allocations.find((a) => a.strategyIndex === 2)?.metricValue).toBe(-10);
  });

  it("keeps the same rows when no strategy falls below the minimum", () => {
    const modest = makeResult(Array.from({ length: 10 }, () => 200));
    const skipped = rotateStrategies([strong, modest, losing], {
      allocationMethod: "proportional",
    });
    expect(skipped.allocations.map((a) => a.strategyIndex).sort()).toEqual([0, 1, 2]);
    expect(skipped.allocations.find((a) => a.strategyIndex === 1)?.weight).toBeCloseTo(1 / 6, 9);
  });

  it("never lets a redistributed weight exceed 1", () => {
    // 0.7777… + (0.7777… / 0.7777…) × 0.2222… lands one ulp above 1 in floating point.
    const rotation = rotateStrategies([makeResult([50]), makeResult([10, 4.2857142857142856])], {
      minAllocation: 0.3,
    });
    expect(rotation.allocations.map((a) => a.weight)).toEqual([1, 0]);
  });
});
