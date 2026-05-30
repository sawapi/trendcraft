import { describe, expect, it } from "vitest";
import type {
  GridSearchResult,
  MonteCarloResult,
  OptimizationResultEntry,
  WalkForwardResult,
} from "../../types/optimization";
import {
  buildGenomeSegments,
  computeDnaGrade,
  computeRecommendedParams,
  extractSensitivityData,
} from "../strategy-dna";

// ── Fixtures ──────────────────────────────────────────────────────

const makeEntry = (
  params: Record<string, number>,
  score: number,
  trades = 5,
): OptimizationResultEntry => ({
  params,
  score,
  metrics: {
    sharpe: score,
    returns: score * 10,
    profitFactor: score,
    winRate: score * 5,
    maxDrawdown: -score / 2,
    calmar: score,
    recoveryFactor: score,
  },
  // Backtest field is required for OptimizationResultEntry but DNA
  // analytics only read params + metrics + score, so a minimal stub is
  // fine here. Tests that need real backtest data construct it inline.
  backtest: {
    initialCapital: 100_000,
    finalCapital: 100_000 + score * 1000,
    trades: Array.from({ length: trades }, (_, i) => ({
      side: "long",
      entryTime: i,
      entryPrice: 100,
      exitTime: i + 1,
      exitPrice: 100 + i,
      pnl: i,
      pnlPercent: i / 100,
      reason: "exit",
      barsHeld: 1,
    })),
    settings: { capital: 100_000 },
    equityCurve: [],
  } as unknown as OptimizationResultEntry["backtest"],
  passedConstraints: true,
});

const baseGridResult: GridSearchResult = {
  bestParams: { fast: 5, slow: 25 },
  bestScore: 1.5,
  metric: "sharpe",
  totalCombinations: 12,
  validCombinations: 12,
  results: [
    makeEntry({ fast: 5, slow: 25 }, 1.5),
    makeEntry({ fast: 5, slow: 30 }, 1.4),
    makeEntry({ fast: 7, slow: 25 }, 1.3),
    makeEntry({ fast: 7, slow: 30 }, 1.2),
    makeEntry({ fast: 9, slow: 25 }, 1.0),
    makeEntry({ fast: 9, slow: 30 }, 0.9),
    makeEntry({ fast: 5, slow: 35 }, 0.8),
    makeEntry({ fast: 7, slow: 35 }, 0.7),
    makeEntry({ fast: 9, slow: 35 }, 0.6),
    makeEntry({ fast: 5, slow: 40 }, 0.5),
    makeEntry({ fast: 7, slow: 40 }, 0.3),
    makeEntry({ fast: 9, slow: 40 }, 0.1),
  ],
};

// ── buildGenomeSegments ───────────────────────────────────────────

describe("buildGenomeSegments", () => {
  it("normalizes values to [0, 1] within their declared range", () => {
    const segments = buildGenomeSegments(
      { fast: 7, slow: 30 },
      [
        { name: "fast", min: 5, max: 15 },
        { name: "slow", min: 20, max: 50 },
      ],
      1.0,
    );
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ name: "fast", value: 7, position: 0.2 });
    expect(segments[1]).toMatchObject({
      name: "slow",
      value: 30,
      position: (30 - 20) / (50 - 20),
    });
  });

  it("clamps position to [0, 1] for out-of-range values", () => {
    const segments = buildGenomeSegments({ fast: 100 }, [{ name: "fast", min: 5, max: 10 }], 1.0);
    expect(segments[0].position).toBe(1);
  });

  it("collapses to position=0.5 when range is zero (min === max)", () => {
    const segments = buildGenomeSegments({ fast: 7 }, [{ name: "fast", min: 7, max: 7 }], 1.0);
    expect(segments[0].position).toBe(0.5);
  });

  it("filters out params not in bestParams", () => {
    const segments = buildGenomeSegments(
      { fast: 5 },
      [
        { name: "fast", min: 1, max: 10 },
        { name: "slow", min: 10, max: 50 },
      ],
      1.0,
    );
    expect(segments).toHaveLength(1);
    expect(segments[0].name).toBe("fast");
  });

  it("returns [] for an empty paramRanges array", () => {
    expect(buildGenomeSegments({ fast: 5 }, [], 1.0)).toEqual([]);
  });
});

// ── extractSensitivityData ────────────────────────────────────────

