import { describe, expect, it } from "vitest";
import { ewmaVolatility, garch, nelderMead } from "../volatility/garch";

// Synthetic returns: first half low vol, second half high vol (volatility clustering)
const returns = Array.from({ length: 100 }, (_, i) => {
  const vol = i < 50 ? 0.01 : 0.03;
  return Math.sin(i * 0.5) * vol;
});

describe("garch", () => {
  it("returns degenerate result with < 3 returns", () => {
    const result = garch([0.01, -0.02]);
    expect(result.converged).toBe(false);
    expect(result.logLikelihood).toBe(Number.NEGATIVE_INFINITY);
    expect(result.conditionalVariance).toHaveLength(2);
    expect(result.params.alpha).toBe(0);
    expect(result.params.beta).toBe(0);
  });

  it("satisfies stationarity constraint alpha + beta < 1 with 50+ returns", () => {
    const result = garch(returns);
    expect(result.params.alpha + result.params.beta).toBeLessThan(1);
  });

  it("conditionalVariance length matches input length", () => {
    const result = garch(returns);
    expect(result.conditionalVariance).toHaveLength(returns.length);
  });

  it("volatilityForecast is a positive number", () => {
    const result = garch(returns);
    expect(result.volatilityForecast).toBeGreaterThan(0);
    expect(Number.isFinite(result.volatilityForecast)).toBe(true);
  });

  it("logLikelihood is finite", () => {
    const result = garch(returns);
    expect(Number.isFinite(result.logLikelihood)).toBe(true);
  });

  it("handles empty returns via sampleVariance", () => {
    const result = garch([]);
    expect(result.converged).toBe(false);
    expect(result.conditionalVariance).toHaveLength(0);
  });

  it("handles single return (< 3)", () => {
    const result = garch([0.05]);
    expect(result.converged).toBe(false);
    expect(result.conditionalVariance).toHaveLength(1);
  });

  it("handles zero-variance returns (all identical)", () => {
    // All zeros → unconditional variance = 0 → omega init = 0
    // Tests Nelder-Mead zero initial value branch (line 93: xi[i] !== 0 ? ...)
    const zeros = Array.from({ length: 20 }, () => 0);
    const result = garch(zeros);
    // Should not crash, params should be valid
    expect(result.params.omega).toBeGreaterThanOrEqual(0);
    expect(result.params.alpha).toBeGreaterThanOrEqual(0);
    expect(result.params.beta).toBeGreaterThanOrEqual(0);
    expect(result.conditionalVariance).toHaveLength(20);
  });

  it("handles very small returns close to numerical floor", () => {
    // Returns so tiny that sigma2 may approach 1e-20 floor
    const tiny = Array.from({ length: 30 }, () => 1e-15);
    const result = garch(tiny);
    expect(result.conditionalVariance).toHaveLength(30);
    expect(Number.isFinite(result.volatilityForecast)).toBe(true);
  });

  it("clamps parameters to valid range", () => {
    // Very noisy data that may produce edge-case parameters
    const noisy = Array.from({ length: 50 }, (_, i) => (i % 2 === 0 ? 0.15 : -0.15));
    const result = garch(noisy);
    // Params should be clamped to valid range
    expect(result.params.omega).toBeGreaterThan(0);
    expect(result.params.alpha).toBeGreaterThanOrEqual(0);
    expect(result.params.beta).toBeGreaterThanOrEqual(0);
    expect(result.params.alpha + result.params.beta).toBeLessThan(1);
  });

  it("works with maxIterations=1 (forces early stop, may not converge)", () => {
    const result = garch(returns, { maxIterations: 1 });
    // Should still return valid params (clamped)
    expect(result.params.omega).toBeGreaterThanOrEqual(0);
    expect(result.params.alpha + result.params.beta).toBeLessThan(1);
    expect(result.conditionalVariance).toHaveLength(returns.length);
  });

  it("alpha is non-trivial for synthetic GARCH-like returns with volatility clustering", () => {
    // Create returns with strong volatility clustering
    const clustered: number[] = [];
    for (let i = 0; i < 200; i++) {
      // Alternate between calm and volatile regimes
      const regime = Math.floor(i / 20) % 2;
      const vol = regime === 0 ? 0.005 : 0.04;
      clustered.push(Math.sin(i * 0.7) * vol);
    }
    const result = garch(clustered, { maxIterations: 200 });
    // Alpha should capture some of the ARCH effect
    expect(result.params.alpha).toBeGreaterThan(0.01);
  });
});

