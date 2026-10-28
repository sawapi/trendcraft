/**
 * Stress Testing Module
 *
 * Applies historical and synthetic stress scenarios to return series
 * to evaluate portfolio resilience under extreme market conditions.
 *
 * @packageDocumentation
 */

import {
  depthPercent,
  drawdownFromEquityCurve,
  maxDrawdownPercent,
} from "../backtest/drawdown-tracker";
import { type AnnualizationOptions, annualizationFactor } from "../calendar";
import type { DrawdownPeriod } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A shock to apply to returns */
export type ReturnShock =
  | { type: "absolute"; returns: number[] }
  | { type: "drawdown"; magnitude: number; days: number; recoveryDays: number }
  | { type: "volatilitySpike"; multiplier: number; days: number }
  | { type: "correlationBreakdown"; targetCorrelation: number };

/** Stress scenario definition */
export type StressScenario = {
  name: string;
  description: string;
  shocks: ReturnShock[];
};

/** Result of stress testing */
export type StressTestResult = {
  scenario: string;
  originalMetrics: {
    totalReturn: number;
    maxDrawdown: number;
    sharpe: number;
  };
  stressedMetrics: {
    totalReturn: number;
    maxDrawdown: number;
    sharpe: number;
  };
  worstCase: {
    /** Depth of the worst drawdown, as a fraction of its starting peak */
    drawdown: number;
    /**
     * Bars from the peak that started the worst drawdown to its trough. The
     * drawdown starts at the last bar at which equity stood at that peak,
     * whether it stayed there (a flat stretch) or came back to it exactly,
     * as in pyfolio.
     */
    duration: number;
    /**
     * Bars from that trough back to the drawdown's own starting peak. When the
     * curve never regains that level, this is the number of bars from the
     * trough to the end of the sample — a lower bound — and `recovered` is
     * false.
     */
    recoveryDays: number;
    /** Whether the worst drawdown regained its starting peak within the sample */
    recovered: boolean;
  };
  /** Probability capital stays above zero */
  survivalRate: number;
  /** Maximum loss under stress */
  capitalAtRisk: number;
  /** VaR under stress conditions */
  stressedVaR: number;
  /** CVaR under stress conditions */
  stressedCVaR: number;
};

/** Summary of all stress tests */
export type StressTestSummary = {
  results: StressTestResult[];
  worstScenario: string;
  overallSurvivalRate: number;
  maxStressedDrawdown: number;
};

// ---------------------------------------------------------------------------
// Preset Scenarios
// ---------------------------------------------------------------------------

