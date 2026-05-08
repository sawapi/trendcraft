/**
 * Price-derived indicators — structural analysis of price action
 *
 * - **Highest/Lowest**: N-period high/low values
 * - **Returns**: Simple and cumulative returns
 * - **Pivot Points**: Support/resistance from prior period OHLC
 * - **Swing Points**: Local highs and lows for structure analysis
 * - **BOS/CHoCH**: Break of Structure / Change of Character (SMC)
 * - **Fair Value Gap (FVG)**: Imbalance zones in price action
 * - **Fibonacci Retracement/Extension**: Key retracement and extension levels
 * - **Auto Trend Line**: Automatically detected trend lines
 * - **Channel Line**: Parallel channel detection
 * - **Andrews Pitchfork**: Median line channel tool
 * - **Heikin-Ashi**: Smoothed candlestick representation
 * - **Fractals**: Williams fractals for reversal points
 * - **Zigzag**: Significant price movements filter
 * - **Opening Range**: Opening range breakout detection
 * - **Gap Analysis**: Price gap detection and fill tracking
 *
 * @module
 */

export type { AndrewsPitchforkOptions, AndrewsPitchforkValue } from "./andrews-pitchfork";
export { andrewsPitchfork } from "./andrews-pitchfork";
export type { AutoTrendLineOptions, AutoTrendLineValue } from "./auto-trend-line";
export { autoTrendLine } from "./auto-trend-line";
export type { BosOptions, BosValue } from "./break-of-structure";
export { breakOfStructure, changeOfCharacter } from "./break-of-structure";
export type { ChannelLineOptions, ChannelLineValue } from "./channel-line";
export { channelLine } from "./channel-line";
export type { FvgGap, FvgOptions, FvgValue } from "./fair-value-gap";
export { fairValueGap, getNearestFvg, getUnfilledFvgs } from "./fair-value-gap";
export type { FibonacciExtensionOptions, FibonacciExtensionValue } from "./fibonacci-extension";
export { fibonacciExtension } from "./fibonacci-extension";
export type {
  FibonacciRetracementOptions,
  FibonacciRetracementValue,
} from "./fibonacci-retracement";
export { fibonacciRetracement } from "./fibonacci-retracement";
export type { FractalOptions, FractalValue } from "./fractals";
export { fractals } from "./fractals";
export type { GapAnalysisOptions, GapValue } from "./gap-analysis";
export { gapAnalysis } from "./gap-analysis";
export type { HeikinAshiValue } from "./heikin-ashi";
export { heikinAshi } from "./heikin-ashi";
export type { HighestLowestValue } from "./highest-lowest";
export { highest, highestLowest, lowest } from "./highest-lowest";
export { medianPrice, typicalPrice, weightedClose } from "./median-price";
export type { OpeningRangeOptions, OpeningRangeValue } from "./opening-range";
export { openingRange } from "./opening-range";
export type { PivotPointsOptions, PivotPointsValue } from "./pivot-points";
export { pivotPoints } from "./pivot-points";
export { cumulativeReturns, returns } from "./returns";
export type { PriceLevelSource, SrZone, SrZonesOptions, SrZonesResult } from "./sr-zones";
export { srZones, srZonesSeries } from "./sr-zones";
export type { AlternatingSwingPoint, SwingPointOptions, SwingPointValue } from "./swing-points";
export {
  getAlternatingSwingPoints,
  getSwingHighs,
  getSwingLows,
  swingPoints,
} from "./swing-points";
export type { ZigzagOptions, ZigzagValue } from "./zigzag";
export { zigzag } from "./zigzag";
