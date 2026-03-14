import { describe, expect, it } from "vitest";
import type { CorrelationPoint } from "../../types/correlation";
import { analyzeCorrelation } from "../analysis";
import { detectIntermarketDivergence } from "../divergence";
import { analyzeLeadLag } from "../lead-lag";
import { detectCorrelationRegimes } from "../regime";
import { pearsonCorrelation, rollingCorrelation, spearmanRankCorrelation } from "../rolling";

/** Seeded pseudo-random number generator for reproducibility */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Generate correlated return series: rB = beta * rA + noise */
function generateCorrelatedReturns(
  n: number,
  beta: number,
  noiseScale: number,
  seed: number,
): { returnsA: number[]; returnsB: number[] } {
  const rng = seededRandom(seed);
  const returnsA: number[] = [];
  const returnsB: number[] = [];
  for (let i = 0; i < n; i++) {
    const rA = (rng() - 0.5) * 0.04;
    const noise = (rng() - 0.5) * noiseScale;
    returnsA.push(rA);
    returnsB.push(beta * rA + noise);
  }
  return { returnsA, returnsB };
}

/** Generate price series from returns */
function returnsToPrices(returns: number[], startPrice = 100): number[] {
  const prices: number[] = [startPrice];
  for (const r of returns) {
    prices.push(prices[prices.length - 1] * (1 + r));
  }
  return prices;
}

describe("pearsonCorrelation", () => {
  it("returns 1 for perfect positive correlation", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(1.0, 10);
  });

  it("returns -1 for perfect negative correlation", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(-1.0, 10);
  });

  it("returns near 0 for uncorrelated data", () => {
    // Orthogonal-ish data
    const x = [1, -1, 1, -1, 1, -1, 1, -1];
    const y = [1, 1, -1, -1, 1, 1, -1, -1];
    expect(Math.abs(pearsonCorrelation(x, y))).toBeLessThan(0.1);
  });

  it("returns 0 for fewer than 2 elements", () => {
    expect(pearsonCorrelation([1], [2])).toBe(0);
    expect(pearsonCorrelation([], [])).toBe(0);
  });

  it("returns 0 for constant series (zero variance)", () => {
    const x = [5, 5, 5, 5];
    const y = [1, 2, 3, 4];
    expect(pearsonCorrelation(x, y)).toBe(0);
  });
});

describe("spearmanRankCorrelation", () => {
  it("returns 1 for perfect positive monotonic relationship", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 20, 30, 40, 50];
    expect(spearmanRankCorrelation(x, y)).toBeCloseTo(1.0, 10);
  });

  it("returns 1 for any monotonically increasing relationship", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [1, 4, 9, 16, 25]; // y = x^2 (monotonic)
    expect(spearmanRankCorrelation(x, y)).toBeCloseTo(1.0, 10);
  });

  it("returns -1 for perfect negative monotonic relationship", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [50, 40, 30, 20, 10];
    expect(spearmanRankCorrelation(x, y)).toBeCloseTo(-1.0, 10);
  });
});

describe("rollingCorrelation", () => {
  it("produces correct number of points", () => {
    const n = 100;
    const window = 20;
    const { returnsA, returnsB } = generateCorrelatedReturns(n, 1, 0.001, 42);
    const times = Array.from({ length: n }, (_, i) => i);

    const result = rollingCorrelation(returnsA, returnsB, times, window);
    expect(result.length).toBe(n - window + 1);
  });

  it("shows high correlation for strongly correlated data", () => {
    const n = 200;
    const { returnsA, returnsB } = generateCorrelatedReturns(n, 1, 0.001, 123);
    const times = Array.from({ length: n }, (_, i) => i);

    const result = rollingCorrelation(returnsA, returnsB, times, 30);
    const avgPearson = result.reduce((s, p) => s + p.pearson, 0) / result.length;
    expect(avgPearson).toBeGreaterThan(0.8);
  });

  it("each point has both pearson and spearman fields", () => {
    const n = 50;
    const { returnsA, returnsB } = generateCorrelatedReturns(n, 1, 0.01, 99);
    const times = Array.from({ length: n }, (_, i) => i);

    const result = rollingCorrelation(returnsA, returnsB, times, 20);
    for (const p of result) {
      expect(typeof p.pearson).toBe("number");
      expect(typeof p.spearman).toBe("number");
      expect(p.pearson).toBeGreaterThanOrEqual(-1);
      expect(p.pearson).toBeLessThanOrEqual(1);
      expect(p.spearman).toBeGreaterThanOrEqual(-1);
      expect(p.spearman).toBeLessThanOrEqual(1);
    }
  });
});