/** Pre-configured stress scenarios based on historical market events */
export const PRESET_SCENARIOS: Record<string, StressScenario> = {
  lehman2008: {
    name: "Lehman Crisis 2008",
    description: "Global financial crisis: -38% over 6 months with slow recovery",
    shocks: [{ type: "drawdown", magnitude: 0.38, days: 126, recoveryDays: 756 }],
  },
  covidCrash2020: {
    name: "COVID Crash 2020",
    description: "Pandemic panic: -34% in 23 trading days, V-shaped recovery",
    shocks: [{ type: "drawdown", magnitude: 0.34, days: 23, recoveryDays: 100 }],
  },
  flashCrash2010: {
    name: "Flash Crash 2010",
    description: "Algorithmic cascade: -9% intraday, immediate recovery",
    shocks: [{ type: "drawdown", magnitude: 0.09, days: 1, recoveryDays: 1 }],
  },
  volmageddon2018: {
    name: "Volmageddon 2018",
    description: "VIX spike +115%: extreme volatility regime",
    shocks: [{ type: "volatilitySpike", multiplier: 3.0, days: 5 }],
  },
  blackMonday1987: {
    name: "Black Monday 1987",
    description: "Single-day crash: -22.6% in one day",
    shocks: [{ type: "drawdown", magnitude: 0.226, days: 1, recoveryDays: 400 }],
  },
  svbCrisis2023: {
    name: "SVB Crisis 2023",
    description: "Banking sector contagion: -10% with correlation breakdown",
    shocks: [
      { type: "drawdown", magnitude: 0.1, days: 5, recoveryDays: 30 },
      { type: "correlationBreakdown", targetCorrelation: 0.9 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple pseudo-random gaussian using Box-Muller (seeded via Math.random) */
function gaussianRandom(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Calculate standard deviation of an array of numbers */
function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Generate stressed returns by applying a shock to a base return series.
 *
 * @param baseReturns - Original daily return series
 * @param shock - Shock definition to apply
 * @returns Shocked return series
 *
 * @example
 * ```ts
 * const base = [0.01, -0.005, 0.008, 0.003, -0.002];
 * const shocked = generateShockedReturns(base, {
 *   type: "drawdown",
 *   magnitude: 0.10,
 *   days: 5,
 *   recoveryDays: 10,
 * });
 * ```
 */
export function generateShockedReturns(baseReturns: number[], shock: ReturnShock): number[] {
  switch (shock.type) {
    case "absolute": {
      return [...baseReturns, ...shock.returns];
    }

    case "drawdown": {
      const dailyLoss = -(shock.magnitude / shock.days);
      const dailyRecovery = shock.magnitude / shock.recoveryDays;

      const drawdownReturns: number[] = [];
      for (let i = 0; i < shock.days; i++) {
        drawdownReturns.push(dailyLoss);
      }
      for (let i = 0; i < shock.recoveryDays; i++) {
        drawdownReturns.push(dailyRecovery);
      }

      // Insert at a random point or append
      const insertIdx = Math.floor(Math.random() * (baseReturns.length + 1));
      const result = [...baseReturns];
      result.splice(insertIdx, 0, ...drawdownReturns);
      return result;
    }

    case "volatilitySpike": {
      const result = [...baseReturns];
      const startIdx = Math.max(0, result.length - shock.days);
      for (let i = startIdx; i < result.length; i++) {
        result[i] *= shock.multiplier;
      }
      return result;
    }

    case "correlationBreakdown": {
      const sd = stddev(baseReturns);
      const noiseScale = (1 - shock.targetCorrelation) * sd;
      return baseReturns.map((r) => r + gaussianRandom() * noiseScale);
    }
  }
}

/**
 * Calculate key portfolio metrics from a return series.
 *
 * @param returns - Daily return series
 * @returns Object with totalReturn, maxDrawdown, and annualised Sharpe ratio
 *
 * @example
 * ```ts
 * const metrics = calculateMetricsFromReturns([0.01, -0.005, 0.008]);
 * // metrics.totalReturn ≈ 0.01296
 * // metrics.sharpe ≈ annualised risk-adjusted return
 * ```
 */
export function calculateMetricsFromReturns(
  returns: number[],
  annualizationOpts: AnnualizationOptions = {},
): {
  totalReturn: number;
  maxDrawdown: number;
  sharpe: number;
} {
  const periodsPerYear = annualizationFactor(annualizationOpts);
  if (returns.length === 0) {
    return { totalReturn: 0, maxDrawdown: 0, sharpe: 0 };
  }

  // Compounded equity, starting at 1
  const curve = [1];
  for (const r of returns) curve.push(curve[curve.length - 1] * (1 + r));
  const maxDd = maxDrawdownPercent(curve) / 100;

  const totalReturn = curve[curve.length - 1] - 1;

  // Annualized Sharpe ratio
  const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
  const sd = stddev(returns);
  const sharpe = sd === 0 ? 0 : (mean / sd) * Math.sqrt(periodsPerYear);

  return { totalReturn, maxDrawdown: maxDd, sharpe };
}

/**
 * Run a stress test on a return series using a given scenario.
 *
 * Applies all shocks in the scenario sequentially, then computes
 * original vs stressed metrics, worst-case drawdown analysis,
 * survival rate, capital at risk, and stressed VaR/CVaR.
 *
 * @param returns - Daily return series
 * @param scenario - Stress scenario with one or more shocks
 * @param initialCapital - Starting capital (default: 100_000)
 * @returns Detailed stress test result
 *
 * @example
 * ```ts
 * import { stressTest, PRESET_SCENARIOS } from "trendcraft";
 *
 * const dailyReturns = [0.01, -0.005, 0.008, 0.003, -0.012];
 * const result = stressTest(dailyReturns, PRESET_SCENARIOS.covidCrash2020);
 * console.log(result.stressedMetrics.maxDrawdown);
 * ```
 */
export function stressTest(
  returns: number[],
  scenario: StressScenario,
  initialCapital = 100_000,
  annualizationOpts: AnnualizationOptions = {},
): StressTestResult {
  // Original metrics
  const originalMetrics = calculateMetricsFromReturns(returns, annualizationOpts);

  // Apply shocks sequentially
  let stressed = [...returns];
  for (const shock of scenario.shocks) {
    stressed = generateShockedReturns(stressed, shock);
  }

  // Stressed metrics
  const stressedMetrics = calculateMetricsFromReturns(stressed, annualizationOpts);

  // Build equity curve for worst-case analysis
  const equityCurve: number[] = [1];
  for (const r of stressed) {
    equityCurve.push(equityCurve[equityCurve.length - 1] * (1 + r));
  }

  // Worst-case drawdown from the shared tracker, the single owner of every
  // drawdown figure: recovery is measured against the drawdown's own starting
  // peak by construction. Bars are indexed by position.
  const { periods } = drawdownFromEquityCurve(
    equityCurve,
    equityCurve.map((_, i) => ({ time: i })),
  );
  let worst: DrawdownPeriod | undefined;
  let worstDd = 0;
  for (const p of periods) {
    // The period's maxDepthPercent is rounded; rank by the exact depth.
    const dd = depthPercent(p.peakEquity, p.troughEquity) / 100;
    if (dd > worstDd) {
      worstDd = dd;
      worst = p;
    }
  }

  const lastIdx = equityCurve.length - 1;
  const worstCase = worst
    ? {
        drawdown: worstDd,
        duration: worst.troughTime - worst.startTime,
        recoveryDays: (worst.recoveryTime ?? lastIdx) - worst.troughTime,
        recovered: worst.recoveryTime !== undefined,
      }
    : { drawdown: 0, duration: 0, recoveryDays: 0, recovered: true };

  // Survival rate: 1.0 if equity never goes below 0, 0.0 if it does
  const survivalRate = equityCurve.every((v) => v > 0) ? 1.0 : 0.0;

  // Capital at risk
  const capitalAtRisk = initialCapital * worstCase.drawdown;

  // Stressed VaR and CVaR at 95% confidence (historical method)
  const sorted = [...stressed].sort((a, b) => a - b);
  const varIdx = Math.floor(sorted.length * 0.05);
  const stressedVaR = -sorted[Math.max(varIdx, 0)];

  // CVaR = mean of returns at or below the VaR threshold. slice's end is
  // exclusive, so include index varIdx (the VaR observation itself) via
  // varIdx + 1 — matching calculateVaR's `<= threshold` convention. Using
  // `Math.max(varIdx, 1)` previously dropped the VaR observation from the tail.
  const tailReturns = sorted.slice(0, varIdx + 1);
  const stressedCVaR =
    tailReturns.length > 0
      ? -(tailReturns.reduce((s, v) => s + v, 0) / tailReturns.length)
      : stressedVaR;

  return {
    scenario: scenario.name,
    originalMetrics,
    stressedMetrics,
    worstCase,
    survivalRate,
    capitalAtRisk,
    stressedVaR,
    stressedCVaR,
  };
}

/**
 * Run stress tests against all preset scenarios.
 *
 * Iterates over every entry in {@link PRESET_SCENARIOS}, runs
 * {@link stressTest} for each, and produces a summary identifying
 * the worst scenario and overall survival rate.
 *
 * @param returns - Daily return series
 * @param initialCapital - Starting capital (default: 100_000)
 * @returns Summary with per-scenario results and aggregate stats
 *
 * @example
 * ```ts
 * import { runAllStressTests } from "trendcraft";
 *
 * const dailyReturns = Array.from({ length: 252 }, () => (Math.random() - 0.48) * 0.02);
 * const summary = runAllStressTests(dailyReturns);
 * console.log(`Worst scenario: ${summary.worstScenario}`);
 * console.log(`Max stressed drawdown: ${(summary.maxStressedDrawdown * 100).toFixed(1)}%`);
 * ```
 */
export function runAllStressTests(
  returns: number[],
  initialCapital = 100_000,
  annualizationOpts: AnnualizationOptions = {},
): StressTestSummary {
  const results: StressTestResult[] = [];

  for (const scenario of Object.values(PRESET_SCENARIOS)) {
    results.push(stressTest(returns, scenario, initialCapital, annualizationOpts));
  }

  // Find worst scenario by maxDrawdown
  let worstScenario = "";
  let maxStressedDrawdown = 0;

  for (const r of results) {
    if (r.stressedMetrics.maxDrawdown > maxStressedDrawdown) {
      maxStressedDrawdown = r.stressedMetrics.maxDrawdown;
      worstScenario = r.scenario;
    }
  }

  // Overall survival rate: proportion of scenarios that survive
  const overallSurvivalRate =
    results.length > 0 ? results.reduce((s, r) => s + r.survivalRate, 0) / results.length : 1.0;

  return {
    results,
    worstScenario,
    overallSurvivalRate,
    maxStressedDrawdown,
  };
}
