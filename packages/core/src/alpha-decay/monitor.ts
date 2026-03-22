/**
 * Alpha Decay / Signal Degradation Monitor
 *
 * Tracks whether a strategy's predictive power degrades over time
 * using rolling Information Coefficient (IC), hit rate, and
 * CUSUM structural break detection.
 */

import type {
  AlphaDecayOptions,
  AlphaDecayResult,
  CusumBreak,
  DecayAssessment,
  DecayObservation,
  HitRatePoint,
  RollingICPoint,
} from "../types/alpha-decay";
import { linearRegression, spearmanCorrelation } from "./statistics";

/**
 * Analyze alpha decay from a sequence of signal/return observations
 *
 * Computes rolling IC (Spearman rank correlation), rolling hit rate,
 * and runs CUSUM structural break detection on the IC series.
 *
 * @param observations - Signal predictions and actual forward returns
 * @param options - Analysis options
 * @returns Alpha decay analysis result with assessment
 *
 * @example
 * ```ts
 * const observations = trades.map((t, i) => ({
 *   time: t.entryTime,
 *   signal: signalValues[i],
 *   forwardReturn: t.returnPercent,
 * }));
 *
 * const decay = analyzeAlphaDecay(observations);
 * console.log(decay.assessment.status); // "healthy" | "warning" | "degraded" | "critical"
 * ```
 */
export function analyzeAlphaDecay(
  observations: DecayObservation[],
  options: AlphaDecayOptions = {},
): AlphaDecayResult {
  const window = options.window ?? 60;
  const cusumThreshold = options.cusumThreshold ?? 4.0;
  const minObservations = options.minObservations ?? 30;

  if (observations.length < minObservations) {
    return createEmptyResult("Insufficient observations");
  }

  // Calculate rolling IC
  const rollingIC = calculateRollingIC(observations, window);

  // Calculate rolling hit rate
  const rollingHitRate = calculateRollingHitRate(observations, window);

  // Run CUSUM on IC series
  const { cusumSeries, breaks } = detectCusumBreaks(
    rollingIC.map((p) => ({ time: p.time, value: p.ic })),
    cusumThreshold,
  );

  // Assess overall decay
  const assessment = assessDecay(rollingIC, rollingHitRate, breaks);

  return { rollingIC, rollingHitRate, cusumSeries, breaks, assessment };
}

/**
 * Create decay observations from backtest trades
 *
 * Converts an array of trade results into observations suitable for
 * alpha decay analysis. Since all trades represent executed signals,
 * the signal is set to 1 (long) by default.
 *
 * @param trades - Array of trade results with entry time and return
 * @returns Array of decay observations
 *
 * @example
 * ```ts
 * const observations = createObservationsFromTrades(result.trades);
 * const decay = analyzeAlphaDecay(observations);
 * ```
 */
export function createObservationsFromTrades(
  trades: Array<{ entryTime: number; returnPercent: number }>,
): DecayObservation[] {
  return trades.map((t) => ({
    time: t.entryTime,
    signal: 1,
    forwardReturn: t.returnPercent,
  }));
}

/**
 * Create decay observations from signal scores and price data
 *
 * Pairs each scored signal with its actual forward return computed
 * from the candle data.
 *
 * @param scores - Array of signal scores with timestamps
 * @param candles - Price data (must include close prices)
 * @param forwardBars - Number of bars ahead to measure return (default: 1)
 * @returns Array of decay observations
 *
 * @example
 * ```ts
 * const scores = calculateScoreSeries(config, candles, indicators);
 * const observations = createObservationsFromScores(scores, candles, 5);
 * const decay = analyzeAlphaDecay(observations);
 * ```
 */
