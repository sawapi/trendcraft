/**
 * Safe versions of all indicator functions
 *
 * Each function wraps the original throwing indicator in a Result type,
 * returning Ok on success and Err with INDICATOR_ERROR on failure.
 *
 * @example
 * ```ts
 * import { safe } from "trendcraft";
 *
 * const result = safe.rsiSafe(candles, { period: 14 });
 * if (result.ok) {
 *   console.log(result.value); // Series<number | null>
 * } else {
 *   console.error(result.error.code); // "INDICATOR_ERROR"
 * }
 * ```
 */

import { toResult } from "../types";
import type { Result, TrendCraftError } from "../types";

import {
  adl,
  andrewsPitchfork,
  aroon,
  atr,
  autoTrendLine,
  // Volatility
  bollingerBands,
  breakOfStructure,
  cci,
  chandelierExit,
  changeOfCharacter,
  channelLine,
  cmf,
  cumulativeReturns,
  dmi,
  donchianChannel,
  dpo,
  ema,
  fairValueGap,
  fastStochastics,
  fibonacciExtension,
  fibonacciRetracement,
  fractals,
  heikinAshi,
  highest,
  // Price
  highestLowest,
  hurst,
  // Trend
  ichimoku,
  kama,
  keltnerChannel,
  lowest,
  macd,
  mfi,
  obv,
  parabolicSar,
  pivotPoints,
  returns,
  roc,
  roofingFilter,
  // Momentum
  rsi,
  slowStochastics,
  // Moving Averages
  sma,
  stochRsi,
  stochastics,
  // Filter
  superSmoother,
  supertrend,
  swingPoints,
  t3,
  trix,
  volatilityRegime,
  volumeAnomaly,
  // Volume
  volumeMa,
  volumeProfile,
  volumeTrend,
  vortex,
  vwap,
  vwma,
  williamsR,
  wma,
  zigzag,
} from "./index";

// Helper type for extracting function signature
type SafeVersion<F extends (...args: never[]) => unknown> = (
  ...args: Parameters<F>
) => Result<ReturnType<F>, TrendCraftError>;

function makeSafe<F extends (...args: never[]) => unknown>(fn: F): SafeVersion<F> {
  return ((...args: Parameters<F>) =>
    toResult(() => fn(...args), "INDICATOR_ERROR")) as SafeVersion<F>;
}

// Moving Averages
export const smaSafe = makeSafe(sma);
export const emaSafe = makeSafe(ema);
export const wmaSafe = makeSafe(wma);
export const vwmaSafe = makeSafe(vwma);
export const kamaSafe = makeSafe(kama);
export const t3Safe = makeSafe(t3);

// Momentum
export const rsiSafe = makeSafe(rsi);
export const macdSafe = makeSafe(macd);
export const stochasticsSafe = makeSafe(stochastics);
export const fastStochasticsSafe = makeSafe(fastStochastics);
export const slowStochasticsSafe = makeSafe(slowStochastics);
export const dmiSafe = makeSafe(dmi);
export const stochRsiSafe = makeSafe(stochRsi);
export const cciSafe = makeSafe(cci);
export const williamsRSafe = makeSafe(williamsR);
export const rocSafe = makeSafe(roc);
export const trixSafe = makeSafe(trix);
export const aroonSafe = makeSafe(aroon);
export const dpoSafe = makeSafe(dpo);
export const hurstSafe = makeSafe(hurst);

// Volatility
export const bollingerBandsSafe = makeSafe(bollingerBands);
export const atrSafe = makeSafe(atr);
export const donchianChannelSafe = makeSafe(donchianChannel);
export const keltnerChannelSafe = makeSafe(keltnerChannel);
export const chandelierExitSafe = makeSafe(chandelierExit);
export const volatilityRegimeSafe = makeSafe(volatilityRegime);

// Volume
export const volumeMaSafe = makeSafe(volumeMa);
export const obvSafe = makeSafe(obv);
export const mfiSafe = makeSafe(mfi);
export const vwapSafe = makeSafe(vwap);
export const cmfSafe = makeSafe(cmf);
export const volumeAnomalySafe = makeSafe(volumeAnomaly);
export const volumeProfileSafe = makeSafe(volumeProfile);
export const volumeTrendSafe = makeSafe(volumeTrend);
export const adlSafe = makeSafe(adl);

// Price
export const highestLowestSafe = makeSafe(highestLowest);
export const highestSafe = makeSafe(highest);
export const lowestSafe = makeSafe(lowest);
export const returnsSafe = makeSafe(returns);
export const cumulativeReturnsSafe = makeSafe(cumulativeReturns);
export const pivotPointsSafe = makeSafe(pivotPoints);
export const swingPointsSafe = makeSafe(swingPoints);
export const breakOfStructureSafe = makeSafe(breakOfStructure);
export const changeOfCharacterSafe = makeSafe(changeOfCharacter);
export const fairValueGapSafe = makeSafe(fairValueGap);
export const fibonacciRetracementSafe = makeSafe(fibonacciRetracement);
export const autoTrendLineSafe = makeSafe(autoTrendLine);
export const channelLineSafe = makeSafe(channelLine);
export const fibonacciExtensionSafe = makeSafe(fibonacciExtension);
export const andrewsPitchforkSafe = makeSafe(andrewsPitchfork);
export const heikinAshiSafe = makeSafe(heikinAshi);
export const fractalsSafe = makeSafe(fractals);
export const zigzagSafe = makeSafe(zigzag);

// Trend
export const ichimokuSafe = makeSafe(ichimoku);
export const supertrendSafe = makeSafe(supertrend);
export const parabolicSarSafe = makeSafe(parabolicSar);
export const vortexSafe = makeSafe(vortex);

// Filter (Ehlers)
export const superSmootherSafe = makeSafe(superSmoother);
export const roofingFilterSafe = makeSafe(roofingFilter);
