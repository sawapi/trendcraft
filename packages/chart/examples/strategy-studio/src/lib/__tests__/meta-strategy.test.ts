import type { BacktestResult, Trade } from "trendcraft";
import { describe, expect, it } from "vitest";
import {
  buildRotation,
  computeFilter,
  DEFAULT_FILTER_INPUTS,
  DEFAULT_ROTATION_INPUTS,
  type RotationSlot,
} from "../meta-strategy";

function makeTrade(returnPct: number, idx: number): Trade {
  const entryTime = 1700000000000 + idx * 86400000;
  return {
    entryTime,
    entryPrice: 100,
    exitTime: entryTime + 86400000,
    exitPrice: 100 * (1 + returnPct / 100),
    return: 1000 * (returnPct / 100),
    returnPercent: returnPct,
    holdingDays: 1,
  };
}

// Zero defaults for the extended-metrics fields added to `BacktestResult` in
// trendcraft v0.4.x. Spread into mock results so the type stays satisfied
// without each fixture duplicating eleven zero lines.
const EMPTY_EXTENDED_METRICS = {
  sortinoRatio: 0,
  calmarRatio: 0,
  cagrPercent: 0,
  expectancyPercent: 0,
  exposurePercent: 0,
  avgWinPercent: 0,
  avgLossPercent: 0,
  largestWinPercent: 0,
  largestLossPercent: 0,
  firstBarTime: 0,
  lastBarTime: 0,
} as const;

function makeResult(returnsPct: number[], capital = 100_000): BacktestResult {
  const trades = returnsPct.map((r, i) => makeTrade(r, i));
  const totalReturn = trades.reduce((s, t) => s + t.return, 0);
  const wins = trades.filter((t) => t.return > 0).length;
  return {
    initialCapital: capital,
    finalCapital: capital + totalReturn,
    totalReturn,
    totalReturnPercent: (totalReturn / capital) * 100,
    tradeCount: trades.length,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    maxDrawdown: 5,
    sharpeRatio: 1,
    profitFactor: 2,
    avgHoldingDays: 1,
    trades,
    settings: {
      fillMode: "same-bar-close",
      slTpMode: "close-only",
      direction: "long",
      slippage: 0,
      commission: 0,
      commissionRate: 0,
      taxRate: 0,
    },
    drawdownPeriods: [],
    ...EMPTY_EXTENDED_METRICS,
  };
}

describe("computeFilter", () => {
  it("returns empty for missing or trade-less results", () => {
    expect(computeFilter(undefined, DEFAULT_FILTER_INPUTS).kind).toBe("empty");
    expect(computeFilter(makeResult([]), DEFAULT_FILTER_INPUTS).kind).toBe("empty");
  });

  it("produces an analysis + health for non-empty results", () => {
    const result = makeResult([5, -3, 7, -2, 4, -1, 6, 2, -4, 3]);
    const out = computeFilter(result, DEFAULT_FILTER_INPUTS);
    if (out.kind !== "ok") throw new Error(`expected ok, got ${out.kind}`);
    expect(out.analysis.original).toBe(result);
    expect(out.analysis.filtered.trades.length).toBeLessThanOrEqual(result.trades.length);
    expect(out.health.healthScore).toBeGreaterThanOrEqual(0);
    expect(out.health.healthScore).toBeLessThanOrEqual(100);
  });
});

describe("buildRotation", () => {
  function slot(label: string, returns: number[]): RotationSlot {
    return { label, source: "demo", result: makeResult(returns) };
  }

  it("returns empty for empty slot list", () => {
    expect(buildRotation([], DEFAULT_ROTATION_INPUTS).kind).toBe("empty");
  });

  it("allocations sum to 1 (proportional, all positive)", () => {
    const slots = [slot("A", [5, 3, 4]), slot("B", [2, 1, 2]), slot("C", [6, 5, 4])];
    const out = buildRotation(slots, { ...DEFAULT_ROTATION_INPUTS, allocation: "proportional" });
    if (out.kind !== "ok") throw new Error("expected ok");
    const total = out.rotation.allocations.reduce((s, a) => s + a.weight, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("allocations sum to 1 (equal)", () => {
    const slots = [slot("A", [1]), slot("B", [-1]), slot("C", [2])];
    const out = buildRotation(slots, { ...DEFAULT_ROTATION_INPUTS, allocation: "equal" });
    if (out.kind !== "ok") throw new Error("expected ok");
    const total = out.rotation.allocations.reduce((s, a) => s + a.weight, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("higher-metric strategy ranks first", () => {
    const slots = [slot("Low", [1, -1, 0.5]), slot("High", [10, 8, 9]), slot("Mid", [3, 2, 4])];
    const out = buildRotation(slots, {
      ...DEFAULT_ROTATION_INPUTS,
      metric: "returnPercent",
      allocation: "proportional",
    });
    if (out.kind !== "ok") throw new Error("expected ok");
    expect(out.rotation.rankings[0]).toBe(1); // "High"
  });

  it("respects maxActive cap", () => {
    const slots = [slot("A", [5, 4]), slot("B", [3, 2]), slot("C", [-1, -2])];
    const out = buildRotation(slots, {
      ...DEFAULT_ROTATION_INPUTS,
      allocation: "topN",
      maxActive: 2,
    });
    if (out.kind !== "ok") throw new Error("expected ok");
    // topN with 2 active → exactly 2 non-zero weights
    const nonZero = out.rotation.allocations.filter((a) => a.weight > 0);
    expect(nonZero.length).toBe(2);
  });
});