describe("extractSensitivityData", () => {
  it("returns empty data for empty results", () => {
    const out = extractSensitivityData([], "sharpe");
    expect(out.singleParams).toEqual([]);
    expect(out.pairwise).toEqual([]);
    expect(out.safeZones).toEqual([]);
  });

  it("aggregates single-parameter sensitivity by averaging metrics", () => {
    // fast=5 appears in entries with sharpe 1.5, 1.4, 0.8, 0.5 — average = 1.05
    const out = extractSensitivityData(baseGridResult.results, "sharpe");
    const fast = out.singleParams.find((sp) => sp.paramName === "fast");
    expect(fast).toBeDefined();
    const fast5 = fast?.data.find((d) => d.value === 5);
    expect(fast5?.metric).toBeCloseTo((1.5 + 1.4 + 0.8 + 0.5) / 4, 5);
  });

  it("emits pairwise data for every param pair (combinatorially)", () => {
    const out = extractSensitivityData(baseGridResult.results, "sharpe");
    expect(out.pairwise).toHaveLength(1); // fast × slow = 1 pair
    const pair = out.pairwise[0];
    expect(pair.paramX).toBe("fast");
    expect(pair.paramY).toBe("slow");
    expect(pair.xValues).toEqual([5, 7, 9]);
    expect(pair.yValues).toEqual([25, 30, 35, 40]);
  });

  it("treats `maxDrawdown` as a minimizing metric for safe zones (regression)", () => {
    // trendcraft reports `maxDrawdown` as a positive percentage (1 = 1%
    // drawdown, 20 = 20% drawdown), so smaller = better. Top 25% must
    // be the smallest drawdowns, not the largest.
    const results: OptimizationResultEntry[] = [
      makeEntry({ p: 1 }, 0),
      makeEntry({ p: 2 }, 0),
      makeEntry({ p: 3 }, 0),
      makeEntry({ p: 4 }, 0),
    ];
    results[0].metrics.maxDrawdown = 1;
    results[1].metrics.maxDrawdown = 2;
    results[2].metrics.maxDrawdown = 10;
    results[3].metrics.maxDrawdown = 20;
    const out = extractSensitivityData(results, "maxDrawdown");
    const zone = out.safeZones.find((z) => z.paramName === "p");
    // Top 25% (1 entry) = p=1 (drawdown 1%, the best).
    expect(zone).toEqual({ paramName: "p", min: 1, max: 1 });
  });

  it("safe zones cover the top-25% range for each param", () => {
    const out = extractSensitivityData(baseGridResult.results, "sharpe");
    // top 25% of 12 entries = 3 entries with highest sharpe = 1.5, 1.4, 1.3
    // → fast values (5, 5, 7) → range [5, 7]
    // → slow values (25, 30, 25) → range [25, 30]
    const fastZone = out.safeZones.find((z) => z.paramName === "fast");
    const slowZone = out.safeZones.find((z) => z.paramName === "slow");
    expect(fastZone).toEqual({ paramName: "fast", min: 5, max: 7 });
    expect(slowZone).toEqual({ paramName: "slow", min: 25, max: 30 });
  });
});

// ── computeRecommendedParams ──────────────────────────────────────

