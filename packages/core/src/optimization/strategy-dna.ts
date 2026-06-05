/**
 * Strategy DNA — post-optimization analytics.
 *
 * Analyzes already-computed optimization results (no new backtests
 * needed) to produce visualizations and recommendations:
 *
 * - **Genome segments** — best params placed on a 0..1 axis within
 *   their search ranges, for at-a-glance "where in the space did the
 *   optimizer land" panels.
 * - **Sensitivity data** — per-param and pairwise score distributions,
 *   plus top-25% safe zones, used by sensitivity heatmaps.
 * - **Recommended params** — three-step heuristic: safe-zone median,
 *   walk-forward stable-period override, sensitivity-peak penalty.
 * - **DNA grade report** — A–F summary across WF stability / MC
 *   significance / parameter sensitivity / win-rate stability.
 *
 * This is intentionally separate from the comprehensive
 * `robustness/` module: that one runs new backtests across regime
 * splits, this one only crunches outputs the user already produced.
 *
 * @example
 * ```ts
 * import {
 *   buildGenomeSegments,
 *   extractSensitivityData,
 *   computeRecommendedParams,
 *   computeDnaGrade,
 *   gridSearch,
 * } from "trendcraft";
 *
 * const grid = gridSearch(...);
 * const sensitivity = extractSensitivityData(grid.results, grid.metric);
 * const recommendation = computeRecommendedParams(grid, walkForwardResult, sensitivity);
 * const grade = computeDnaGrade(grid, walkForwardResult, monteCarloResult);
 * ```
 */

import { median } from "../core/statistics";
import type {
  GridSearchResult,
  MonteCarloResult,
  OptimizationMetric,
  OptimizationResultEntry,
  WalkForwardResult,
} from "../types/optimization";

// ── Types ──────────────────────────────────────────────────────────

export interface GenomeSegment {
  name: string;
  value: number;
  min: number;
  max: number;
  /** Position within the [min, max] range, clamped to [0, 1]. 0.5 when min === max. */
  position: number;
  /** Best score for this segment's strategy run. */
  score: number;
}

export interface SensitivitySingle {
  paramName: string;
  /** Sorted by `value`. `metric` is the mean across all entries that share the same value. */
  data: { value: number; metric: number }[];
}

export interface SensitivityPair {
  paramX: string;
  paramY: string;
  /** Mean metric per (x, y) cell. */
  data: { x: number; y: number; metric: number }[];
  /** Sorted unique x and y values from the grid. */
  xValues: number[];
  yValues: number[];
}

export interface SafeZone {
  paramName: string;
  min: number;
  max: number;
}

export interface SensitivityData {
  singleParams: SensitivitySingle[];
  pairwise: SensitivityPair[];
  safeZones: SafeZone[];
}

export interface RecommendedParams {
  params: Record<string, number>;
  ranges: Record<string, { min: number; max: number }>;
  confidence: "high" | "medium" | "low";
  reason: string;
  /** Human-readable list of inputs the recommendation drew from (Safe Zone, WF, etc.). */
  sources: string[];
}

/** DNA grade letter, simpler than `robustness/RobustnessGrade` (no `+` half-grades). */
export type DnaGrade = "A" | "B" | "C" | "D" | "F";

export interface DnaGradeItem {
  label: string;
  grade: DnaGrade;
  /** 0..100 score; weighted by `available: true` items into the overall grade. */
  score: number;
  description: string;
  /** `false` when the input that would produce this item wasn't supplied. */
  available: boolean;
}

export interface DnaGradeReport {
  items: DnaGradeItem[];
  overall: DnaGrade;
  overallScore: number;
}

// ── Metric Direction ───────────────────────────────────────────────

/**
 * Metrics where smaller is better (notably `maxDrawdown`, where -2%
 * is preferable to -5%). Everything else in `OptimizationMetric`
 * follows max-is-better. Without this, top-25% / safe-zone / WF
 * stable filtering would surface the *worst* drawdown configurations
 * as recommendations.
 */
const MINIMIZING_METRICS: ReadonlySet<OptimizationMetric> = new Set(["maxDrawdown"]);

function compareDescByMetric(metric: OptimizationMetric) {
  const minimize = MINIMIZING_METRICS.has(metric);
  return (a: OptimizationResultEntry, b: OptimizationResultEntry) =>
    minimize ? a.metrics[metric] - b.metrics[metric] : b.metrics[metric] - a.metrics[metric];
}

