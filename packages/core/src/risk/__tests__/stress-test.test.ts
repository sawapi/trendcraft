import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../core/random";
import {
  calculateMetricsFromReturns,
  generateShockedReturns,
  PRESET_SCENARIOS,
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

  it("CVaR averages the worst (varIdx + 1) returns, including the VaR observation", () => {
    // No-shock scenario → stressed === returns, so the tail is fully
    // deterministic. 20 returns → varIdx = floor(20 * 0.05) = 1, so the 95% CVaR
    // is the mean of the two worst returns (indices 0 and 1). The earlier
    // off-by-one (slice(0, max(varIdx,1)) → only index 0) dropped the VaR
    // observation and averaged just the single worst return.
    const tail = [-0.1, -0.08];
    const det = [...tail, ...Array.from({ length: 18 }, () => 0.01)];
    const noShock = { name: "No shock", description: "identity", shocks: [] };
    const result = stressTest(det, noShock);

    // VaR observation is the 2nd-worst (index varIdx = 1) → 0.08.
    expect(result.stressedVaR).toBeCloseTo(0.08, 10);
    // CVaR = -mean(-0.1, -0.08) = 0.09 (worst two), NOT 0.10 (worst one only).
    expect(result.stressedCVaR).toBeCloseTo(0.09, 10);
    // Expected shortfall is at least as deep as VaR.
    expect(result.stressedCVaR).toBeGreaterThanOrEqual(result.stressedVaR);
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

// ---------------------------------------------------------------------------
// worstCase recovery
//
// The drawdown scan reuses its running `peak`, which by the end of the loop is
// the maximum of the whole stressed curve. The recovery loop compared against
// that instead of against the peak the worst drawdown started from, so as soon
// as the curve recovered and went on to make new highs it reported the time to
// a new all-time high.
// ---------------------------------------------------------------------------

const NO_SHOCK = { name: "none", description: "no shocks", shocks: [] };

describe("stressTest worstCase recovery", () => {
  it("measures recovery to the drawdown's own peak, not to a later all-time high", () => {
    // 1.0 -> 0.5 (trough at index 1) -> 1.0 at index 2, then 30 bars of +10%
    // taking the curve to ~17.45.
    const returns = [-0.5, 1.0, ...new Array(30).fill(0.1)];

    const result = stressTest(returns, NO_SHOCK);

    // The case is only interesting because the curve makes new highs after the
    // drawdown is over, so the drawdown's own peak and the curve's maximum are
    // far apart. Assert that before asserting the recovery time.
    const curve = [1];
    for (const r of returns) curve.push(curve[curve.length - 1] * (1 + r));
    expect(curve[1]).toBeCloseTo(0.5, 12); // trough
    expect(curve[2]).toBeCloseTo(1, 12); // back to the drawdown's peak of 1.0
    expect(Math.max(...curve)).toBeGreaterThan(17); // and far beyond it later

    expect(result.worstCase.drawdown).toBeCloseTo(0.5, 12);
    // Was 31: the loop waited for equity >= 17.45.
    expect(result.worstCase.recoveryDays).toBe(1);
    expect(result.worstCase.recovered).toBe(true);
  });

  it("distinguishes a curve that never recovers from one that recovers on the last bar", () => {
    const never = stressTest([-0.5, 0.1, 0.1], NO_SHOCK);
    const onLastBar = stressTest([-0.5, 1.0], NO_SHOCK);

    // Both used to report only a bar count, with nothing to tell them apart.
    expect(never.worstCase.recovered).toBe(false);
    expect(never.worstCase.recoveryDays).toBe(2); // trough to end of sample

    expect(onLastBar.worstCase.recovered).toBe(true);
    expect(onLastBar.worstCase.recoveryDays).toBe(1);
  });

  it("reports no recovery time for a curve that never draws down", () => {
    const result = stressTest(new Array(20).fill(0.01), NO_SHOCK);

    expect(result.worstCase.drawdown).toBe(0);
    expect(result.worstCase.recoveryDays).toBe(0);
    expect(result.worstCase.recovered).toBe(true);
  });

  it("does not grow recoveryDays as more post-recovery bars are appended", () => {
    const rnd = mulberry32(2718);
    let recoveredCases = 0;
    let unrecoveredCases = 0;
    const runs = 200;

    for (let run = 0; run < runs; run++) {
      const base = Array.from({ length: 40 }, () => (rnd() - 0.5) * 0.3);
      const baseline = stressTest(base, NO_SHOCK).worstCase;

      // Appending bars that only rise can never deepen the worst drawdown, so
      // every field of worstCase must stay put. Under the old code each extra
      // rising bar pushed the all-time high further away and inflated
      // recoveryDays for curves that had already recovered.
      for (const extra of [1, 5, 20]) {
        const extended = stressTest([...base, ...new Array(extra).fill(0.05)], NO_SHOCK).worstCase;
        expect(extended.drawdown).toBeCloseTo(baseline.drawdown, 12);
        expect(extended.duration).toBe(baseline.duration);
        if (baseline.recovered) {
          expect(extended.recovered).toBe(true);
          expect(extended.recoveryDays).toBe(baseline.recoveryDays);
        }
      }

      if (baseline.recovered) recoveredCases++;
      else unrecoveredCases++;
    }

    // The invariant is vacuous for curves that never recovered, so require both
    // populations to appear.
    expect(recoveredCases).toBeGreaterThan(0);
    expect(unrecoveredCases).toBeGreaterThan(0);
    expect(recoveredCases + unrecoveredCases).toBe(runs);
  });

  it("never reports more recovery bars than exist after the trough", () => {
    const rnd = mulberry32(31415);
    for (let run = 0; run < 200; run++) {
      const returns = Array.from({ length: 60 }, () => (rnd() - 0.5) * 0.4);
      const { worstCase } = stressTest(returns, NO_SHOCK);
      const barsAfterTrough = returns.length - (worstCase.duration + 1) + 1;
      expect(worstCase.recoveryDays).toBeGreaterThanOrEqual(0);
      expect(worstCase.recoveryDays).toBeLessThanOrEqual(barsAfterTrough);
    }
  });
});

describe("stressTest worstCase on degenerate curves", () => {
  it("reports an unrecovered drawdown when the trough is the last bar", () => {
    const { worstCase } = stressTest([-0.2], NO_SHOCK);
    // recoveryDays 0 used to be indistinguishable from an instant recovery.
    expect(worstCase.drawdown).toBeCloseTo(0.2, 12);
    expect(worstCase.recoveryDays).toBe(0);
    expect(worstCase.recovered).toBe(false);
  });

  it("handles an empty return series", () => {
    const { worstCase } = stressTest([], NO_SHOCK);
    expect(worstCase).toEqual({ drawdown: 0, duration: 0, recoveryDays: 0, recovered: true });
  });

  it("handles a curve that is wiped out", () => {
    expect(stressTest([-1, 0.5], NO_SHOCK).worstCase.recovered).toBe(false);
    // Equity below zero: the drawdown exceeds 100% and never recovers.
    const below = stressTest([-1.5, 0.5], NO_SHOCK).worstCase;
    expect(below.drawdown).toBeGreaterThan(1);
    expect(below.recovered).toBe(false);
  });
});
