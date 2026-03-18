import { describe, it, expect } from "vitest";
import { calculateVaR, rollingVaR } from "../var";

describe("calculateVaR", () => {
  describe("historical method", () => {
    it("should calculate VaR from uniform-like returns", () => {
      // 100 returns from -0.10 to +0.10 (step 0.002)
      const returns: number[] = [];
      for (let i = 0; i < 100; i++) {
        returns.push(-0.10 + (i * 0.20) / 99);
      }
      // 5th percentile index = floor(0.05 * 100) = 5 => sorted[5]
      // sorted[5] = -0.10 + (5 * 0.20 / 99) ≈ -0.0899
      const result = calculateVaR(returns, {
        confidence: 0.95,
        method: "historical",
      });
      expect(result.var).toBeGreaterThan(0.08);
      expect(result.var).toBeLessThan(0.10);
      expect(result.method).toBe("historical");
      expect(result.confidence).toBe(0.95);
      expect(result.observations).toBe(100);
    });

    it("should calculate CVaR >= VaR", () => {
      const returns: number[] = [];
      for (let i = 0; i < 100; i++) {
        returns.push(-0.10 + (i * 0.20) / 99);
      }
      const result = calculateVaR(returns, {
        confidence: 0.95,
        method: "historical",
      });
      expect(result.cvar).toBeGreaterThanOrEqual(result.var);
    });

    it("should compute CVaR as average of tail losses", () => {
      // 20 returns from -0.10 to +0.09 (step 0.01)
      const returns: number[] = [];
      for (let i = 0; i < 20; i++) {
        returns.push(-0.10 + i * 0.01);
      }
      // sorted = [-0.10, -0.09, ..., 0.09]
      // At 90% confidence: index = round(0.1 * 20) = 2 => sorted[2] = -0.08
      // VaR = 0.08
      // Tail: sorted[0]=-0.10, sorted[1]=-0.09, sorted[2]=-0.08 => avg = -0.09 => CVaR = 0.09
      const result = calculateVaR(returns, {
        confidence: 0.90,
        method: "historical",
      });
      expect(result.var).toBeCloseTo(0.08, 6);
      expect(result.cvar).toBeCloseTo(0.09, 6);
    });

    it("should return near 0 VaR for all positive returns", () => {
      const returns = Array.from({ length: 50 }, (_, i) => 0.001 * (i + 1));
      const result = calculateVaR(returns, {
        confidence: 0.95,
        method: "historical",
      });
      // All returns are positive, so VaR = -returns[idx] is negative (or near zero)
      // Smallest return is 0.001, so VaR = -0.001 (loss is actually a gain)
      expect(result.var).toBeLessThanOrEqual(0);
    });
  });

  describe("parametric method", () => {
    it("should calculate VaR from normal-like returns", () => {
      // Use deterministic pseudo-normal data: mean=0.001, std~0.02
      const returns: number[] = [];
      const mu = 0.001;
      const sigma = 0.02;
      // Generate uniformly spaced quantiles to approximate normal
      for (let i = 1; i <= 100; i++) {
        // Simple deterministic values centered at mu with spread sigma
        const t = (i - 50.5) / 29; // range roughly -1.7 to +1.7
        returns.push(mu + sigma * t);
      }

      const result = calculateVaR(returns, {
        confidence: 0.95,
        method: "parametric",
      });

      // For parametric: VaR ≈ -(mu - 1.645 * sigma)
      const expectedMu = mean(returns);
      const expectedSigma = stdDevPop(returns, expectedMu);
      const expectedVaR = -(expectedMu - 1.6449 * expectedSigma);
      expect(result.var).toBeCloseTo(expectedVaR, 3);
      expect(result.method).toBe("parametric");
    });

    it("should have CVaR > VaR for parametric method", () => {
      const returns = Array.from({ length: 100 }, (_, i) => (i - 50) * 0.001);
      const result = calculateVaR(returns, {
        confidence: 0.95,
        method: "parametric",
      });
      expect(result.cvar).toBeGreaterThan(result.var);
    });
  });

  describe("cornishFisher method", () => {
    it("should produce different VaR than parametric for skewed data", () => {
      // Create right-skewed returns (more extreme negative values)
      const returns: number[] = [];
      for (let i = 0; i < 80; i++) {
        returns.push(0.001 + i * 0.0002);
      }
      // Add some negative outliers
      for (let i = 0; i < 20; i++) {
        returns.push(-0.05 - i * 0.005);
      }

      const parametric = calculateVaR(returns, {
        confidence: 0.95,
        method: "parametric",
      });
      const cf = calculateVaR(returns, {
        confidence: 0.95,
        method: "cornishFisher",
      });

      // Cornish-Fisher should adjust for the negative skew
      expect(cf.var).not.toBeCloseTo(parametric.var, 3);
      expect(cf.skewness).not.toBe(0);
      expect(cf.method).toBe("cornishFisher");
    });

    it("should converge to parametric for symmetric data", () => {
      // Symmetric data => skewness ≈ 0, kurtosis ≈ 0
      const returns: number[] = [];
      for (let i = 0; i < 100; i++) {
        const t = (i - 49.5) / 29;
        returns.push(t * 0.02);
      }
      const parametric = calculateVaR(returns, {
        confidence: 0.95,
        method: "parametric",
      });
      const cf = calculateVaR(returns, {
        confidence: 0.95,
        method: "cornishFisher",
      });

      // For approximately symmetric data, CF should be close to parametric
      expect(cf.var).toBeCloseTo(parametric.var, 2);
    });
  });

  describe("edge cases", () => {
    it("should handle empty returns", () => {
      const result = calculateVaR([], { confidence: 0.95 });
      expect(result.var).toBe(0);
      expect(result.cvar).toBe(0);
      expect(result.observations).toBe(0);
    });

    it("should handle single return", () => {
      const result = calculateVaR([-0.05], { confidence: 0.95 });
      expect(result.observations).toBe(1);
      expect(result.var).toBe(0.05);
    });

    it("should use defaults when no options provided", () => {
      const returns = Array.from({ length: 50 }, (_, i) => (i - 25) * 0.001);
      const result = calculateVaR(returns);
      expect(result.method).toBe("historical");
      expect(result.confidence).toBe(0.95);
    });
  });

  describe("distribution statistics", () => {
    it("should report skewness and kurtosis", () => {
      const returns: number[] = [];
      for (let i = 0; i < 100; i++) {
        returns.push((i - 49.5) * 0.001);
      }
      const result = calculateVaR(returns);
      // Uniform-like distribution: skewness ≈ 0, kurtosis ≈ -1.2 (platykurtic)
      expect(Math.abs(result.skewness)).toBeLessThan(0.1);
      expect(result.kurtosis).toBeLessThan(0);
    });
  });
});

