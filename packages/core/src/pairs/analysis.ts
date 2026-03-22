/**
 * Full pairs trading analysis
 *
 * Combines cointegration testing, spread calculation, mean reversion analysis,
 * and signal generation into a single comprehensive analysis.
 *
 * @module pairs/analysis
 */

import type {
  PairsAnalysisOptions,
  PairsAnalysisResult,
  PairsSignal,
  SpreadPoint,
} from "../types/pairs";
import { adfTest } from "./adf";
import { analyzeMeanReversion } from "./mean-reversion";
import { olsRegression } from "./regression";
import { calculateSpread } from "./spread";

/**
 * Generate pairs trading signals based on z-score thresholds
 */
function generatePairsSignals(
  spread: SpreadPoint[],
  entryThreshold: number,
  exitThreshold: number,
): PairsSignal[] {
  const signals: PairsSignal[] = [];
  let position: "long" | "short" | "none" = "none";

  for (const point of spread) {
    const { time, zScore, spread: spreadValue } = point;

    if (position === "none") {
      if (zScore < -entryThreshold) {
        signals.push({
          time,
          type: "open_long",
          zScore,
          spread: spreadValue,
        });
        position = "long";
      } else if (zScore > entryThreshold) {
        signals.push({
          time,
          type: "open_short",
          zScore,
          spread: spreadValue,
        });
        position = "short";
      }
    } else if (position === "long") {
      if (zScore > -exitThreshold) {
        signals.push({ time, type: "close", zScore, spread: spreadValue });
        position = "none";
      }
    } else if (position === "short") {
      if (zScore < exitThreshold) {
        signals.push({ time, type: "close", zScore, spread: spreadValue });
        position = "none";
      }
    }
  }

  return signals;
}

/**
 * Full pairs trading analysis between two instruments
 *
 * Performs Engle-Granger cointegration test, calculates the spread and z-scores,
 * analyzes mean reversion properties (half-life, Hurst exponent), and generates
 * trading signals based on z-score thresholds.
 *
 * @param seriesA - Price series for instrument A (dependent variable)
 * @param seriesB - Price series for instrument B (independent variable)
 * @param options - Analysis options
 * @returns Complete pairs analysis result
 *
 * @example
 * ```ts
 * const result = analyzePair(
 *   candlesGOOG.map(c => ({ time: c.time, value: c.close })),
 *   candlesMSFT.map(c => ({ time: c.time, value: c.close })),
 * );
 *
 * if (result.cointegration.isCointegrated) {
 *   console.log(`Hedge ratio: ${result.cointegration.hedgeRatio}`);
 *   console.log(`Half-life: ${result.meanReversion.halfLife} bars`);
 * }
 * ```
 */
export function analyzePair(
  seriesA: Array<{ time: number; value: number }>,
  seriesB: Array<{ time: number; value: number }>,
  options: PairsAnalysisOptions = {},
): PairsAnalysisResult {
  const sigLevel = options.significanceLevel ?? 0.05;
  const entryThreshold = options.entryThreshold ?? 2.0;
  const exitThreshold = options.exitThreshold ?? 0.5;
  const maxHalfLife = options.maxHalfLife ?? 100;

  const len = Math.min(seriesA.length, seriesB.length);
  const pricesA = seriesA.slice(0, len).map((s) => s.value);
  const pricesB = seriesB.slice(0, len).map((s) => s.value);
  const times = seriesA.slice(0, len).map((s) => s.time);

  // 1. OLS regression: A = beta * B + intercept + residuals
  const { beta: hedgeRatio, intercept, rSquared, residuals } = olsRegression(pricesB, pricesA);

  // 2. ADF test on residuals (Engle-Granger method)
  const adf = adfTest(residuals);

  const critValue =
    sigLevel <= 0.01
      ? adf.criticalValues["1%"]
      : sigLevel <= 0.05
        ? adf.criticalValues["5%"]
        : adf.criticalValues["10%"];
  const isCointegrated = adf.adfStatistic < critValue;

  // 3. Spread series
  const spreadSeries = calculateSpread(pricesA, pricesB, hedgeRatio, intercept, times, options);

  // 4. Mean reversion analysis
  const spreads = spreadSeries.map((s) => s.spread);
  const meanReversion = analyzeMeanReversion(spreads, maxHalfLife);

  // 5. Generate signals
  const signals = generatePairsSignals(spreadSeries, entryThreshold, exitThreshold);

  // 6. Assessment
  const isViable = isCointegrated && meanReversion.isMeanReverting;
  let reason: string;
  let confidenceFactor: number;

  if (!isCointegrated) {
    reason = `Pair is not cointegrated (ADF=${adf.adfStatistic.toFixed(2)}, p=${adf.pValue.toFixed(3)}). Spread may not be stationary.`;
    confidenceFactor = 0.1;
  } else if (!meanReversion.isMeanReverting) {
    reason = `Pair is cointegrated but mean reversion is too slow (half-life=${meanReversion.halfLife.toFixed(0)} bars).`;
    confidenceFactor = 0.3;
  } else {
    reason = `Viable pair: cointegrated (p=${adf.pValue.toFixed(3)}), half-life=${meanReversion.halfLife.toFixed(1)} bars, Hurst=${meanReversion.hurstExponent.toFixed(3)}.`;
    confidenceFactor = Math.min(1, (1 - adf.pValue) * (1 - meanReversion.hurstExponent * 2));
  }

  return {
    cointegration: {
      isCointegrated,
      adfStatistic: adf.adfStatistic,
      criticalValues: adf.criticalValues,
      pValue: adf.pValue,
      hedgeRatio,
      intercept,
      rSquared,
      significanceLevel: sigLevel,
    },
    meanReversion,
    spreadSeries,
    signals,
    assessment: { isViable, reason, confidenceFactor },
  };
}