describe("ewmaVolatility", () => {
  it("returns empty series for empty returns", () => {
    const result = ewmaVolatility([]);
    expect(result).toHaveLength(0);
  });

  it("returns series with same length as input", () => {
    const result = ewmaVolatility(returns);
    expect(result).toHaveLength(returns.length);
  });

  it("all values are positive (volatility cannot be negative)", () => {
    const result = ewmaVolatility(returns);
    for (const point of result) {
      expect(point.value).toBeGreaterThan(0);
    }
  });

  it("uses default lambda = 0.94", () => {
    // Compare default output to explicit lambda=0.94 — should be identical
    const defaultResult = ewmaVolatility(returns);
    const explicitResult = ewmaVolatility(returns, { lambda: 0.94 });
    for (let i = 0; i < defaultResult.length; i++) {
      expect(defaultResult[i].value).toBe(explicitResult[i].value);
    }
  });

  it("higher lambda produces smoother output (less reactive to shocks)", () => {
    const highLambda = ewmaVolatility(returns, { lambda: 0.97 });
    const lowLambda = ewmaVolatility(returns, { lambda: 0.8 });

    // Compute standard deviation of the volatility series as a smoothness proxy
    const stdDev = (series: { value: number }[]) => {
      const vals = series.map((s) => s.value);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      return Math.sqrt(variance);
    };

    // Higher lambda → lower standard deviation of the vol series (smoother)
    expect(stdDev(highLambda)).toBeLessThan(stdDev(lowLambda));
  });

  it("handles constant returns (zero variance seed)", () => {
    const constant = Array.from({ length: 20 }, () => 0);
    const result = ewmaVolatility(constant);
    expect(result).toHaveLength(20);
    // All values should still be positive (fallback to 1e-10 seed)
    for (const point of result) {
      expect(point.value).toBeGreaterThanOrEqual(0);
    }
  });

  it("volatility increases after a large shock", () => {
    // Calm returns followed by a spike
    const calm = Array.from({ length: 30 }, () => 0.001);
    const shock = [...calm, 0.1]; // big shock at the end
    const result = ewmaVolatility(shock);

    const volBeforeShock = result[calm.length - 1].value;
    const volAfterShock = result[calm.length].value;

    expect(volAfterShock).toBeGreaterThan(volBeforeShock);
  });
});

// ---------------------------------------------------------------------------
// nelderMead (internal optimizer - direct tests for branch coverage)
// ---------------------------------------------------------------------------

describe("nelderMead", () => {
  it("uses default options when none provided", () => {
    // Minimize f(x) = x^2 starting from x=1 (simple enough for default 200 iters)
    const result = nelderMead((x) => x[0] ** 2, [1]);
    expect(Math.abs(result.x[0])).toBeLessThan(0.1);
  });

  it("respects explicit maxIter and tol", () => {
    const result = nelderMead((x) => x[0] ** 2, [5], { maxIter: 1, tol: 1e-20 });
    // With only 1 iteration, should not converge
    expect(result.converged).toBe(false);
  });

  it("handles initial values containing zero", () => {
    // One of the initial values is 0, tests the xi[i] !== 0 branch
    const result = nelderMead((x) => x[0] ** 2 + x[1] ** 2, [0, 3]);
    expect(result.x[0]).toBeCloseTo(0, 1);
    expect(result.x[1]).toBeCloseTo(0, 1);
  });

  it("triggers shrink operation on pathological function", () => {
    // Rosenbrock function is difficult for simplex and often triggers shrink
    const rosenbrock = (x: number[]) => 100 * (x[1] - x[0] ** 2) ** 2 + (1 - x[0]) ** 2;
    const result = nelderMead(rosenbrock, [-1, 1], { maxIter: 500, tol: 1e-10 });
    // Just verify it runs without error and produces a result
    expect(result.x).toHaveLength(2);
    expect(Number.isFinite(result.fx)).toBe(true);
  });
});
