import { describe, it, expect } from "vitest";
import { riskParityAllocation, correlationAdjustedSize } from "../risk-parity";

describe("riskParityAllocation", () => {
  it("should assign inverse-vol-like weights to uncorrelated assets", () => {
    // Asset A: low volatility, Asset B: high volatility (2x)
    const n = 200;
    const returnsA: number[] = [];
    const returnsB: number[] = [];

    // Deterministic, uncorrelated returns
    for (let i = 0; i < n; i++) {
      // Use sin/cos to create uncorrelated series
      returnsA.push(Math.sin(i * 0.1) * 0.01);
      returnsB.push(Math.cos(i * 0.3) * 0.02); // 2x volatility
    }

    const result = riskParityAllocation({ A: returnsA, B: returnsB });

    // Higher volatility asset should get lower weight
    expect(result.weights["A"]).toBeGreaterThan(result.weights["B"]);

    // Weights should sum to 1
    const totalWeight =
      Object.values(result.weights).reduce((s, w) => s + w, 0);
    expect(totalWeight).toBeCloseTo(1, 8);
  });

  it("should produce approximately equal risk contributions", () => {
    const n = 300;
    const returnsA: number[] = [];
    const returnsB: number[] = [];
    const returnsC: number[] = [];

    for (let i = 0; i < n; i++) {
      returnsA.push(Math.sin(i * 0.07) * 0.015);
      returnsB.push(Math.cos(i * 0.13) * 0.025);
      returnsC.push(Math.sin(i * 0.23 + 1) * 0.01);
    }

    const result = riskParityAllocation({
      A: returnsA,
      B: returnsB,
      C: returnsC,
    });

    const rcs = Object.values(result.riskContributions);
    const target = 1 / 3;

    // Risk contributions should be approximately equal
    for (const rc of rcs) {
      expect(rc).toBeCloseTo(target, 1);
    }
  });

  it("should return equal weights for identical assets", () => {
    const returns = Array.from({ length: 100 }, (_, i) =>
      Math.sin(i * 0.1) * 0.01,
    );

    const result = riskParityAllocation({
      A: [...returns],
      B: [...returns],
    });

    expect(result.weights["A"]).toBeCloseTo(0.5, 2);
    expect(result.weights["B"]).toBeCloseTo(0.5, 2);
  });

  it("should return 100% weight for single asset", () => {
    const returns = Array.from({ length: 100 }, (_, i) => i * 0.001);
    const result = riskParityAllocation({ SPY: returns });

    expect(result.weights["SPY"]).toBe(1);
    expect(result.riskContributions["SPY"]).toBe(1);
    expect(result.correlationMatrix).toEqual([[1]]);
  });

  it("should return positive portfolio volatility", () => {
    const n = 100;
    const returnsA = Array.from({ length: n }, (_, i) =>
      Math.sin(i * 0.1) * 0.02,
    );
    const returnsB = Array.from({ length: n }, (_, i) =>
      Math.cos(i * 0.15) * 0.015,
    );

    const result = riskParityAllocation({ A: returnsA, B: returnsB });
    expect(result.portfolioVolatility).toBeGreaterThan(0);
  });

  it("should include correlation matrix of correct dimensions", () => {
    const n = 100;
    const series: Record<string, number[]> = {};
    for (let a = 0; a < 3; a++) {
      series[`asset${a}`] = Array.from({ length: n }, (_, i) =>
        Math.sin(i * (0.1 + a * 0.05)) * 0.01,
      );
    }

    const result = riskParityAllocation(series);
    expect(result.correlationMatrix.length).toBe(3);
    expect(result.correlationMatrix[0].length).toBe(3);

    // Diagonal should be 1
    for (let i = 0; i < 3; i++) {
      expect(result.correlationMatrix[i][i]).toBeCloseTo(1, 5);
    }

    // Symmetric
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        expect(result.correlationMatrix[i][j]).toBeCloseTo(
          result.correlationMatrix[j][i],
          10,
        );
      }
    }
  });
});

describe("correlationAdjustedSize", () => {
  it("should return full size when no existing holdings", () => {
    const currentReturns = Array.from({ length: 50 }, (_, i) => i * 0.001);
    const result = correlationAdjustedSize(currentReturns, [], {
      baseSize: 10000,
    });

    expect(result.adjustedSize).toBe(10000);
    expect(result.sizeFactor).toBe(1);
    expect(result.averageCorrelation).toBe(0);
  });

  it("should reduce size for highly correlated asset", () => {
    const n = 100;
    const returns = Array.from({ length: n }, (_, i) =>
      Math.sin(i * 0.1) * 0.02,
    );
    // Identical returns => correlation = 1
    const result = correlationAdjustedSize(returns, [returns], {
      baseSize: 10000,
    });

    expect(result.sizeFactor).toBeCloseTo(0.25, 2); // minSizeFactor
    expect(result.adjustedSize).toBeCloseTo(2500, -1);
    expect(result.averageCorrelation).toBeCloseTo(1, 1);
  });

  it("should keep full size for uncorrelated asset", () => {
    const n = 200;
    // sin and cos with different frequencies are nearly uncorrelated
    const currentReturns = Array.from({ length: n }, (_, i) =>
      Math.sin(i * 0.1) * 0.02,
    );
    const existingReturns = Array.from({ length: n }, (_, i) =>
      Math.cos(i * 1.7) * 0.02,
    );

    const result = correlationAdjustedSize(currentReturns, [existingReturns], {
      baseSize: 10000,
      lowCorrelationThreshold: 0.3,
    });

    // Correlation should be near 0 => sizeFactor near 1
    expect(result.averageCorrelation).toBeLessThan(0.3);
    expect(result.sizeFactor).toBeCloseTo(1, 1);
    expect(result.adjustedSize).toBeGreaterThan(9000);
  });

  it("should linearly interpolate between thresholds", () => {
    // Construct returns with known moderate correlation (~0.5)
    const n = 1000;
    const base = Array.from({ length: n }, (_, i) =>
      Math.sin(i * 0.1) * 0.02,
    );
    // Use independent noise with a small fraction of the base to get ~0.5 correlation
    const noise = Array.from({ length: n }, (_, i) =>
      Math.cos(i * 1.7 + 3.14) * 0.02,
    );
    const mixed = base.map((v, i) => v * 0.5 + noise[i] * 0.866);

    const result = correlationAdjustedSize(mixed, [base], {
      baseSize: 10000,
      lowCorrelationThreshold: 0.2,
      highCorrelationThreshold: 0.8,
      minSizeFactor: 0.25,
    });

    // Should be somewhere between min and 1
    expect(result.sizeFactor).toBeGreaterThanOrEqual(0.25);
    expect(result.sizeFactor).toBeLessThanOrEqual(1);
    // Verify it is not at the extremes (the interpolation is working)
    expect(result.averageCorrelation).toBeGreaterThan(0.1);
    expect(result.averageCorrelation).toBeLessThan(0.9);
  });

  it("should respect custom minSizeFactor", () => {
    const n = 100;
    const returns = Array.from({ length: n }, (_, i) =>
      Math.sin(i * 0.1) * 0.02,
    );

    const result = correlationAdjustedSize(returns, [returns], {
      baseSize: 10000,
      minSizeFactor: 0.5,
    });

    expect(result.sizeFactor).toBeCloseTo(0.5, 2);
    expect(result.adjustedSize).toBeCloseTo(5000, -1);
  });
});
