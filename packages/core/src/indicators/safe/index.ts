/**
 * Safe Indicator API — `trendcraft/safe`
 *
 * All indicator functions wrapped in Result type.
 * Import path makes intent clear: `import { rsi } from "trendcraft/safe"`
 *
 * @example
 * ```ts
 * import { rsi, unwrapOr } from "trendcraft/safe";
 *
 * const result = rsi(candles, { period: 14 });
 * if (result.ok) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error.code); // "INVALID_PARAMETER" | "INSUFFICIENT_DATA" | ...
 * }
 * ```
 */

export type { Result, TrendCraftError, TrendCraftErrorCode } from "../../types";
// Result type utilities
export { err, flatMap, mapResult, ok, unwrap, unwrapOr } from "../../types";
// Moving Averages
// Momentum
// Volatility
// Volume
// Price
// Trend
// Filter (Ehlers)
export {
  adlSafe as adl,
  andrewsPitchforkSafe as andrewsPitchfork,
  aroonSafe as aroon,
  atrSafe as atr,
  autoTrendLineSafe as autoTrendLine,
  bollingerBandsSafe as bollingerBands,
  breakOfStructureSafe as breakOfStructure,
  cciSafe as cci,
  chandelierExitSafe as chandelierExit,
  changeOfCharacterSafe as changeOfCharacter,
  channelLineSafe as channelLine,
  cmfSafe as cmf,
  cumulativeReturnsSafe as cumulativeReturns,
  dmiSafe as dmi,
  donchianChannelSafe as donchianChannel,
  dpoSafe as dpo,
  emaSafe as ema,
  fairValueGapSafe as fairValueGap,
  fastStochasticsSafe as fastStochastics,
  fibonacciExtensionSafe as fibonacciExtension,
  fibonacciRetracementSafe as fibonacciRetracement,
  fractalsSafe as fractals,
  heikinAshiSafe as heikinAshi,
  highestLowestSafe as highestLowest,
  highestSafe as highest,
  hurstSafe as hurst,
  ichimokuSafe as ichimoku,
  kamaSafe as kama,
  keltnerChannelSafe as keltnerChannel,
  lowestSafe as lowest,
  macdSafe as macd,
  mfiSafe as mfi,
  obvSafe as obv,
  parabolicSarSafe as parabolicSar,
  pivotPointsSafe as pivotPoints,
  returnsSafe as returns,
  rocSafe as roc,
  roofingFilterSafe as roofingFilter,
  rsiSafe as rsi,
  slowStochasticsSafe as slowStochastics,
  smaSafe as sma,
  stochasticsSafe as stochastics,
  stochRsiSafe as stochRsi,
  superSmootherSafe as superSmoother,
  supertrendSafe as supertrend,
  swingPointsSafe as swingPoints,
  t3Safe as t3,
  trixSafe as trix,
  volatilityRegimeSafe as volatilityRegime,
  volumeAnomalySafe as volumeAnomaly,
  volumeMaSafe as volumeMa,
  volumeProfileSafe as volumeProfile,
  volumeTrendSafe as volumeTrend,
  vortexSafe as vortex,
  vwapSafe as vwap,
  vwmaSafe as vwma,
  williamsRSafe as williamsR,
  wmaSafe as wma,
  zigzagSafe as zigzag,
} from "../safe";
