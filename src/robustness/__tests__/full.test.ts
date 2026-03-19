import { afterEach, describe, expect, it, vi } from "vitest";
import { and } from "../../backtest/conditions/core";
import { deadCross, goldenCross } from "../../backtest/conditions/ma-cross";
import { runBacktest } from "../../backtest/engine";
import type { BacktestResult, NormalizedCandle, Trade } from "../../types";
import type { RobustnessGrade } from "../../types/robustness";
import { calculateRobustnessScore } from "../full";

/** Generate synthetic candle data with trend and noise */
function generateCandles(n: number, seed: number): NormalizedCandle[] {
  let s = seed | 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const candles: NormalizedCandle[] = [];
  let price = 100;

  for (let i = 0; i < n; i++) {
    // Trend + noise: small upward bias with oscillation
    const change = (rng() - 0.48) * 3;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + rng() * 2;
    const low = Math.min(open, close) - rng() * 2;

    candles.push({
      time: 1700000000000 + i * 86400000,
      open,
      high,
      low,
      close: Math.max(close, 1), // prevent negative prices
      volume: 1000 + rng() * 5000,
    });

    price = Math.max(close, 1);
  }

  return candles;
}

function mockTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    entryTime: Date.now(),
    entryPrice: 100,
    exitTime: Date.now() + 86400000,
    exitPrice: 105,
    return: 500,
    returnPercent: 5,
    holdingDays: 1,
    ...overrides,
  };
}

function mockBacktestResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  return {
    initialCapital: 100000,
    finalCapital: 120000,
    totalReturn: 20000,
    totalReturnPercent: 20,
    tradeCount: 20,
    winRate: 60,
    maxDrawdown: 10,
    sharpeRatio: 1.5,
    profitFactor: 1.8,
    avgHoldingDays: 5,
    trades: [],
    settings: {
      fillMode: "next-bar-open",
      slTpMode: "close-only",
      slippage: 0,
      commission: 0,
      commissionRate: 0,
      taxRate: 0,
    },
    drawdownPeriods: [],
    ...overrides,
  };
}

