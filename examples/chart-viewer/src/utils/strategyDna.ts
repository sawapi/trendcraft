/**
 * Strategy DNA utilities
 *
 * Genome visualization, sensitivity analysis, robustness grading,
 * and share URL encoding/decoding for backtest strategies.
 */

import type {
  GridSearchResult,
  MonteCarloResult,
  OptimizationMetric,
  OptimizationResultEntry,
  WalkForwardResult,
} from "trendcraft";
import type { BacktestConfig } from "../types/chart";

// ── Types ──────────────────────────────────────────────────────────

export interface GenomeSegment {
  name: string;
  value: number;
  min: number;
  max: number;
  /** 0-1 position within the range */
  position: number;
  /** Metric score for this parameter value */
  score: number;
}

export interface SensitivitySingle {
  paramName: string;
  data: { value: number; metric: number }[];
}

export interface SensitivityPair {
  paramX: string;
  paramY: string;
  data: { x: number; y: number; metric: number }[];
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

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface GradeItem {
  label: string;
  grade: Grade;
  score: number;
  description: string;
  available: boolean;
}

export interface RobustnessGrade {
  items: GradeItem[];
  overall: Grade;
  overallScore: number;
}

// ── Genome ─────────────────────────────────────────────────────────

/**
 * Build genome segments from grid search best parameters and ranges
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
 * Extract sensitivity data from grid search results
 */
export function extractSensitivityData(
  results: OptimizationResultEntry[],
  metric: OptimizationMetric,
): SensitivityData {
  if (results.length === 0) {
    return { singleParams: [], pairwise: [], safeZones: [] };
  }

  // Discover parameter names
  const paramNames = Object.keys(results[0].params);

  // Single-parameter sensitivity: aggregate by parameter value
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

  // Pairwise sensitivity (for 2-param combos)
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

  // Safe zones: top 25% results, find parameter ranges
  const sorted = [...results].sort((a, b) => b.metrics[metric] - a.metrics[metric]);
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

// ── Robustness Grading ─────────────────────────────────────────────

function scoreToGrade(score: number): Grade {
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

function mcSignificanceScore(pValue: number): number {
  if (pValue < 0.01) return 100;
  if (pValue < 0.05) return 75;
  if (pValue < 0.1) return 50;
  if (pValue < 0.2) return 25;
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

/**
 * Compute coefficient of variation from grid search results
 */
function computeCV(results: OptimizationResultEntry[], metric: OptimizationMetric): number {
  if (results.length < 2) return 0;
  const values = results.map((r) => r.metrics[metric]);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (Math.abs(mean) < 1e-10) return 1;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

/**
 * Compute win rate standard deviation across WF periods
 */
function computeWinRateStdDev(wf: WalkForwardResult): number {
  if (wf.periods.length < 2) return 0;
  const winRates = wf.periods.map((p) => p.outOfSampleMetrics.winRate);
  const mean = winRates.reduce((s, v) => s + v, 0) / winRates.length;
  const variance = winRates.reduce((s, v) => s + (v - mean) ** 2, 0) / winRates.length;
  return Math.sqrt(variance);
}

/**
 * Compute robustness grade from available optimization results
 */
export function computeRobustnessGrade(
  gridSearch?: GridSearchResult | null,
  walkForward?: WalkForwardResult | null,
  monteCarlo?: MonteCarloResult | null,
): RobustnessGrade {
  const items: GradeItem[] = [];

  // Walk-Forward stability
  if (walkForward) {
    const s = wfStabilityScore(walkForward.aggregateMetrics.stabilityRatio);
    items.push({
      label: "Walk-Forward Stability",
      grade: scoreToGrade(s),
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

  // Monte Carlo significance
  if (monteCarlo) {
    const pVal = Math.min(monteCarlo.pValue.sharpe, monteCarlo.pValue.returns);
    const s = mcSignificanceScore(pVal);
    items.push({
      label: "Monte Carlo Significance",
      grade: scoreToGrade(s),
      score: s,
      description: `p-value: ${pVal.toFixed(3)}`,
      available: true,
    });
  } else {
    items.push({
      label: "Monte Carlo Significance",
      grade: "F",
      score: 0,
      description: 'Click "Compute Grade" to run',
      available: false,
    });
  }

  // Parameter sensitivity (from grid search)
  if (gridSearch && gridSearch.results.length > 1) {
    const cv = computeCV(gridSearch.results, gridSearch.metric);
    const s = paramSensitivityScore(cv);
    items.push({
      label: "Parameter Sensitivity",
      grade: scoreToGrade(s),
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

  // Win rate stability (from WF periods)
  if (walkForward && walkForward.periods.length >= 2) {
    const stdDev = computeWinRateStdDev(walkForward);
    const s = winRateStabilityScore(stdDev);
    items.push({
      label: "Win Rate Stability",
      grade: scoreToGrade(s),
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

  // Overall grade: weighted average of available items
  // MC 30%, WF 30%, Param 20%, WinRate 20%
  const weights = [0.3, 0.3, 0.2, 0.2];
  const availableItems = items.filter((it) => it.available);

  let overallScore = 0;
  if (availableItems.length > 0) {
    let totalWeight = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].available) {
        overallScore += items[i].score * weights[i];
        totalWeight += weights[i];
      }
    }
    overallScore = totalWeight > 0 ? overallScore / totalWeight : 0;
  }

  return {
    items,
    overall: scoreToGrade(overallScore),
    overallScore,
  };
}

// ── Recommended Parameters ────────────────────────────────────────

export interface RecommendedParams {
  params: Record<string, number>;
  ranges: Record<string, { min: number; max: number }>;
  confidence: "high" | "medium" | "low";
  reason: string;
  sources: string[];
}

/**
 * Compute recommended parameters from grid search + walk-forward results.
 *
 * 3-step scoring:
 * 1. Safe Zone center from top 25% grid search results
 * 2. Walk-forward stable period filter (OOS profitable periods only)
 * 3. Sensitivity penalty for sharp peaks
 *
 * @example
 * const rec = computeRecommendedParams(gridResult, wfResult, sensitivityData);
 * // rec.params = { fastPeriod: 7, slowPeriod: 30 }
 * // rec.confidence = "high"
 */
export function computeRecommendedParams(
  gridSearch: GridSearchResult,
  walkForward?: WalkForwardResult | null,
  sensitivityData?: SensitivityData | null,
): RecommendedParams {
  const paramNames = Object.keys(gridSearch.bestParams);
  const sources: string[] = [];

  // Step 1: Safe Zone center (top 25% median)
  const sorted = [...gridSearch.results].sort(
    (a, b) => b.metrics[gridSearch.metric] - a.metrics[gridSearch.metric],
  );
  const top25 = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.25)));

  const params: Record<string, number> = {};
  const ranges: Record<string, { min: number; max: number }> = {};

  for (const name of paramNames) {
    const values = top25.map((r) => r.params[name]).sort((a, b) => a - b);
    const min = values[0];
    const max = values[values.length - 1];
    // Median
    const mid = Math.floor(values.length / 2);
    const median =
      values.length % 2 === 0 ? Math.round((values[mid - 1] + values[mid]) / 2) : values[mid];
    params[name] = median;
    ranges[name] = { min, max };
  }
  sources.push("Safe Zone center");

  // Step 2: Walk-Forward stable period filter
  let wfStablePeriods = 0;
  let wfTotalPeriods = 0;

  if (walkForward && walkForward.periods.length > 0) {
    wfTotalPeriods = walkForward.periods.length;
    // Filter: OOS returns > 0
    const stablePeriods = walkForward.periods.filter((p) => p.outOfSampleMetrics.returns > 0);
    wfStablePeriods = stablePeriods.length;

    if (stablePeriods.length > 0) {
      // Override with median of stable periods' bestParams
      for (const name of paramNames) {
        const values = stablePeriods
          .map((p) => p.bestParams[name])
          .filter((v) => v !== undefined)
          .sort((a, b) => a - b);
        if (values.length > 0) {
          const mid = Math.floor(values.length / 2);
          params[name] =
            values.length % 2 === 0 ? Math.round((values[mid - 1] + values[mid]) / 2) : values[mid];
        }
      }
      sources.push(`${stablePeriods.length}/${wfTotalPeriods} stable WF periods`);
    }
  }

  // Step 3: Sensitivity penalty — check if recommended params sit on a sharp peak
  let hasSensitivityPenalty = false;

  if (sensitivityData && sensitivityData.singleParams.length > 0) {
    for (const sp of sensitivityData.singleParams) {
      const recValue = params[sp.paramName];
      if (recValue === undefined || sp.data.length < 3) continue;

      // Find the metric at the recommended value
      const atRec = sp.data.find((d) => d.value === recValue);
      if (!atRec) continue;

      // Check neighbors: if metric drops >50% within 1 step, it's a sharp peak
      const idx = sp.data.findIndex((d) => d.value === recValue);
      const neighbors = [sp.data[idx - 1], sp.data[idx + 1]].filter(Boolean);

      if (neighbors.length > 0 && atRec.metric > 0) {
        const avgNeighbor = neighbors.reduce((s, n) => s + n.metric, 0) / neighbors.length;
        const dropRatio = 1 - avgNeighbor / atRec.metric;
        if (dropRatio > 0.5) {
          hasSensitivityPenalty = true;
          break;
        }
      }
    }
  }

  // Determine confidence
  let confidence: "high" | "medium" | "low";
  const hasWfData = wfStablePeriods > 0;
  const wfMajorityStable = wfStablePeriods >= wfTotalPeriods / 2;

  if (hasSensitivityPenalty) {
    confidence = "low";
  } else if (hasWfData && wfMajorityStable && !hasSensitivityPenalty) {
    confidence = "high";
  } else {
    confidence = "medium";
  }

  // Build reason string
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

// ── Share URL ──────────────────────────────────────────────────────

/** Short keys for URL encoding */
const KEY_MAP: Record<string, string> = {
  entryCondition: "e",
  exitCondition: "x",
  capital: "c",
  stopLoss: "sl",
  takeProfit: "tp",
  trailingStop: "ts",
  atrTrailMultiplier: "am",
  atrTrailPeriod: "ap",
  partialThreshold: "pt",
  partialSellPercent: "pp",
  startDate: "sd",
  commissionRate: "cr",
  taxRate: "tr",
};

const REVERSE_KEY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([k, v]) => [v, k]),
);

/** Numeric fields that should be parsed as numbers */
const NUMERIC_FIELDS = new Set([
  "capital",
  "stopLoss",
  "takeProfit",
  "trailingStop",
  "atrTrailMultiplier",
  "atrTrailPeriod",
  "partialThreshold",
  "partialSellPercent",
  "commissionRate",
  "taxRate",
]);

/**
 * Encode a BacktestConfig into URL query parameters
 */
export function encodeBacktestConfig(config: BacktestConfig): string {
  const params = new URLSearchParams();
  for (const [key, shortKey] of Object.entries(KEY_MAP)) {
    const value = config[key as keyof BacktestConfig];
    if (value !== undefined && value !== null && value !== "") {
      params.set(shortKey, String(value));
    }
  }
  return params.toString();
}

/**
 * Decode URL query parameters into a partial BacktestConfig
 */
export function decodeBacktestConfig(params: URLSearchParams): Partial<BacktestConfig> {
  const config: Record<string, unknown> = {};
  for (const [shortKey, value] of params.entries()) {
    const fullKey = REVERSE_KEY_MAP[shortKey];
    if (!fullKey) continue;
    if (NUMERIC_FIELDS.has(fullKey)) {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        config[fullKey] = num;
      }
    } else {
      config[fullKey] = value;
    }
  }
  return config as Partial<BacktestConfig>;
}
