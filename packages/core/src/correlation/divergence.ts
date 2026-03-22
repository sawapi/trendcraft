import type { CorrelationAnalysisOptions, DivergencePoint } from "../types/correlation";

/**
 * Detect intermarket divergences (one asset moves up while correlated asset moves down)
 *
 * Computes rolling return spreads and flags points where the z-score of the
 * spread exceeds the threshold, indicating a statistically significant divergence.
 *
 * @param pricesA - Price series for asset A
 * @param pricesB - Price series for asset B
 * @param times - Timestamps
 * @param options - Detection options (divergenceLookback, divergenceThreshold)
 * @returns Array of divergence signals
 *
 * @example
 * ```ts
 * const divs = detectIntermarketDivergence(pricesSPY, pricesQQQ, times, {
 *   divergenceLookback: 20,
 *   divergenceThreshold: 2.0,
 * });
 * ```
 */
export function detectIntermarketDivergence(
  pricesA: number[],
  pricesB: number[],
  times: number[],
  options: CorrelationAnalysisOptions = {},
): DivergencePoint[] {
  const lookback = options.divergenceLookback ?? 20;
  const threshold = options.divergenceThreshold ?? 2.0;
  const n = Math.min(pricesA.length, pricesB.length, times.length);

  const divergences: DivergencePoint[] = [];

  // Calculate return spreads and their statistics
  const returnSpreads: number[] = [];

  for (let i = lookback; i < n; i++) {
    const returnA = (pricesA[i] - pricesA[i - lookback]) / pricesA[i - lookback];
    const returnB = (pricesB[i] - pricesB[i - lookback]) / pricesB[i - lookback];
    const spread = returnA - returnB;
    returnSpreads.push(spread);
  }

  if (returnSpreads.length < lookback) return divergences;

  // Rolling mean and std of return spread
  for (let i = lookback; i < returnSpreads.length; i++) {
    const window = returnSpreads.slice(i - lookback, i);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const std = Math.sqrt(window.reduce((a, v) => a + (v - mean) ** 2, 0) / window.length);

    if (std === 0) continue;

    const currentSpread = returnSpreads[i];
    const zScore = (currentSpread - mean) / std;

    const timeIdx = i + lookback; // Map back to original time index

    if (Math.abs(zScore) >= threshold) {
      const returnA =
        ((pricesA[timeIdx] - pricesA[timeIdx - lookback]) / pricesA[timeIdx - lookback]) * 100;
      const returnB =
        ((pricesB[timeIdx] - pricesB[timeIdx - lookback]) / pricesB[timeIdx - lookback]) * 100;

      divergences.push({
        time: times[timeIdx],
        type: zScore > 0 ? "bearish" : "bullish", // A outperforming B = bearish for A (mean reversion expected)
        returnA,
        returnB,
        returnSpread: returnA - returnB,
        significance: Math.abs(zScore),
      });
    }
  }

  return divergences;
}