describe("calculateRobustnessScore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns valid structure with all dimensions", () => {
    const candles = generateCandles(200, 42);

    // Simple strategy factory
    const createStrategy = (params: Record<string, number>) => ({
      entry: and(goldenCross(params.shortMA, params.longMA)),
      exit: and(deadCross(params.shortMA, params.longMA)),
      options: { capital: 100000 as const },
    });

    const paramRanges = [
      { name: "shortMA", min: 3, max: 7, step: 2 },
      { name: "longMA", min: 15, max: 25, step: 5 },
    ];

    // Run original backtest
    const original = runBacktest(candles, and(goldenCross(5, 20)), and(deadCross(5, 20)), {
      capital: 100000,
    });

    const result = calculateRobustnessScore(candles, original, createStrategy, paramRanges, {
      monteCarloSimulations: 10,
      walkForwardWindowSize: 80,
      walkForwardStepSize: 40,
      walkForwardTestSize: 30,
      seed: 42,
    });

    // Structure checks
    expect(result).toHaveProperty("compositeScore");
    expect(result).toHaveProperty("grade");
    expect(result).toHaveProperty("dimensions");
    expect(result).toHaveProperty("assessment");
    expect(result).toHaveProperty("recommendations");

    expect(result.dimensions).toHaveProperty("monteCarlo");
    expect(result.dimensions).toHaveProperty("parameterSensitivity");
    expect(result.dimensions).toHaveProperty("walkForward");
    expect(result.dimensions).toHaveProperty("regimeConsistency");

    // Score range
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);

    // Grade is valid
    const validGrades: RobustnessGrade[] = ["A+", "A", "B+", "B", "C+", "C", "D", "F"];
    expect(validGrades).toContain(result.grade);

    // Dimension scores in range
    for (const dim of Object.values(result.dimensions)) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
      expect(typeof dim.name).toBe("string");
      expect(typeof dim.detail).toBe("string");
    }

    // Recommendations are non-empty strings
    expect(result.recommendations.length).toBeGreaterThan(0);
    for (const rec of result.recommendations) {
      expect(typeof rec).toBe("string");
      expect(rec.length).toBeGreaterThan(0);
    }
  });

  it("calls progress callback", () => {
    const candles = generateCandles(200, 99);

    const createStrategy = (params: Record<string, number>) => ({
      entry: and(goldenCross(params.shortMA, params.longMA)),
      exit: and(deadCross(params.shortMA, params.longMA)),
      options: { capital: 100000 as const },
    });

    const paramRanges = [
      { name: "shortMA", min: 3, max: 7, step: 2 },
      { name: "longMA", min: 15, max: 25, step: 5 },
    ];

    const original = runBacktest(candles, and(goldenCross(5, 20)), and(deadCross(5, 20)), {
      capital: 100000,
    });

    const progressCalls: Array<{ phase: string; pct: number }> = [];

    calculateRobustnessScore(candles, original, createStrategy, paramRanges, {
      monteCarloSimulations: 10,
      walkForwardWindowSize: 80,
      walkForwardStepSize: 40,
      walkForwardTestSize: 30,
      seed: 42,
      progressCallback: (phase, pct) => {
        progressCalls.push({ phase, pct });
      },
    });

    // Should have progress calls for each dimension (start + end)
    expect(progressCalls.length).toBeGreaterThanOrEqual(4);
    const phases = progressCalls.map((c) => c.phase);
    expect(phases).toContain("Monte Carlo");
    expect(phases).toContain("Parameter Sensitivity");
    expect(phases).toContain("Walk-Forward");
    expect(phases).toContain("Regime Consistency");
  });

  it("handles too few trades (< 5 for MC, < 10 for regime)", () => {
    const candles = generateCandles(200, 77);

    const createStrategy = (params: Record<string, number>) => ({
      entry: and(goldenCross(params.shortMA, params.longMA)),
      exit: and(deadCross(params.shortMA, params.longMA)),
      options: { capital: 100000 as const },
    });

    const paramRanges = [
      { name: "shortMA", min: 3, max: 7, step: 2 },
      { name: "longMA", min: 15, max: 25, step: 5 },
    ];

    // Mock result with only 3 trades → triggers "Too few trades" in MC and regime
    const trades = Array.from({ length: 3 }, (_, i) =>
      mockTrade({ returnPercent: i % 2 === 0 ? 3 : -2 }),
    );
    const original = mockBacktestResult({
      trades,
      tradeCount: 3,
    });

    const result = calculateRobustnessScore(candles, original, createStrategy, paramRanges, {
      monteCarloSimulations: 10,
      walkForwardWindowSize: 80,
      walkForwardStepSize: 40,
      walkForwardTestSize: 30,
      seed: 42,
    });

    expect(result.dimensions.monteCarlo.score).toBe(0);
    expect(result.dimensions.monteCarlo.detail).toContain("Too few trades");
    expect(result.dimensions.regimeConsistency.score).toBe(50);
    expect(result.dimensions.regimeConsistency.detail).toContain("Too few trades");
  });

  it("covers all assessment score ranges", () => {
    const candles = generateCandles(200, 55);

    const createStrategy = (params: Record<string, number>) => ({
      entry: and(goldenCross(params.shortMA, params.longMA)),
      exit: and(deadCross(params.shortMA, params.longMA)),
      options: { capital: 100000 as const },
    });

    const paramRanges = [
      { name: "shortMA", min: 3, max: 7, step: 2 },
      { name: "longMA", min: 15, max: 25, step: 5 },
    ];

    const original = runBacktest(candles, and(goldenCross(5, 20)), and(deadCross(5, 20)), {
      capital: 100000,
    });

    const result = calculateRobustnessScore(candles, original, createStrategy, paramRanges, {
      monteCarloSimulations: 10,
      walkForwardWindowSize: 80,
      walkForwardStepSize: 40,
      walkForwardTestSize: 30,
      seed: 42,
    });

    // Assessment should contain the grade
    expect(result.assessment).toContain(result.grade);
    // Assessment should be a non-empty string
    expect(result.assessment.length).toBeGreaterThan(0);
  });

  it("handles regime consistency with both-halves-profitable false branch", () => {
    const candles = generateCandles(200, 33);

    const createStrategy = (params: Record<string, number>) => ({
      entry: and(goldenCross(params.shortMA, params.longMA)),
      exit: and(deadCross(params.shortMA, params.longMA)),
      options: { capital: 100000 as const },
    });

    const paramRanges = [
      { name: "shortMA", min: 3, max: 7, step: 2 },
      { name: "longMA", min: 15, max: 25, step: 5 },
    ];

    // First half profitable, second half not → bothProfitable = false
    const trades = [
      ...Array.from({ length: 10 }, () => mockTrade({ returnPercent: 5 })),
      ...Array.from({ length: 10 }, () => mockTrade({ returnPercent: -5 })),
    ];

    const original = mockBacktestResult({
      trades,
      tradeCount: 20,
      winRate: 50,
      profitFactor: 1.0,
      totalReturnPercent: 0,
      maxDrawdown: 25,
    });

    const result = calculateRobustnessScore(candles, original, createStrategy, paramRanges, {
      monteCarloSimulations: 10,
      walkForwardWindowSize: 80,
      walkForwardStepSize: 40,
      walkForwardTestSize: 30,
      seed: 42,
    });

    // Regime consistency should be lower due to inconsistent halves
    expect(result.dimensions.regimeConsistency.score).toBeDefined();
    expect(result.dimensions.regimeConsistency.detail).toContain("WinRate");
  });

  it("custom weights are normalized", () => {
    const candles = generateCandles(200, 11);

    const createStrategy = (params: Record<string, number>) => ({
      entry: and(goldenCross(params.shortMA, params.longMA)),
      exit: and(deadCross(params.shortMA, params.longMA)),
      options: { capital: 100000 as const },
    });

    const paramRanges = [
      { name: "shortMA", min: 3, max: 7, step: 2 },
      { name: "longMA", min: 15, max: 25, step: 5 },
    ];

    const original = runBacktest(candles, and(goldenCross(5, 20)), and(deadCross(5, 20)), {
      capital: 100000,
    });

    const result = calculateRobustnessScore(candles, original, createStrategy, paramRanges, {
      monteCarloSimulations: 10,
      walkForwardWindowSize: 80,
      walkForwardStepSize: 40,
      walkForwardTestSize: 30,
      seed: 42,
      weights: {
        monteCarlo: 1,
        parameterSensitivity: 0,
        walkForward: 0,
        regimeConsistency: 0,
      },
    });

    // With all weight on MC, composite should equal MC score
    expect(result.compositeScore).toBeCloseTo(result.dimensions.monteCarlo.score, 0);
  });

  it("falls back to equal weights when all custom weights are zero", () => {
    const candles = generateCandles(200, 21);
    const neverCondition = {
      type: "preset" as const,
      name: "never",
      evaluate: () => false,
    };
    const createStrategy = () => ({
      entry: neverCondition,
      exit: neverCondition,
      options: { capital: 100000 as const },
    });

    const original = mockBacktestResult({
      trades: Array.from({ length: 20 }, (_, i) =>
        mockTrade({ returnPercent: i % 2 === 0 ? 3 : -1 }),
      ),
      tradeCount: 20,
    });

    const result = calculateRobustnessScore(candles, original, createStrategy, [], {
      monteCarloSimulations: 10,
      walkForwardWindowSize: 80,
      walkForwardStepSize: 40,
      walkForwardTestSize: 30,
      weights: {
        monteCarlo: 0,
        parameterSensitivity: 0,
        walkForward: 0,
        regimeConsistency: 0,
      },
    });

    expect(result.compositeScore).not.toBeNaN();
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
  });

  it("does not skip integer parameter neighborhoods during sensitivity analysis", () => {
    const candles = generateCandles(200, 42);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const createStrategy = (params: Record<string, number>) => ({
      entry: and(goldenCross(params.shortMA, params.longMA)),
      exit: and(deadCross(params.shortMA, params.longMA)),
      options: { capital: 100000 as const },
    });

    const paramRanges = [
      { name: "shortMA", min: 3, max: 7, step: 2 },
      { name: "longMA", min: 15, max: 25, step: 5 },
    ];

    const original = runBacktest(candles, and(goldenCross(5, 20)), and(deadCross(5, 20)), {
      capital: 100000,
    });

    calculateRobustnessScore(candles, original, createStrategy, paramRanges, {
      monteCarloSimulations: 10,
      walkForwardWindowSize: 80,
      walkForwardStepSize: 40,
      walkForwardTestSize: 30,
      seed: 42,
    });

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Skipping parameters {"shortMA":4.6,"longMA":19}'),
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
