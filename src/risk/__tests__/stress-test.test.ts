import { describe, expect, it } from "vitest";
import {
  PRESET_SCENARIOS,
  calculateMetricsFromReturns,
  generateShockedReturns,
  runAllStressTests,
  stressTest,
} from "../stress-test";

// ---------------------------------------------------------------------------
// calculateMetricsFromReturns
// ---------------------------------------------------------------------------

describe("calculateMetricsFromReturns", () => {
  it("returns zeros for empty returns", () => {
    const m = calculateMetricsFromReturns([]);
    expect(m.totalReturn).toBe(0);
    expect(m.maxDrawdown).toBe(0);
    expect(m.sharpe).toBe(0);
  });

  it("computes compounded total return correctly", () => {
    // (1 + 0.1) * (1 + (-0.05)) - 1 = 1.1 * 0.95 - 1 = 0.045
    const m = calculateMetricsFromReturns([0.1, -0.05]);
    expect(m.totalReturn).toBeCloseTo(0.045, 10);
  });

  it("computes max drawdown correctly", () => {
    // equity: 1 -> 1.1 -> 0.88 -> 0.968
    // peak = 1.1, trough = 0.88, dd = (1.1-0.88)/1.1 = 0.2
    const m = calculateMetricsFromReturns([0.1, -0.2, 0.1]);
    expect(m.maxDrawdown).toBeCloseTo(0.2, 10);
  });

  it("sharpe is positive for mostly positive returns", () => {
    const m = calculateMetricsFromReturns([0.02, 0.01, 0.015, 0.005]);
    expect(m.sharpe).toBeGreaterThan(0);
  });

  it("sharpe is negative for mostly negative returns", () => {
    const m = calculateMetricsFromReturns([-0.02, -0.01, -0.015, -0.005]);
    expect(m.sharpe).toBeLessThan(0);
  });

  it("sharpe is 0 when all returns are identical (sd=0)", () => {
    const m = calculateMetricsFromReturns([0.01, 0.01, 0.01]);
    expect(m.sharpe).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateShockedReturns
// ---------------------------------------------------------------------------

describe("generateShockedReturns", () => {
  const base = [0.01, -0.005, 0.008, 0.003, -0.002];

  it("absolute shock appends the given returns", () => {
    const extra = [-0.05, -0.03];
    const result = generateShockedReturns(base, {
      type: "absolute",
      returns: extra,
    });
    expect(result.length).toBe(base.length + extra.length);
    // Last elements must be the extra returns
    expect(result.slice(-extra.length)).toEqual(extra);
  });

  it("drawdown shock increases length by days + recoveryDays", () => {
    const days = 10;
    const recoveryDays = 20;
    const result = generateShockedReturns(base, {
      type: "drawdown",
      magnitude: 0.2,
      days,
      recoveryDays,
    });
    expect(result.length).toBe(base.length + days + recoveryDays);
  });

  it("volatility spike multiplies the last N returns", () => {
    const multiplier = 3;
    const days = 2;
    const result = generateShockedReturns(base, {
      type: "volatilitySpike",
      multiplier,
      days,
    });
    expect(result.length).toBe(base.length);
    // Last `days` elements should be multiplied
    for (let i = 0; i < days; i++) {
      const origIdx = base.length - days + i;
      expect(result[origIdx]).toBeCloseTo(base[origIdx] * multiplier, 10);
    }
    // Earlier elements unchanged
    expect(result[0]).toBe(base[0]);
  });

  it("correlation breakdown with empty base returns", () => {
    const result = generateShockedReturns([], {
      type: "correlationBreakdown",
      targetCorrelation: 0.5,
    });
    expect(result).toHaveLength(0);
  });

  it("correlation breakdown keeps same length and adds noise", () => {
    const result = generateShockedReturns(base, {
      type: "correlationBreakdown",
      targetCorrelation: 0.5,
    });
    expect(result.length).toBe(base.length);
    // At least one value should differ due to noise (extremely unlikely all equal)
    const allSame = result.every((v, i) => v === base[i]);
    expect(allSame).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stressTest
// ---------------------------------------------------------------------------

describe("stressTest", () => {
  // Generate a moderate positive return series
  const returns = Array.from({ length: 100 }, (_, i) => (i % 3 === 0 ? 0.005 : -0.002));

  it("returns a valid StressTestResult structure", () => {
    const scenario = PRESET_SCENARIOS.flashCrash2010;
    const result = stressTest(returns, scenario);

    expect(result.scenario).toBe(scenario.name);
    expect(result.originalMetrics).toHaveProperty("totalReturn");
    expect(result.originalMetrics).toHaveProperty("maxDrawdown");
    expect(result.originalMetrics).toHaveProperty("sharpe");
    expect(result.stressedMetrics).toHaveProperty("totalReturn");
    expect(result.stressedMetrics).toHaveProperty("maxDrawdown");
    expect(result.stressedMetrics).toHaveProperty("sharpe");
    expect(result.worstCase).toHaveProperty("drawdown");
    expect(result.worstCase).toHaveProperty("duration");
    expect(result.worstCase).toHaveProperty("recoveryDays");
    expect(typeof result.survivalRate).toBe("number");
    expect(typeof result.capitalAtRisk).toBe("number");
    expect(typeof result.stressedVaR).toBe("number");
    expect(typeof result.stressedCVaR).toBe("number");
  });

  it("drawdown scenario increases max drawdown vs original", () => {
    const scenario = PRESET_SCENARIOS.lehman2008;
    const result = stressTest(returns, scenario);
    expect(result.stressedMetrics.maxDrawdown).toBeGreaterThanOrEqual(
      result.originalMetrics.maxDrawdown,
    );
  });

  it("survival rate is 0.0 when equity goes below zero", () => {
    // Returns that compound to negative equity: (1 + (-2)) = -1
    const extremeReturns = [-0.5, -0.5, -0.5, -0.5, -0.5]; // compounds to ~0.03
    const catastrophicScenario = {
      name: "Total wipeout",
      description: "Complete loss",
      shocks: [
        { type: "absolute" as const, returns: [-2.0] }, // -200% return → equity < 0
      ],
    };
    const result = stressTest(extremeReturns, catastrophicScenario);
    expect(result.survivalRate).toBe(0.0);
  });

  it("CVaR handles single-element tail", () => {
    // Very few returns → varIdx = 0, tailReturns may be length 1
    const shortReturns = [0.01, -0.01];
    const scenario = {
      name: "Short test",
      description: "Test with minimal returns",
      shocks: [{ type: "absolute" as const, returns: [-0.05] }],
    };
    const result = stressTest(shortReturns, scenario);
    expect(typeof result.stressedCVaR).toBe("number");
    expect(Number.isFinite(result.stressedCVaR)).toBe(true);
  });

  it("survival rate is 1.0 for a mild scenario with moderate returns", () => {
    // Mild custom scenario: tiny drawdown
    const mildScenario = {
      name: "Mild dip",
      description: "Small dip",
      shocks: [
        {
          type: "drawdown" as const,
          magnitude: 0.01,
          days: 2,
          recoveryDays: 2,
        },
      ],
    };
    const result = stressTest(returns, mildScenario);
    expect(result.survivalRate).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// runAllStressTests
// ---------------------------------------------------------------------------

describe("runAllStressTests", () => {
  const returns = Array.from({ length: 100 }, (_, i) => (i % 3 === 0 ? 0.005 : -0.002));

  it("returns results for all 6 preset scenarios", () => {
    const summary = runAllStressTests(returns);
    const presetCount = Object.keys(PRESET_SCENARIOS).length;
    expect(presetCount).toBe(6);
    expect(summary.results.length).toBe(presetCount);
  });

  it("has worstScenario field that matches one of the scenario names", () => {
    const summary = runAllStressTests(returns);
    const names = Object.values(PRESET_SCENARIOS).map((s) => s.name);
    expect(names).toContain(summary.worstScenario);
  });

  it("maxStressedDrawdown is the largest among all results", () => {
    const summary = runAllStressTests(returns);
    const maxDd = Math.max(...summary.results.map((r) => r.stressedMetrics.maxDrawdown));
    expect(summary.maxStressedDrawdown).toBeCloseTo(maxDd, 10);
  });

  it("overallSurvivalRate is between 0 and 1", () => {
    const summary = runAllStressTests(returns);
    expect(summary.overallSurvivalRate).toBeGreaterThanOrEqual(0);
    expect(summary.overallSurvivalRate).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// PRESET_SCENARIOS
// ---------------------------------------------------------------------------

describe("PRESET_SCENARIOS", () => {
  it("contains expected scenario keys", () => {
    const keys = Object.keys(PRESET_SCENARIOS);
    expect(keys).toContain("lehman2008");
    expect(keys).toContain("covidCrash2020");
    expect(keys).toContain("flashCrash2010");
    expect(keys).toContain("volmageddon2018");
    expect(keys).toContain("blackMonday1987");
    expect(keys).toContain("svbCrisis2023");
  });

  it("each scenario has name, description, and shocks", () => {
    for (const scenario of Object.values(PRESET_SCENARIOS)) {
      expect(typeof scenario.name).toBe("string");
      expect(typeof scenario.description).toBe("string");
      expect(Array.isArray(scenario.shocks)).toBe(true);
      expect(scenario.shocks.length).toBeGreaterThan(0);
    }
  });
});
