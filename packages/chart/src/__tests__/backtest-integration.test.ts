import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import type { DataPoint } from "../core/types";

describe("Backtest Integration", () => {
  it("stores backtest result", () => {
    const dl = new DataLayer();
    const result = {
      initialCapital: 10000,
      finalCapital: 12000,
      totalReturnPercent: 20,
      tradeCount: 5,
      winRate: 60,
      maxDrawdown: 8,
      sharpeRatio: 1.5,
      profitFactor: 2.0,
      trades: [],
      drawdownPeriods: [],
    };
    dl.setBacktestResult(result);
    expect(dl.backtestResult).toBe(result);
  });

  it("stores pattern signals", () => {
    const dl = new DataLayer();
    const patterns = [
      {
        time: 1000,
        type: "double_top",
        pattern: {
          startTime: 800,
          endTime: 1000,
          keyPoints: [
            { time: 800, index: 0, price: 100, label: "Peak 1" },
            { time: 900, index: 5, price: 95, label: "Trough" },
            { time: 1000, index: 10, price: 100, label: "Peak 2" },
          ],
        },
        confidence: 85,
        confirmed: true,
      },
    ];
    dl.setPatterns(patterns);
    expect(dl.patterns.length).toBe(1);
  });

  it("stores score data", () => {
    const dl = new DataLayer();
    const scores: DataPoint<number | null>[] = [
      { time: 1, value: 80 },
      { time: 2, value: 45 },
      { time: 3, value: 20 },
    ];
    dl.setScores(scores);
    expect(dl.scores.length).toBe(3);
  });

  it("marks dirty on all setters", () => {
    const dl = new DataLayer();
    dl.clearDirty();

    dl.setBacktestResult({});
    expect(dl.dirty).toBe(true);
    dl.clearDirty();

    dl.setPatterns([]);
    expect(dl.dirty).toBe(true);
    dl.clearDirty();

    dl.setScores([]);
    expect(dl.dirty).toBe(true);
  });
});