describe("detectCorrelationRegimes", () => {
  it("classifies regimes correctly based on thresholds", () => {
    const series: CorrelationPoint[] = [
      { time: 1, pearson: 0.9, spearman: 0.9 },
      { time: 2, pearson: 0.5, spearman: 0.5 },
      { time: 3, pearson: 0.0, spearman: 0.0 },
      { time: 4, pearson: -0.5, spearman: -0.5 },
      { time: 5, pearson: -0.8, spearman: -0.8 },
    ];

    const regimes = detectCorrelationRegimes(series);
    expect(regimes[0].regime).toBe("strong_positive");
    expect(regimes[1].regime).toBe("positive");
    expect(regimes[2].regime).toBe("neutral");
    expect(regimes[3].regime).toBe("negative");
    expect(regimes[4].regime).toBe("strong_negative");
  });

  it("tracks regime duration correctly", () => {
    const series: CorrelationPoint[] = [
      { time: 1, pearson: 0.8, spearman: 0.8 },
      { time: 2, pearson: 0.9, spearman: 0.9 },
      { time: 3, pearson: 0.75, spearman: 0.75 },
      { time: 4, pearson: 0.1, spearman: 0.1 }, // regime change
      { time: 5, pearson: 0.0, spearman: 0.0 },
    ];

    const regimes = detectCorrelationRegimes(series);
    expect(regimes[0].regimeDuration).toBe(1);
    expect(regimes[1].regimeDuration).toBe(2);
    expect(regimes[2].regimeDuration).toBe(3);
    expect(regimes[3].regimeDuration).toBe(1); // reset
    expect(regimes[4].regimeDuration).toBe(2);
  });

  it("respects custom thresholds", () => {
    const series: CorrelationPoint[] = [{ time: 1, pearson: 0.6, spearman: 0.6 }];

    // Default: 0.6 is "positive" (below 0.7 strong_positive)
    const defaultRegimes = detectCorrelationRegimes(series);
    expect(defaultRegimes[0].regime).toBe("positive");

    // Custom: 0.6 is "strong_positive" with threshold 0.5
    const customRegimes = detectCorrelationRegimes(series, {
      regimeThresholds: { strongPositive: 0.5 },
    });
    expect(customRegimes[0].regime).toBe("strong_positive");
  });
});

describe("analyzeLeadLag", () => {
  it("detects A leading B with positive optimal lag", () => {
    const rng = seededRandom(42);
    const n = 300;
    const lag = 3;
    const returnsA: number[] = [];

    for (let i = 0; i < n; i++) {
      returnsA.push((rng() - 0.5) * 0.04);
    }

    // B follows A with a lag of 3
    const returnsB: number[] = new Array(n).fill(0);
    for (let i = lag; i < n; i++) {
      returnsB[i] = returnsA[i - lag] * 0.9 + (rng() - 0.5) * 0.002;
    }

    const result = analyzeLeadLag(returnsA, returnsB, { maxLag: 5 });
    expect(result.optimalLag).toBe(lag);
    expect(result.maxCorrelation).toBeGreaterThan(0.5);
    expect(result.assessment).toContain("Asset A leads");
  });

  it("returns lag 0 for contemporaneously correlated series", () => {
    const n = 200;
    const { returnsA, returnsB } = generateCorrelatedReturns(n, 1, 0.001, 77);

    const result = analyzeLeadLag(returnsA, returnsB, { maxLag: 5 });
    expect(result.optimalLag).toBe(0);
    expect(result.assessment).toContain("contemporaneously");
  });

  it("includes cross-correlation for all tested lags", () => {
    const n = 100;
    const { returnsA, returnsB } = generateCorrelatedReturns(n, 1, 0.01, 55);
    const maxLag = 5;

    const result = analyzeLeadLag(returnsA, returnsB, { maxLag });
    // Should have entries for lags from -maxLag to +maxLag
    expect(result.crossCorrelation.length).toBe(2 * maxLag + 1);
  });
});

