import { describe, it, expect } from "vitest";
import { rotateStrategies } from "../strategy-rotation";
import type { BacktestResult, Trade } from "../../types";

function makeTrade(i: number, returnAmt: number): Trade {
  return {
    entryTime: 1000000 + i * 86400000 * 2,
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
    profitFactor: 1.5,
    avgHoldingDays: 1,
    trades,
    settings: { fillMode: "next-bar-open", slTpMode: "close-only", slippage: 0, commission: 0, commissionRate: 0, taxRate: 0 },
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
    const result = rotateStrategies([
      makeResult([100, 200, 100]),
    ]);
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

    const result = rotateStrategies(
      [makeResult(aReturns), makeResult(bReturns)],
      { lookbackTrades: 10, allocationMethod: "proportional" },
    );

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