describe("rollingVaR", () => {
  it("should return correct number of windows", () => {
    const returns = Array.from({ length: 100 }, (_, i) => (i - 50) * 0.001);
    const result = rollingVaR(returns, { window: 60 });
    expect(result.length).toBe(41); // 100 - 60 + 1
  });

  it("should return empty for insufficient data", () => {
    const returns = Array.from({ length: 10 }, (_, i) => i * 0.001);
    const result = rollingVaR(returns, { window: 60 });
    expect(result.length).toBe(0);
  });

  it("should have var and cvar in each entry", () => {
    const returns = Array.from({ length: 80 }, (_, i) => (i - 40) * 0.001);
    const result = rollingVaR(returns, { window: 30 });
    for (const entry of result) {
      expect(typeof entry.var).toBe("number");
      expect(typeof entry.cvar).toBe("number");
      expect(entry.cvar).toBeGreaterThanOrEqual(entry.var);
    }
  });

  it("should use default options", () => {
    const returns = Array.from({ length: 70 }, (_, i) => (i - 35) * 0.001);
    const result = rollingVaR(returns);
    // Default window=60 => 70 - 60 + 1 = 11
    expect(result.length).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// Local helpers for test validation
// ---------------------------------------------------------------------------

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDevPop(arr: number[], mu: number): number {
  const variance = arr.reduce((s, v) => s + (v - mu) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}