describe("computeRecommendedParams", () => {
  it("uses safe-zone median for params and tags Safe Zone center as a source", () => {
    const rec = computeRecommendedParams(baseGridResult);
    // Top 25% (3 entries) for `fast` = [5, 5, 7] → median 5
    // Top 25% (3 entries) for `slow` = [25, 25, 30] → median 25
    expect(rec.params).toEqual({ fast: 5, slow: 25 });
    expect(rec.sources).toContain("Safe Zone center");
  });

  it("falls back to results[0].params when bestParams is null (PR-A2 contract)", () => {
    const rec = computeRecommendedParams({ ...baseGridResult, bestParams: null });
    // Should still produce a recommendation based on the explored grid
    expect(Object.keys(rec.params)).toEqual(expect.arrayContaining(["fast", "slow"]));
  });

  it("overrides safe-zone median with WF-stable period median when available", () => {
    const wf: WalkForwardResult = {
      periods: [
        {
          trainStart: 0,
          trainEnd: 50,
          testStart: 50,
          testEnd: 100,
          bestParams: { fast: 9, slow: 35 },
          inSampleMetrics: {
            sharpe: 1.5,
            returns: 15,
            profitFactor: 1.5,
            winRate: 60,
            maxDrawdown: -5,
            calmar: 1.5,
            recoveryFactor: 1.5,
          },
          outOfSampleMetrics: {
            sharpe: 1.0,
            returns: 10, // > 0 → stable
            profitFactor: 1.2,
            winRate: 55,
            maxDrawdown: -8,
            calmar: 1.0,
            recoveryFactor: 1.0,
          },
          testBacktest: {} as never,
        },
      ],
      aggregateMetrics: {
        avgInSample: {} as never,
        avgOutOfSample: {} as never,
        stabilityRatio: 0.7,
      },
      recommendation: { useOptimizedParams: true, suggestedParams: {}, reason: "" },
    };
    const rec = computeRecommendedParams(baseGridResult, wf);
    // WF stable period had fast=9, slow=35 → median override
    expect(rec.params).toEqual({ fast: 9, slow: 35 });
    expect(rec.sources.some((s) => s.includes("stable WF"))).toBe(true);
  });

  it("recomputes ranges from WF stable periods when the override applies (regression)", () => {
    // WF override picks fast=9 (outside the top-25% safe zone of 5..7).
    // Without recomputing `ranges`, the viewer would show fast=9 with
    // range (5..7), which is internally inconsistent.
    const wf: WalkForwardResult = {
      periods: [
        {
          trainStart: 0,
          trainEnd: 50,
          testStart: 50,
          testEnd: 100,
          bestParams: { fast: 9, slow: 35 },
          inSampleMetrics: {} as never,
          outOfSampleMetrics: { returns: 5 } as never,
          testBacktest: {} as never,
        },
      ],
      aggregateMetrics: {
        avgInSample: {} as never,
        avgOutOfSample: {} as never,
        stabilityRatio: 0.6,
      },
      recommendation: { useOptimizedParams: true, suggestedParams: {}, reason: "" },
    };
    const rec = computeRecommendedParams(baseGridResult, wf);
    expect(rec.params.fast).toBe(9);
    expect(rec.ranges.fast.min).toBe(9);
    expect(rec.ranges.fast.max).toBe(9);
    expect(rec.ranges.slow.min).toBe(35);
    expect(rec.ranges.slow.max).toBe(35);
  });

  it("treats `maxDrawdown` as a minimizing metric in recommendations (regression)", () => {
    // Mirror of the safe-zone test. Recommendations must surface
    // p=1 (drawdown 1%) — not p=4 with the worst drawdown.
    const results: OptimizationResultEntry[] = [
      makeEntry({ p: 1 }, 0),
      makeEntry({ p: 2 }, 0),
      makeEntry({ p: 3 }, 0),
      makeEntry({ p: 4 }, 0),
    ];
    results[0].metrics.maxDrawdown = 1;
    results[1].metrics.maxDrawdown = 2;
    results[2].metrics.maxDrawdown = 10;
    results[3].metrics.maxDrawdown = 20;
    const grid: GridSearchResult = {
      bestParams: { p: 1 },
      bestScore: 1,
      metric: "maxDrawdown",
      totalCombinations: 4,
      validCombinations: 4,
      results,
    };
    const rec = computeRecommendedParams(grid);
    expect(rec.params.p).toBe(1);
  });

  it("snaps recommended values to an explored candidate (no 7.5 for integer params; regression)", () => {
    // Top-25% bucket with an even number of candidates would otherwise
    // produce a linearly-interpolated median like 7.5 — that re-enters
    // the next optimization run as a fractional value the strategy
    // never saw on an integer-only param. The recommendation must
    // always be one of the actually-explored values.
    const evenCountGrid: GridSearchResult = {
      bestParams: { period: 7 },
      bestScore: 1.5,
      metric: "sharpe",
      totalCombinations: 8,
      validCombinations: 8,
      results: [
        makeEntry({ period: 5 }, 1.6),
        makeEntry({ period: 6 }, 1.5),
        makeEntry({ period: 7 }, 1.4),
        makeEntry({ period: 8 }, 1.3),
        makeEntry({ period: 9 }, 1.2),
        makeEntry({ period: 10 }, 1.1),
        makeEntry({ period: 11 }, 1.0),
        makeEntry({ period: 12 }, 0.9),
      ],
    };
    // Top 25% of 8 = 2 entries → period values [5, 6] → linear median 5.5
    // Without snapping, recommended period = 5.5 (invalid integer).
    // With snapping, must round to either 5 or 6 (both explored).
    const rec = computeRecommendedParams(evenCountGrid);
    expect([5, 6]).toContain(rec.params.period);
    expect(Number.isInteger(rec.params.period)).toBe(true);
  });

  it("returns an empty recommendation for a 0-result grid (regression)", () => {
    // An empty results[] should not silently produce a `Safe Zone center` source
    // — no data means no recommendation.
    const empty: GridSearchResult = {
      bestParams: null,
      bestScore: null,
      metric: "sharpe",
      totalCombinations: 0,
      validCombinations: 0,
      results: [],
    };
    const rec = computeRecommendedParams(empty);
    expect(rec.params).toEqual({});
    expect(rec.ranges).toEqual({});
    expect(rec.sources).toEqual([]);
    expect(rec.confidence).toBe("low");
  });

  it("detects sharp peaks for minimize metrics like maxDrawdown (regression)", () => {
    // Drawdown at rec=2 with neighbors at 10 → rise ratio (10-2)/2 = 4 > 0.5
    // → confidence should be downgraded for minimize-direction sensitivity peaks
    // (not just maximize ones).
    const grid: GridSearchResult = {
      bestParams: { p: 5 },
      bestScore: 2,
      metric: "maxDrawdown",
      totalCombinations: 3,
      validCombinations: 3,
      results: [makeEntry({ p: 3 }, 0), makeEntry({ p: 5 }, 0), makeEntry({ p: 7 }, 0)],
    };
    grid.results[0].metrics.maxDrawdown = 10;
    grid.results[1].metrics.maxDrawdown = 2; // peak (best)
    grid.results[2].metrics.maxDrawdown = 10;
    const sensitivity = {
      singleParams: [
        {
          paramName: "p",
          data: [
            { value: 3, metric: 10 },
            { value: 5, metric: 2 },
            { value: 7, metric: 10 },
          ],
        },
      ],
      pairwise: [],
      safeZones: [],
    };
    const rec = computeRecommendedParams(grid, null, sensitivity);
    expect(rec.confidence).toBe("low");
    expect(rec.reason).toMatch(/sharp/i);
  });

  it("flags `confidence: low` when sensitivity shows a sharp peak", () => {
    // Construct a sensitivity dataset where the recommended value sits
    // on a peak that drops > 50% to its neighbors.
    const sensitivity = {
      singleParams: [
        {
          paramName: "fast",
          data: [
            { value: 3, metric: 0.1 },
            { value: 5, metric: 1.5 }, // peak
            { value: 7, metric: 0.2 },
          ],
        },
      ],
      pairwise: [],
      safeZones: [],
    };
    const rec = computeRecommendedParams(baseGridResult, null, sensitivity);
    expect(rec.confidence).toBe("low");
    expect(rec.reason).toMatch(/sharp/i);
  });
});

