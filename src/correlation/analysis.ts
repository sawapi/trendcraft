import type {
  CorrelationAnalysisOptions,
  CorrelationAnalysisResult,
  CorrelationRegime,
} from "../types/correlation";
import { detectIntermarketDivergence } from "./divergence";
import { analyzeLeadLag } from "./lead-lag";
import { detectCorrelationRegimes } from "./regime";
import { rollingCorrelation } from "./rolling";

/**
 * Full cross-asset correlation analysis
 *
 * Combines rolling correlation, regime detection, lead-lag analysis,
 * and intermarket divergence detection into a single comprehensive result.
 *
 * @param seriesA - Price series for asset A (time, value pairs)
 * @param seriesB - Price series for asset B (time, value pairs)
 * @param options - Analysis options
 * @returns Complete correlation analysis
 *
 * @example
 * ```ts
 * const analysis = analyzeCorrelation(
 *   candlesSPY.map(c => ({ time: c.time, value: c.close })),
 *   candlesQQQ.map(c => ({ time: c.time, value: c.close })),
 *   { window: 60 },
 * );
 * console.log(`Current regime: ${analysis.summary.currentRegime}`);
 * console.log(`Lead-lag: ${analysis.leadLag.assessment}`);
 * ```
 */
export function analyzeCorrelation(
  seriesA: Array<{ time: number; value: number }>,
  seriesB: Array<{ time: number; value: number }>,
  options: CorrelationAnalysisOptions = {},
): CorrelationAnalysisResult {
  const window = options.window ?? 60;
  const len = Math.min(seriesA.length, seriesB.length);

  // Calculate returns
  const returnsA: number[] = [];
  const returnsB: number[] = [];
  const times: number[] = [];

  for (let i = 1; i < len; i++) {
    returnsA.push((seriesA[i].value - seriesA[i - 1].value) / seriesA[i - 1].value);
    returnsB.push((seriesB[i].value - seriesB[i - 1].value) / seriesB[i - 1].value);
    times.push(seriesA[i].time);
  }

  // Rolling correlation
  const rollingCorr = rollingCorrelation(returnsA, returnsB, times, window);

  // Regime detection
  const regimes = detectCorrelationRegimes(rollingCorr, options);

  // Lead-lag analysis
  const leadLag = analyzeLeadLag(returnsA, returnsB, options);

  // Intermarket divergence
  const pricesA = seriesA.slice(0, len).map((s) => s.value);
  const pricesB = seriesB.slice(0, len).map((s) => s.value);
  const allTimes = seriesA.slice(0, len).map((s) => s.time);
  const divergences = detectIntermarketDivergence(pricesA, pricesB, allTimes, options);

  // Summary
  const avgCorrelation =
    rollingCorr.length > 0
      ? rollingCorr.reduce((s, p) => s + p.pearson, 0) / rollingCorr.length
      : 0;

  const corrValues = rollingCorr.map((p) => p.pearson);
  const corrStd =
    corrValues.length > 0
      ? Math.sqrt(corrValues.reduce((s, v) => s + (v - avgCorrelation) ** 2, 0) / corrValues.length)
      : 0;
  const stability = avgCorrelation !== 0 ? Math.max(0, 1 - Math.abs(corrStd / avgCorrelation)) : 0;

  const currentRegime =
    regimes.length > 0 ? regimes[regimes.length - 1].regime : ("neutral" as CorrelationRegime);

  // Find dominant regime
  const regimeCounts = new Map<CorrelationRegime, number>();
  for (const r of regimes) {
    regimeCounts.set(r.regime, (regimeCounts.get(r.regime) ?? 0) + 1);
  }
  let dominantRegime: CorrelationRegime = "neutral";
  let maxCount = 0;
  for (const [regime, count] of regimeCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantRegime = regime;
    }
  }

  return {
    rollingCorrelation: rollingCorr,
    regimes,
    leadLag,
    divergences,
    summary: { avgCorrelation, stability, currentRegime, dominantRegime },
  };
}
