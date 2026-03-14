import type {
  CorrelationAnalysisOptions,
  CorrelationPoint,
  CorrelationRegime,
  CorrelationRegimePoint,
} from "../types/correlation";

/**
 * Detect correlation regime from rolling correlation series
 *
 * Classifies each point into one of five regimes based on the Pearson
 * correlation value and configurable thresholds.
 *
 * @param correlationSeries - Rolling correlation series
 * @param options - Regime detection options (thresholds)
 * @returns Correlation regime series with duration tracking
 *
 * @example
 * ```ts
 * const regimes = detectCorrelationRegimes(rollingCorr, {
 *   regimeThresholds: { strongPositive: 0.8 },
 * });
 * // regimes[i].regime => "strong_positive" | "positive" | ...
 * ```
 */
export function detectCorrelationRegimes(
  correlationSeries: CorrelationPoint[],
  options: CorrelationAnalysisOptions = {},
): CorrelationRegimePoint[] {
  const thresholds = {
    strongPositive: options.regimeThresholds?.strongPositive ?? 0.7,
    positive: options.regimeThresholds?.positive ?? 0.3,
    negative: options.regimeThresholds?.negative ?? -0.3,
    strongNegative: options.regimeThresholds?.strongNegative ?? -0.7,
  };

  const result: CorrelationRegimePoint[] = [];
  let currentRegime: CorrelationRegime | null = null;
  let regimeDuration = 0;

  for (const point of correlationSeries) {
    const corr = point.pearson;
    let regime: CorrelationRegime;

    if (corr >= thresholds.strongPositive) regime = "strong_positive";
    else if (corr >= thresholds.positive) regime = "positive";
    else if (corr <= thresholds.strongNegative) regime = "strong_negative";
    else if (corr <= thresholds.negative) regime = "negative";
    else regime = "neutral";

    if (regime === currentRegime) {
      regimeDuration++;
    } else {
      currentRegime = regime;
      regimeDuration = 1;
    }

    result.push({
      time: point.time,
      regime,
      correlation: corr,
      regimeDuration,
    });
  }

  return result;
}
