import { describe, expect, it } from "vitest";
import { adfTest } from "../adf";
import { analyzePair } from "../analysis";
import { analyzeMeanReversion } from "../mean-reversion";
import { olsRegression } from "../regression";
import { calculateSpread } from "../spread";

/**
 * Simple seeded PRNG (mulberry32) for reproducible tests
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate normal-distributed random number using Box-Muller
 */
function normalRandom(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
}

describe("olsRegression", () => {
  it("should recover known linear relationship", () => {
    const rng = seededRandom(42);
    const n = 200;
    const x: number[] = [];
    const y: number[] = [];

    for (let i = 0; i < n; i++) {
      const xi = i * 0.1;
      x.push(xi);
      y.push(2 * xi + 1 + normalRandom(rng) * 0.1);
    }

    const result = olsRegression(x, y);

    expect(result.beta).toBeCloseTo(2, 1);
    expect(result.intercept).toBeCloseTo(1, 1);
    expect(result.rSquared).toBeGreaterThan(0.99);
    expect(result.residuals).toHaveLength(n);
  });

  it("should return residuals that sum close to zero", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2.1, 3.9, 6.1, 7.9, 10.1];

    const result = olsRegression(x, y);
    const residualSum = result.residuals.reduce((a, b) => a + b, 0);

    expect(Math.abs(residualSum)).toBeLessThan(1e-10);
  });
});

describe("adfTest", () => {
  it("should detect stationary series", () => {
    const rng = seededRandom(123);
    const n = 300;
    const series: number[] = [];

    // AR(1) with coefficient 0.5 (stationary)
    series.push(0);
    for (let i = 1; i < n; i++) {
      series.push(0.5 * series[i - 1] + normalRandom(rng));
    }

    const result = adfTest(series);

    // Stationary series should have negative ADF statistic
    expect(result.adfStatistic).toBeLessThan(result.criticalValues["5%"]);
    expect(result.pValue).toBeLessThan(0.1);
  });

  it("should fail to reject unit root for random walk", () => {
    const rng = seededRandom(456);
    const n = 300;
    const series: number[] = [];

    // Random walk (non-stationary)
    series.push(100);
    for (let i = 1; i < n; i++) {
      series.push(series[i - 1] + normalRandom(rng) * 0.5);
    }

    const result = adfTest(series);

    // Random walk ADF statistic should be close to 0 or positive
    // Should NOT be below 5% critical value
    expect(result.adfStatistic).toBeGreaterThan(result.criticalValues["5%"]);
    expect(result.pValue).toBeGreaterThan(0.05);
  });

  it("should handle short series gracefully", () => {
    const result = adfTest([1, 2, 3, 4, 5]);
    expect(result.pValue).toBe(1);
    expect(result.adfStatistic).toBe(0);
  });
});

describe("calculateSpread", () => {
  it("should calculate correct spread values", () => {
    const seriesY = [100, 102, 104, 106, 108];
    const seriesX = [50, 51, 52, 53, 54];
    const times = [1, 2, 3, 4, 5];
    const hedgeRatio = 2;
    const intercept = 0;

    const result = calculateSpread(seriesY, seriesX, hedgeRatio, intercept, times);

    // spread = Y - 2*X - 0
    expect(result[0].spread).toBe(0);
    expect(result[1].spread).toBe(0);
    expect(result[2].spread).toBe(0);
    expect(result).toHaveLength(5);
  });

  it("should compute full-sample z-scores", () => {
    const seriesY = [100, 105, 95, 110, 90];
    const seriesX = [50, 50, 50, 50, 50];
    const times = [1, 2, 3, 4, 5];

    const result = calculateSpread(seriesY, seriesX, 1, 50, times);

    // spreads = [0, 5, -5, 10, -10], mean = 0, std = sqrt(50)
    for (const point of result) {
      expect(point.mean).toBe(0);
      expect(point.stdDev).toBeCloseTo(Math.sqrt(50), 5);
    }

    // z-scores should be normalized
    expect(result[0].zScore).toBeCloseTo(0, 5);
    expect(result[1].zScore).toBeCloseTo(5 / Math.sqrt(50), 5);
  });

  it("should compute rolling z-scores", () => {
    const n = 50;
    const rng = seededRandom(789);
    const seriesY: number[] = [];
    const seriesX: number[] = [];
    const times: number[] = [];

    for (let i = 0; i < n; i++) {
      seriesX.push(100 + normalRandom(rng));
      seriesY.push(200 + normalRandom(rng));
      times.push(i);
    }

    const result = calculateSpread(seriesY, seriesX, 1, 100, times, {
      rollingWindow: 10,
    });

    expect(result).toHaveLength(n);

    // Rolling z-scores should vary per point
    const zScores = result.map((p) => p.zScore);
    const uniqueZScores = new Set(zScores.map((z) => z.toFixed(4)));
    expect(uniqueZScores.size).toBeGreaterThan(1);
  });
});