// ── Genome ─────────────────────────────────────────────────────────

/**
 * Map best parameter values onto a normalized [0, 1] axis within their
 * declared search ranges. Filters out params not present in `bestParams`.
 *
 * @example
 * ```ts
 * const segments = buildGenomeSegments(
 *   { fast: 7, slow: 30 },
 *   [{ name: "fast", min: 5, max: 15 }, { name: "slow", min: 20, max: 50 }],
 *   bestScore,
 * );
 * // segments[0] = { name: "fast", value: 7, position: 0.2, ... }
 * ```
 */
export function buildGenomeSegments(
  bestParams: Record<string, number>,
  paramRanges: { name: string; min: number; max: number }[],
  bestScore: number,
): GenomeSegment[] {
  return paramRanges
    .filter((r) => bestParams[r.name] !== undefined)
    .map((r) => {
      const value = bestParams[r.name];
      const range = r.max - r.min;
      const position = range > 0 ? (value - r.min) / range : 0.5;
      return {
        name: r.name,
        value,
        min: r.min,
        max: r.max,
        position: Math.max(0, Math.min(1, position)),
        score: bestScore,
      };
    });
}

// ── Sensitivity ────────────────────────────────────────────────────

/**
 * Aggregate per-parameter and pairwise metric distributions plus
 * top-25% safe zones from a grid search's results.
 *
 * - `singleParams[i]`: param × value → mean metric across all combos
 *   with that value.
 * - `pairwise[ij]`: (param_i, param_j) × (value_i, value_j) → mean
 *   metric. One entry per unordered pair.
 * - `safeZones[i]`: min/max value of param_i across the top-25%
 *   results by `metric`.
 *
 * Empty results returns an empty `SensitivityData` (no throw).
 */
export function extractSensitivityData(
  results: OptimizationResultEntry[],
  metric: OptimizationMetric,
): SensitivityData {
  if (results.length === 0) {
    return { singleParams: [], pairwise: [], safeZones: [] };
  }

  const paramNames = Object.keys(results[0].params);

  const singleParams: SensitivitySingle[] = paramNames.map((paramName) => {
    const byValue = new Map<number, number[]>();
    for (const r of results) {
      const v = r.params[paramName];
      if (!byValue.has(v)) byValue.set(v, []);
      byValue.get(v)?.push(r.metrics[metric]);
    }
    const data = Array.from(byValue.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([value, metrics]) => ({
        value,
        metric: metrics.reduce((s, m) => s + m, 0) / metrics.length,
      }));
    return { paramName, data };
  });

  const pairwise: SensitivityPair[] = [];
  for (let i = 0; i < paramNames.length; i++) {
    for (let j = i + 1; j < paramNames.length; j++) {
      const paramX = paramNames[i];
      const paramY = paramNames[j];
      const byPair = new Map<string, number[]>();
      const xSet = new Set<number>();
      const ySet = new Set<number>();
      for (const r of results) {
        const x = r.params[paramX];
        const y = r.params[paramY];
        xSet.add(x);
        ySet.add(y);
        const key = `${x}|${y}`;
        if (!byPair.has(key)) byPair.set(key, []);
        byPair.get(key)?.push(r.metrics[metric]);
      }
      const data: { x: number; y: number; metric: number }[] = [];
      for (const [key, metrics] of byPair) {
        const [xs, ys] = key.split("|");
        data.push({
          x: Number(xs),
          y: Number(ys),
          metric: metrics.reduce((s, m) => s + m, 0) / metrics.length,
        });
      }
      pairwise.push({
        paramX,
        paramY,
        data,
        xValues: Array.from(xSet).sort((a, b) => a - b),
        yValues: Array.from(ySet).sort((a, b) => a - b),
      });
    }
  }

  // Safe zones: top 25% results by metric (direction-aware so
  // minimizing metrics like `maxDrawdown` surface the smallest, not
  // the largest, drawdowns), find param ranges.
  const sorted = [...results].sort(compareDescByMetric(metric));
  const top25 = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.25)));
  const safeZones: SafeZone[] = paramNames.map((paramName) => {
    const values = top25.map((r) => r.params[paramName]);
    return {
      paramName,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  });

  return { singleParams, pairwise, safeZones };
}

