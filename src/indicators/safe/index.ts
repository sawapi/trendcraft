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

// Moving Averages
export { smaSafe as sma } from "../safe";
export { emaSafe as ema } from "../safe";
export { wmaSafe as wma } from "../safe";
export { vwmaSafe as vwma } from "../safe";
export { kamaSafe as kama } from "../safe";
export { t3Safe as t3 } from "../safe";

// Momentum
export { rsiSafe as rsi } from "../safe";
export { macdSafe as macd } from "../safe";
export { stochasticsSafe as stochastics } from "../safe";
export { fastStochasticsSafe as fastStochastics } from "../safe";
export { slowStochasticsSafe as slowStochastics } from "../safe";
export { dmiSafe as dmi } from "../safe";
export { stochRsiSafe as stochRsi } from "../safe";
export { cciSafe as cci } from "../safe";
export { williamsRSafe as williamsR } from "../safe";
export { rocSafe as roc } from "../safe";
export { trixSafe as trix } from "../safe";
export { aroonSafe as aroon } from "../safe";
export { dpoSafe as dpo } from "../safe";
export { hurstSafe as hurst } from "../safe";

// Volatility
export { bollingerBandsSafe as bollingerBands } from "../safe";
export { atrSafe as atr } from "../safe";
export { donchianChannelSafe as donchianChannel } from "../safe";
export { keltnerChannelSafe as keltnerChannel } from "../safe";
export { chandelierExitSafe as chandelierExit } from "../safe";
export { volatilityRegimeSafe as volatilityRegime } from "../safe";

// Volume
export { volumeMaSafe as volumeMa } from "../safe";
export { obvSafe as obv } from "../safe";
export { mfiSafe as mfi } from "../safe";
export { vwapSafe as vwap } from "../safe";
export { cmfSafe as cmf } from "../safe";
export { volumeAnomalySafe as volumeAnomaly } from "../safe";
export { volumeProfileSafe as volumeProfile } from "../safe";
export { volumeTrendSafe as volumeTrend } from "../safe";
export { adlSafe as adl } from "../safe";

// Price
export { highestLowestSafe as highestLowest } from "../safe";
export { highestSafe as highest } from "../safe";
export { lowestSafe as lowest } from "../safe";
export { returnsSafe as returns } from "../safe";
export { cumulativeReturnsSafe as cumulativeReturns } from "../safe";
export { pivotPointsSafe as pivotPoints } from "../safe";
export { swingPointsSafe as swingPoints } from "../safe";
export { breakOfStructureSafe as breakOfStructure } from "../safe";
export { changeOfCharacterSafe as changeOfCharacter } from "../safe";
export { fairValueGapSafe as fairValueGap } from "../safe";
export { fibonacciRetracementSafe as fibonacciRetracement } from "../safe";
export { autoTrendLineSafe as autoTrendLine } from "../safe";
export { channelLineSafe as channelLine } from "../safe";
export { fibonacciExtensionSafe as fibonacciExtension } from "../safe";
export { andrewsPitchforkSafe as andrewsPitchfork } from "../safe";
export { heikinAshiSafe as heikinAshi } from "../safe";
export { fractalsSafe as fractals } from "../safe";
export { zigzagSafe as zigzag } from "../safe";

// Trend
export { ichimokuSafe as ichimoku } from "../safe";
export { supertrendSafe as supertrend } from "../safe";
export { parabolicSarSafe as parabolicSar } from "../safe";
export { vortexSafe as vortex } from "../safe";

// Filter (Ehlers)
export { superSmootherSafe as superSmoother } from "../safe";
export { roofingFilterSafe as roofingFilter } from "../safe";

// Result type utilities
export { ok, err, unwrap, unwrapOr, mapResult, flatMap } from "../../types";
export type { Result, TrendCraftError, TrendCraftErrorCode } from "../../types";
