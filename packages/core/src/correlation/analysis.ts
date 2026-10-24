import type {
  CorrelationAnalysisOptions,
  CorrelationAnalysisResult,
  CorrelationRegime,
} from "../types/correlation";
import { joinOnTime } from "../utils/align";
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
 * @param seriesB - Price series for asset B (time, value pairs). The two
 *   series are joined on `time`; only timestamps present in both are used.
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
  // Pair prices observed at the same time, not at the same array index.
  const { times: allTimes, a: pricesA, b: pricesB } = joinOnTime(seriesA, seriesB);

  // Calculate returns
  const returnsA: number[] = [];
  const returnsB: number[] = [];
  const times: number[] = [];

  for (let i = 1; i < allTimes.length; i++) {
    returnsA.push((pricesA[i] - pricesA[i - 1]) / pricesA[i - 1]);
    returnsB.push((pricesB[i] - pricesB[i - 1]) / pricesB[i - 1]);
    times.push(allTimes[i]);
  }

  // Rolling correlation
  const rollingCorr = rollingCorrelation(returnsA, returnsB, times, window);

  // Regime detection
  const regimes = detectCorrelationRegimes(rollingCorr, options);

  // Lead-lag analysis
  const leadLag = analyzeLeadLag(returnsA, returnsB, options);

  // Intermarket divergence
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