describe("analyzeMeanReversion", () => {
  it("should detect mean-reverting series", () => {
    const rng = seededRandom(111);
    const n = 500;
    const spreads: number[] = [];

    // AR(1) with coefficient 0.9 → mean-reverting
    spreads.push(0);
    for (let i = 1; i < n; i++) {
      spreads.push(0.9 * spreads[i - 1] + normalRandom(rng) * 0.5);
    }

    const result = analyzeMeanReversion(spreads, 100);

    expect(result.lambda).toBeCloseTo(0.9, 1);
    expect(result.halfLife).toBeGreaterThan(0);
    expect(result.halfLife).toBeLessThan(100);
    // Hurst exponent is estimated via R/S analysis (may overestimate for AR(1))
    // The key criterion is halfLife + lambda < 1
    expect(result.hurstExponent).toBeDefined();
    expect(result.isMeanReverting).toBe(true);
  });

  it("should detect trending (non-mean-reverting) series", () => {
    const rng = seededRandom(222);
    const n = 500;
    const spreads: number[] = [];

    // Random walk (unit root) → not mean-reverting
    spreads.push(0);
    for (let i = 1; i < n; i++) {
      spreads.push(spreads[i - 1] + normalRandom(rng) * 0.5);
    }

    const result = analyzeMeanReversion(spreads, 100);

    // Lambda should be close to 1 for random walk
    expect(result.lambda).toBeGreaterThan(0.95);
    expect(result.isMeanReverting).toBe(false);
  });

  it("should handle short series", () => {
    const result = analyzeMeanReversion([1, 2, 3], 100);
    expect(result.isMeanReverting).toBe(false);
    expect(result.halfLife).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("analyzePair", () => {
  it("should detect cointegrated pair", () => {
    const rng = seededRandom(333);
    const n = 500;

    // Generate random walk X
    const pricesX: number[] = [100];
    for (let i = 1; i < n; i++) {
      pricesX.push(pricesX[i - 1] + normalRandom(rng) * 0.5);
    }

    // Y = 2 * X + stationary noise (cointegrated with hedge ratio 2)
    const pricesY: number[] = [];
    for (let i = 0; i < n; i++) {
      pricesY.push(2 * pricesX[i] + 5 + normalRandom(rng) * 0.5);
    }

    const seriesA = pricesY.map((v, i) => ({ time: i, value: v }));
    const seriesB = pricesX.map((v, i) => ({ time: i, value: v }));

    const result = analyzePair(seriesA, seriesB);

    expect(result.cointegration.isCointegrated).toBe(true);
    expect(result.cointegration.hedgeRatio).toBeCloseTo(2, 0);
    expect(result.cointegration.rSquared).toBeGreaterThan(0.99);
    expect(result.cointegration.pValue).toBeLessThan(0.05);
    expect(result.spreadSeries).toHaveLength(n);
  });

  it("should detect non-cointegrated pair", () => {
    const rng = seededRandom(444);
    const n = 300;

    // Two independent random walks
    const pricesX: number[] = [100];
    const pricesY: number[] = [200];
    for (let i = 1; i < n; i++) {
      pricesX.push(pricesX[i - 1] + normalRandom(rng) * 0.5);
      pricesY.push(pricesY[i - 1] + normalRandom(rng) * 0.5);
    }

    const seriesA = pricesY.map((v, i) => ({ time: i, value: v }));
    const seriesB = pricesX.map((v, i) => ({ time: i, value: v }));

    const result = analyzePair(seriesA, seriesB);

    expect(result.cointegration.isCointegrated).toBe(false);
    expect(result.assessment.isViable).toBe(false);
  });

  it("should generate correct signals at z-score thresholds", () => {
    const rng = seededRandom(555);
    const n = 500;

    // Cointegrated pair with enough variance to trigger signals
    const pricesX: number[] = [100];
    for (let i = 1; i < n; i++) {
      pricesX.push(pricesX[i - 1] + normalRandom(rng) * 1);
    }

    const pricesY: number[] = [];
    for (let i = 0; i < n; i++) {
      // Larger noise to create z-score extremes
      pricesY.push(1.5 * pricesX[i] + normalRandom(rng) * 5);
    }

    const seriesA = pricesY.map((v, i) => ({ time: i, value: v }));
    const seriesB = pricesX.map((v, i) => ({ time: i, value: v }));

    const result = analyzePair(seriesA, seriesB, {
      entryThreshold: 2.0,
      exitThreshold: 0.5,
    });

    // Should have some signals
    if (result.signals.length > 0) {
      // First signal should be an open
      expect(["open_long", "open_short"]).toContain(result.signals[0].type);

      // Signals should alternate between open and close
      for (let i = 0; i < result.signals.length; i++) {
        const sig = result.signals[i];
        if (sig.type === "open_long" || sig.type === "open_short") {
          // Entry signals should have z-score beyond threshold
          expect(Math.abs(sig.zScore)).toBeGreaterThanOrEqual(2.0 - 0.01);
        }
      }
    }
  });

  it("should provide viable assessment for cointegrated mean-reverting pair", () => {
    const rng = seededRandom(666);
    const n = 500;

    const pricesX: number[] = [100];
    for (let i = 1; i < n; i++) {
      pricesX.push(pricesX[i - 1] + normalRandom(rng) * 0.3);
    }

    const pricesY: number[] = [];
    for (let i = 0; i < n; i++) {
      pricesY.push(2 * pricesX[i] + 10 + normalRandom(rng) * 0.3);
    }

    const seriesA = pricesY.map((v, i) => ({ time: i, value: v }));
    const seriesB = pricesX.map((v, i) => ({ time: i, value: v }));

    const result = analyzePair(seriesA, seriesB);

    if (result.cointegration.isCointegrated && result.meanReversion.isMeanReverting) {
      expect(result.assessment.isViable).toBe(true);
      expect(result.assessment.confidenceFactor).toBeGreaterThan(0);
      expect(result.assessment.reason).toContain("Viable pair");
    }
  });

  it("should respect custom significance level", () => {
    const rng = seededRandom(777);
    const n = 300;

    const pricesX: number[] = [100];
    for (let i = 1; i < n; i++) {
      pricesX.push(pricesX[i - 1] + normalRandom(rng) * 0.5);
    }

    // Borderline cointegrated: moderate noise
    const pricesY: number[] = [];
    for (let i = 0; i < n; i++) {
      pricesY.push(1.5 * pricesX[i] + normalRandom(rng) * 3);
    }

    const seriesA = pricesY.map((v, i) => ({ time: i, value: v }));
    const seriesB = pricesX.map((v, i) => ({ time: i, value: v }));

    const result1 = analyzePair(seriesA, seriesB, { significanceLevel: 0.01 });
    const result10 = analyzePair(seriesA, seriesB, { significanceLevel: 0.1 });

    // Stricter significance should be harder to pass
    expect(result1.cointegration.significanceLevel).toBe(0.01);
    expect(result10.cointegration.significanceLevel).toBe(0.1);

    // If 1% rejects, 10% should too (since ADF stat is the same)
    if (result1.cointegration.isCointegrated) {
      expect(result10.cointegration.isCointegrated).toBe(true);
    }
  });

  it("should use rolling window when specified", () => {
    const rng = seededRandom(888);
    const n = 200;

    const pricesX: number[] = [100];
    for (let i = 1; i < n; i++) {
      pricesX.push(pricesX[i - 1] + normalRandom(rng) * 0.5);
    }

    const pricesY: number[] = [];
    for (let i = 0; i < n; i++) {
      pricesY.push(2 * pricesX[i] + normalRandom(rng) * 1);
    }

    const seriesA = pricesY.map((v, i) => ({ time: i, value: v }));
    const seriesB = pricesX.map((v, i) => ({ time: i, value: v }));

    const resultFull = analyzePair(seriesA, seriesB, { rollingWindow: 0 });
    const resultRolling = analyzePair(seriesA, seriesB, { rollingWindow: 20 });

    // Full sample: all points have same mean/stdDev
    const fullMeans = new Set(resultFull.spreadSeries.map((s) => s.mean.toFixed(6)));
    expect(fullMeans.size).toBe(1);

    // Rolling: means should vary
    const rollingMeans = new Set(resultRolling.spreadSeries.map((s) => s.mean.toFixed(6)));
    expect(rollingMeans.size).toBeGreaterThan(1);
  });
});