// ── Recommended Parameters ─────────────────────────────────────────

/**
 * Snap an interpolated median back to the nearest explored candidate
 * so the recommendation is always a value the user actually tested.
 * Without this, the recommendation can be `7.5` for an integer-only
 * param (when the top-25% has an even count and median linearly
 * interpolates `7` and `8`), which then re-enters the next
 * optimization run as a fractional value the strategy never saw.
 */
function snapToNearest(target: number, candidates: number[]): number {
  let best = candidates[0];
  let bestDist = Math.abs(target - best);
  for (let i = 1; i < candidates.length; i++) {
    const d = Math.abs(target - candidates[i]);
    if (d < bestDist) {
      best = candidates[i];
      bestDist = d;
    }
  }
  return best;
}

/**
 * Produce a "robust" parameter recommendation from a grid search,
 * optionally refined by walk-forward and sensitivity inputs.
 *
 * Three-step pipeline (each step optionally narrows the previous
 * step's choice):
 *
 * 1. **Safe Zone center** — median of the top-25% grid-search results
 *    per param. Always runs.
 * 2. **WF stability override** — if any walk-forward periods
 *    out-of-sample-profitably, override Step 1 with the median of
 *    those periods' `bestParams`.
 * 3. **Sensitivity penalty** — when the recommended value sits on a
 *    sharp peak (≥50% drop to nearest neighbors in the sensitivity
 *    plot), the recommendation is downgraded to `confidence: "low"`.
 *
 * Confidence rules:
 * - `low` if any param sits on a sharp sensitivity peak.
 * - `high` if WF data exists, ≥half its periods were profitable, and
 *   no sharp peak was found.
 * - `medium` otherwise.
 *
 * Handles `gridSearch.bestParams === null` (PR-A2 contract) by
 * falling back to `results[0]?.params` so a recommendation can still
 * be produced from the explored space.
 */