describe("detectIntermarketDivergence", () => {
  it("detects known divergence when A trends up and B trends down", () => {
    const n = 200;
    const rng = seededRandom(42);
    const pricesA: number[] = [100];
    const pricesB: number[] = [100];
    const times: number[] = [0];

    // First 100 bars: move together
    for (let i = 1; i < 100; i++) {
      const move = (rng() - 0.5) * 2;
      pricesA.push(pricesA[i - 1] + move);
      pricesB.push(pricesB[i - 1] + move + (rng() - 0.5) * 0.5);
      times.push(i);
    }

    // Next 100 bars: diverge strongly
    for (let i = 100; i < n; i++) {
      pricesA.push(pricesA[i - 1] * 1.01); // A goes up 1% per bar
      pricesB.push(pricesB[i - 1] * 0.99); // B goes down 1% per bar
      times.push(i);
    }

    const divs = detectIntermarketDivergence(pricesA, pricesB, times, {
      divergenceLookback: 20,
      divergenceThreshold: 2.0,
    });

    expect(divs.length).toBeGreaterThan(0);
    // A outperforming => bearish divergence (mean reversion expected)
    const bearishDivs = divs.filter((d) => d.type === "bearish");
    expect(bearishDivs.length).toBeGreaterThan(0);
  });

  it("returns empty for co-moving series", () => {
    const n = 200;
    const rng = seededRandom(99);
    const pricesA: number[] = [100];
    const pricesB: number[] = [100];
    const times: number[] = [0];

    for (let i = 1; i < n; i++) {
      const move = (rng() - 0.5) * 2;
      pricesA.push(pricesA[i - 1] + move);
      pricesB.push(pricesB[i - 1] + move);
      times.push(i);
    }

    const divs = detectIntermarketDivergence(pricesA, pricesB, times, {
      divergenceLookback: 20,
      divergenceThreshold: 3.0, // high threshold
    });

    expect(divs.length).toBe(0);
  });
});

describe("analyzeCorrelation", () => {
  it("produces valid full analysis for correlated series", () => {
    const n = 250;
    const { returnsA, returnsB } = generateCorrelatedReturns(n, 0.8, 0.005, 42);
    const pricesA = returnsToPrices(returnsA);
    const pricesB = returnsToPrices(returnsB);

    const seriesA = pricesA.map((v, i) => ({ time: i, value: v }));
    const seriesB = pricesB.map((v, i) => ({ time: i, value: v }));

    const result = analyzeCorrelation(seriesA, seriesB, { window: 30 });

    // Rolling correlation produced
    expect(result.rollingCorrelation.length).toBeGreaterThan(0);

    // Regimes produced
    expect(result.regimes.length).toBe(result.rollingCorrelation.length);

    // Lead-lag produced
    expect(result.leadLag.crossCorrelation.length).toBeGreaterThan(0);

    // Summary is valid
    expect(result.summary.avgCorrelation).toBeGreaterThan(0);
    expect(result.summary.stability).toBeGreaterThanOrEqual(0);
    expect(result.summary.stability).toBeLessThanOrEqual(1);
    expect(typeof result.summary.currentRegime).toBe("string");
    expect(typeof result.summary.dominantRegime).toBe("string");
  });

  it("summary avgCorrelation is correct", () => {
    const n = 200;
    const { returnsA, returnsB } = generateCorrelatedReturns(n, 1, 0.001, 33);
    const pricesA = returnsToPrices(returnsA);
    const pricesB = returnsToPrices(returnsB);

    const seriesA = pricesA.map((v, i) => ({ time: i, value: v }));
    const seriesB = pricesB.map((v, i) => ({ time: i, value: v }));

    const result = analyzeCorrelation(seriesA, seriesB, { window: 30 });

    // Manually compute average from rolling correlation
    const manualAvg =
      result.rollingCorrelation.reduce((s, p) => s + p.pearson, 0) /
      result.rollingCorrelation.length;

    expect(result.summary.avgCorrelation).toBeCloseTo(manualAvg, 10);
  });

  it("dominant regime matches the most frequent regime", () => {
    const n = 200;
    const { returnsA, returnsB } = generateCorrelatedReturns(n, 1, 0.001, 55);
    const pricesA = returnsToPrices(returnsA);
    const pricesB = returnsToPrices(returnsB);

    const seriesA = pricesA.map((v, i) => ({ time: i, value: v }));
    const seriesB = pricesB.map((v, i) => ({ time: i, value: v }));

    const result = analyzeCorrelation(seriesA, seriesB, { window: 30 });

    // Count regimes manually
    const counts = new Map<string, number>();
    for (const r of result.regimes) {
      counts.set(r.regime, (counts.get(r.regime) ?? 0) + 1);
    }
    let maxCount = 0;
    let expectedDominant = "neutral";
    for (const [regime, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        expectedDominant = regime;
      }
    }

    expect(result.summary.dominantRegime).toBe(expectedDominant);
  });
});