// ── computeDnaGrade ───────────────────────────────────────────────

describe("computeDnaGrade", () => {
  const wfStable: WalkForwardResult = {
    periods: [
      {
        trainStart: 0,
        trainEnd: 50,
        testStart: 50,
        testEnd: 100,
        bestParams: {},
        inSampleMetrics: {} as never,
        outOfSampleMetrics: { winRate: 60 } as never,
        testBacktest: {} as never,
      },
      {
        trainStart: 50,
        trainEnd: 100,
        testStart: 100,
        testEnd: 150,
        bestParams: {},
        inSampleMetrics: {} as never,
        outOfSampleMetrics: { winRate: 62 } as never,
        testBacktest: {} as never,
      },
    ],
    aggregateMetrics: {
      avgInSample: {} as never,
      avgOutOfSample: {} as never,
      stabilityRatio: 0.85, // → A
    },
    recommendation: { useOptimizedParams: true, suggestedParams: {}, reason: "" },
  };

  const mc = {
    downside: { probProfit: 0.995, probLoss: 0.005, riskOfRuin: 0.005, ruinThreshold: 50 },
  } as unknown as MonteCarloResult;

  it("returns overall='F' with all items unavailable when no inputs are provided", () => {
    const out = computeDnaGrade(null, null, null);
    expect(out.overall).toBe("F");
    expect(out.overallScore).toBe(0);
    expect(out.items.every((it) => !it.available)).toBe(true);
  });

  it("includes WF stability when walkForward is provided", () => {
    const out = computeDnaGrade(null, wfStable, null);
    const wfItem = out.items.find((it) => it.label === "Walk-Forward Stability");
    expect(wfItem?.available).toBe(true);
    expect(wfItem?.grade).toBe("A");
  });

  it("includes MC robustness when monteCarlo is provided", () => {
    const out = computeDnaGrade(null, null, mc);
    const mcItem = out.items.find((it) => it.label === "Monte Carlo Robustness");
    expect(mcItem?.available).toBe(true);
    expect(mcItem?.grade).toBe("A");
  });

  it("computes parameter sensitivity from grid search results when available", () => {
    const out = computeDnaGrade(baseGridResult, null, null);
    const psItem = out.items.find((it) => it.label === "Parameter Sensitivity");
    expect(psItem?.available).toBe(true);
  });

  it("renormalizes the weighted overall by available items", () => {
    // Only WF and MC available — overall should equal weighted average
    // of those two items, not penalize for missing items.
    const out = computeDnaGrade(null, wfStable, mc);
    const wfScore = out.items.find((it) => it.label === "Walk-Forward Stability")?.score ?? 0;
    const mcScore = out.items.find((it) => it.label === "Monte Carlo Robustness")?.score ?? 0;
    // weights: WF 0.3, MC 0.3 → renormalized to 0.5 each
    const expected = (wfScore * 0.3 + mcScore * 0.3) / 0.6;
    expect(out.overallScore).toBeCloseTo(expected, 5);
  });
});