export function computeRecommendedParams(
  gridSearch: GridSearchResult,
  walkForward?: WalkForwardResult | null,
  sensitivityData?: SensitivityData | null,
): RecommendedParams {
  // 0-result guard: an empty grid produces no recommendation rather
  // than a partially-formed object whose params/ranges are vacuously
  // empty but sources still claim a "Safe Zone center" was found.
  if (gridSearch.results.length === 0) {
    return {
      params: {},
      ranges: {},
      confidence: "low",
      reason: "No optimization results to recommend from",
      sources: [],
    };
  }

  const paramNames = Object.keys(gridSearch.bestParams ?? gridSearch.results[0]?.params ?? {});
  const sources: string[] = [];

  // Step 1: Safe Zone center (top-25% median). Direction-aware so
  // minimizing metrics like `maxDrawdown` recommend params near the
  // smallest drawdowns, not the largest.
  const sorted = [...gridSearch.results].sort(compareDescByMetric(gridSearch.metric));
  const top25 = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.25)));

  const params: Record<string, number> = {};
  const ranges: Record<string, { min: number; max: number }> = {};

  for (const name of paramNames) {
    const values = top25.map((r) => r.params[name]);
    if (values.length === 0) continue;
    params[name] = snapToNearest(median(values), values);
    ranges[name] = { min: Math.min(...values), max: Math.max(...values) };
  }
  sources.push("Safe Zone center");

  // Step 2: Walk-Forward stable period override.
  let wfStablePeriods = 0;
  let wfTotalPeriods = 0;

  if (walkForward && walkForward.periods.length > 0) {
    wfTotalPeriods = walkForward.periods.length;
    const stablePeriods = walkForward.periods.filter((p) => p.outOfSampleMetrics.returns > 0);
    wfStablePeriods = stablePeriods.length;

    if (stablePeriods.length > 0) {
      for (const name of paramNames) {
        const values = stablePeriods
          .map((p) => p.bestParams[name])
          .filter((v): v is number => v !== undefined);
        if (values.length > 0) {
          params[name] = snapToNearest(median(values), values);
          // Recompute the displayed range from the same source as the
          // override so consumers don't get a self-contradictory
          // `fast=9` with `(5..7)` when WF stable values lie outside
          // the original safe zone.
          ranges[name] = { min: Math.min(...values), max: Math.max(...values) };
        }
      }
      sources.push(`${stablePeriods.length}/${wfTotalPeriods} stable WF periods`);
    }
  }

  // Step 3: Sensitivity penalty for sharp peaks. Direction-aware so
  // it works for both maximizing metrics (rec value much higher than
  // neighbors → drop ratio > 50%) and minimizing metrics like
  // `maxDrawdown` (rec value much lower than neighbors → rise ratio
  // > 50%, since smaller drawdowns are better).
  let hasSensitivityPenalty = false;
  const minimize = MINIMIZING_METRICS.has(gridSearch.metric);
  if (sensitivityData && sensitivityData.singleParams.length > 0) {
    for (const sp of sensitivityData.singleParams) {
      const recValue = params[sp.paramName];
      if (recValue === undefined || sp.data.length < 3) continue;

      const idx = sp.data.findIndex((d) => d.value === recValue);
      if (idx === -1) continue;
      const atRec = sp.data[idx];

      const neighbors = [sp.data[idx - 1], sp.data[idx + 1]].filter(Boolean);
      if (neighbors.length === 0) continue;
      const avgNeighbor = neighbors.reduce((s, n) => s + n.metric, 0) / neighbors.length;

      let peakRatio = 0;
      if (minimize) {
        // Minimize: rec is "smaller is better" — peak means avgNeighbor
        // is meaningfully larger. Use magnitude of `atRec.metric` as
        // the denominator so a 50% rise from rec to neighbors triggers.
        if (Math.abs(atRec.metric) > 0) {
          peakRatio = (avgNeighbor - atRec.metric) / Math.abs(atRec.metric);
        }
      } else if (atRec.metric > 0) {
        peakRatio = 1 - avgNeighbor / atRec.metric;
      }
      if (peakRatio > 0.5) {
        hasSensitivityPenalty = true;
        break;
      }
    }
  }

  const hasWfData = wfStablePeriods > 0;
  const wfMajorityStable = wfStablePeriods >= wfTotalPeriods / 2;

  let confidence: "high" | "medium" | "low";
  if (hasSensitivityPenalty) {
    confidence = "low";
  } else if (hasWfData && wfMajorityStable) {
    confidence = "high";
  } else {
    confidence = "medium";
  }

  const reason =
    confidence === "high"
      ? "Safe Zone center confirmed by stable Walk-Forward periods with low sensitivity"
      : confidence === "medium"
        ? hasWfData
          ? `Only ${wfStablePeriods}/${wfTotalPeriods} WF periods were profitable`
          : "Based on Grid Search Safe Zone only (no Walk-Forward data)"
        : "Parameters sit on a sharp sensitivity peak — use with caution";

  return { params, ranges, confidence, reason, sources };
}

// ── DNA Grading ────────────────────────────────────────────────────

function scoreToDnaGrade(score: number): DnaGrade {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}

function wfStabilityScore(stabilityRatio: number): number {
  if (stabilityRatio >= 0.8) return 100;
  if (stabilityRatio >= 0.6) return 75;
  if (stabilityRatio >= 0.4) return 50;
  if (stabilityRatio >= 0.2) return 25;
  return 0;
}

/**
 * Map Monte Carlo downside risk to a 0–100 robustness score. Driven by
 * the worse of probability-of-loss and risk-of-ruin (a strategy is only
 * as robust as its larger downside). Thresholds mirror the color bands
 * mainstream MC tooling uses for risk of ruin (green < 5%, red > 50%).
 */
function mcDownsideScore(probLoss: number, riskOfRuin: number): number {
  const risk = Math.max(probLoss, riskOfRuin);
  if (risk < 0.05) return 100;
  if (risk < 0.1) return 75;
  if (risk < 0.2) return 50;
  if (risk < 0.35) return 25;
  return 0;
}

function paramSensitivityScore(cv: number): number {
  if (cv < 0.1) return 100;
  if (cv < 0.2) return 75;
  if (cv < 0.3) return 50;
  if (cv < 0.5) return 25;
  return 0;
}

function winRateStabilityScore(stdDev: number): number {
  if (stdDev < 5) return 100;
  if (stdDev < 10) return 75;
  if (stdDev < 15) return 50;
  if (stdDev < 20) return 25;
  return 0;
}