export function createObservationsFromScores(
  scores: Array<{ time: number; score: number }>,
  candles: Array<{ time: number; close: number }>,
  forwardBars = 1,
): DecayObservation[] {
  const results: DecayObservation[] = [];
  const timeMap = new Map<number, number>();
  candles.forEach((c, i) => timeMap.set(c.time, i));

  for (const score of scores) {
    const idx = timeMap.get(score.time);
    if (idx === undefined || idx + forwardBars >= candles.length) continue;
    const forwardReturn =
      ((candles[idx + forwardBars].close - candles[idx].close) / candles[idx].close) * 100;
    results.push({
      time: score.time,
      signal: score.score,
      forwardReturn,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function calculateRollingIC(obs: DecayObservation[], window: number): RollingICPoint[] {
  const results: RollingICPoint[] = [];
  for (let i = window - 1; i < obs.length; i++) {
    const windowObs = obs.slice(i - window + 1, i + 1);
    const signals = windowObs.map((o) => o.signal);
    const returns = windowObs.map((o) => o.forwardReturn);
    const { rho, pValue } = spearmanCorrelation(signals, returns);
    results.push({
      time: obs[i].time,
      ic: rho,
      pValue,
      sampleSize: window,
    });
  }
  return results;
}

function calculateRollingHitRate(obs: DecayObservation[], window: number): HitRatePoint[] {
  const results: HitRatePoint[] = [];
  for (let i = window - 1; i < obs.length; i++) {
    const windowObs = obs.slice(i - window + 1, i + 1);
    const hits = windowObs.filter(
      (o) =>
        (o.signal > 0 && o.forwardReturn > 0) ||
        (o.signal < 0 && o.forwardReturn < 0) ||
        (o.signal === 0 && o.forwardReturn === 0),
    ).length;
    results.push({
      time: obs[i].time,
      hitRate: hits / window,
      sampleSize: window,
    });
  }
  return results;
}

function detectCusumBreaks(
  series: Array<{ time: number; value: number }>,
  threshold: number,
): {
  cusumSeries: Array<{ time: number; value: number }>;
  breaks: CusumBreak[];
} {
  if (series.length === 0) return { cusumSeries: [], breaks: [] };

  // Calculate mean and std of the series
  const values = series.map((s) => s.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);

  if (std === 0)
    return {
      cusumSeries: series.map((s) => ({ time: s.time, value: 0 })),
      breaks: [],
    };

  // Page's CUSUM — track both positive and negative shifts
  const cusumSeries: Array<{ time: number; value: number }> = [];
  const breaks: CusumBreak[] = [];
  let cusumPos = 0;
  let cusumNeg = 0;

  for (let i = 0; i < series.length; i++) {
    const z = (series[i].value - mean) / std;
    cusumPos = Math.max(0, cusumPos + z);
    cusumNeg = Math.min(0, cusumNeg + z);

    // Track negative CUSUM (degradation direction)
    cusumSeries.push({ time: series[i].time, value: cusumNeg });

    if (cusumNeg < -threshold) {
      breaks.push({
        time: series[i].time,
        index: i,
        cusumValue: cusumNeg,
        direction: "degradation",
      });
      cusumNeg = 0; // Reset after break detection
    }
    if (cusumPos > threshold) {
      breaks.push({
        time: series[i].time,
        index: i,
        cusumValue: cusumPos,
        direction: "improvement",
      });
      cusumPos = 0;
    }
  }

  return { cusumSeries, breaks };
}

function assessDecay(
  rollingIC: RollingICPoint[],
  rollingHitRate: HitRatePoint[],
  breaks: CusumBreak[],
): DecayAssessment {
  if (rollingIC.length === 0) {
    return {
      status: "healthy",
      reason: "Insufficient data for assessment",
      currentIC: 0,
      currentHitRate: 0.5,
      icTrend: 0,
      halfLife: null,
      breaks: [],
    };
  }

  const currentIC = rollingIC[rollingIC.length - 1].ic;
  const currentHitRate =
    rollingHitRate.length > 0 ? rollingHitRate[rollingHitRate.length - 1].hitRate : 0.5;

  // Calculate IC trend (slope of linear regression)
  const x = rollingIC.map((_, i) => i);
  const y = rollingIC.map((p) => p.ic);
  const { slope: icTrend } = linearRegression(x, y);

  // Estimate half-life
  let halfLife: number | null = null;
  if (icTrend < 0 && currentIC > 0) {
    halfLife = Math.round(-currentIC / (2 * icTrend));
    if (halfLife < 0) halfLife = null;
  }

  // Recent degradation breaks
  const recentBreaks = breaks.filter((b) => b.direction === "degradation");

  // Determine status
  let status: DecayAssessment["status"];
  let reason: string;

  if (currentIC < 0 || currentHitRate < 0.45) {
    status = "critical";
    reason = `Strategy has negative alpha (IC=${currentIC.toFixed(3)}, hit rate=${(currentHitRate * 100).toFixed(1)}%). Consider retiring or re-optimizing.`;
  } else if (currentIC < 0.05 || currentHitRate < 0.5 || recentBreaks.length >= 2) {
    status = "degraded";
    reason = `Significant alpha degradation detected (IC=${currentIC.toFixed(3)}, trend=${icTrend.toFixed(5)}/bar).`;
  } else if (icTrend < -0.001 || (halfLife !== null && halfLife < 120)) {
    status = "warning";
    reason = `Alpha is declining (IC trend=${icTrend.toFixed(5)}/bar${halfLife ? `, estimated half-life: ${halfLife} bars` : ""}).`;
  } else {
    status = "healthy";
    reason = `Strategy alpha is stable (IC=${currentIC.toFixed(3)}, hit rate=${(currentHitRate * 100).toFixed(1)}%).`;
  }

  return {
    status,
    reason,
    currentIC,
    currentHitRate,
    icTrend,
    halfLife,
    breaks: recentBreaks,
  };
}

function createEmptyResult(reason: string): AlphaDecayResult {
  return {
    rollingIC: [],
    rollingHitRate: [],
    cusumSeries: [],
    breaks: [],
    assessment: {
      status: "healthy",
      reason,
      currentIC: 0,
      currentHitRate: 0.5,
      icTrend: 0,
      halfLife: null,
      breaks: [],
    },
  };
}