/** Coefficient of variation of grid-search scores: a unit-free measure of metric spread. */
function computeCV(results: OptimizationResultEntry[], metric: OptimizationMetric): number {
  if (results.length < 2) return 0;
  const values = results.map((r) => r.metrics[metric]);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (Math.abs(mean) < 1e-10) return 1;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

/** Stddev of out-of-sample win rates across walk-forward periods. */
function computeWinRateStdDev(wf: WalkForwardResult): number {
  if (wf.periods.length < 2) return 0;
  const winRates = wf.periods.map((p) => p.outOfSampleMetrics.winRate);
  const mean = winRates.reduce((s, v) => s + v, 0) / winRates.length;
  const variance = winRates.reduce((s, v) => s + (v - mean) ** 2, 0) / winRates.length;
  return Math.sqrt(variance);
}

/**
 * Compute an A–F robustness grade across four dimensions, using only
 * the inputs supplied. Items whose corresponding input is missing are
 * marked `available: false` and excluded from the weighted-average
 * overall (the remaining weights renormalize to 1, so a one-input
 * grade isn't penalized for the missing dimensions).
 *
 * Weights: WF stability 30%, MC significance 30%, parameter
 * sensitivity 20%, win-rate stability 20%.
 *
 * Distinct from the `robustness/` module's `RobustnessGrade` (which
 * uses A+/B+/... half-grades and runs new backtests). This grade only
 * crunches inputs the user already produced.
 */
export function computeDnaGrade(
  gridSearch?: GridSearchResult | null,
  walkForward?: WalkForwardResult | null,
  monteCarlo?: MonteCarloResult | null,
): DnaGradeReport {
  const items: DnaGradeItem[] = [];

  if (walkForward) {
    const s = wfStabilityScore(walkForward.aggregateMetrics.stabilityRatio);
    items.push({
      label: "Walk-Forward Stability",
      grade: scoreToDnaGrade(s),
      score: s,
      description: `Stability ratio: ${(walkForward.aggregateMetrics.stabilityRatio * 100).toFixed(1)}%`,
      available: true,
    });
  } else {
    items.push({
      label: "Walk-Forward Stability",
      grade: "F",
      score: 0,
      description: "Run Walk-Forward analysis first",
      available: false,
    });
  }

  if (monteCarlo) {
    const { probLoss, riskOfRuin, ruinThreshold } = monteCarlo.downside;
    const s = mcDownsideScore(probLoss, riskOfRuin);
    items.push({
      label: "Monte Carlo Robustness",
      grade: scoreToDnaGrade(s),
      score: s,
      description: `P(loss): ${(probLoss * 100).toFixed(0)}%, risk of ${ruinThreshold}%+ ruin: ${(riskOfRuin * 100).toFixed(0)}%`,
      available: true,
    });
  } else {
    items.push({
      label: "Monte Carlo Robustness",
      grade: "F",
      score: 0,
      description: "Run Monte Carlo first",
      available: false,
    });
  }

  if (gridSearch && gridSearch.results.length > 1) {
    const cv = computeCV(gridSearch.results, gridSearch.metric);
    const s = paramSensitivityScore(cv);
    items.push({
      label: "Parameter Sensitivity",
      grade: scoreToDnaGrade(s),
      score: s,
      description: `CV: ${cv.toFixed(3)} (lower = more robust)`,
      available: true,
    });
  } else {
    items.push({
      label: "Parameter Sensitivity",
      grade: "F",
      score: 0,
      description: "Run Grid Search first",
      available: false,
    });
  }

  if (walkForward && walkForward.periods.length >= 2) {
    const stdDev = computeWinRateStdDev(walkForward);
    const s = winRateStabilityScore(stdDev);
    items.push({
      label: "Win Rate Stability",
      grade: scoreToDnaGrade(s),
      score: s,
      description: `Std dev: ${stdDev.toFixed(1)}% across ${walkForward.periods.length} periods`,
      available: true,
    });
  } else {
    items.push({
      label: "Win Rate Stability",
      grade: "F",
      score: 0,
      description: "Run Walk-Forward analysis first",
      available: false,
    });
  }

  // Renormalize available weights so a one-input grade isn't dragged down by missing items.
  const weights = [0.3, 0.3, 0.2, 0.2];
  let overallScore = 0;
  let totalWeight = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].available) {
      overallScore += items[i].score * weights[i];
      totalWeight += weights[i];
    }
  }
  overallScore = totalWeight > 0 ? overallScore / totalWeight : 0;

  return {
    items,
    overall: scoreToDnaGrade(overallScore),
    overallScore,
  };
}
