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
export { highestLowest, highest, lowest } from "./highest-lowest";
export type { HighestLowestValue } from "./highest-lowest";
export { returns, cumulativeReturns } from "./returns";
export { pivotPoints } from "./pivot-points";
export type { PivotPointsOptions, PivotPointsValue } from "./pivot-points";
export { swingPoints, getSwingHighs, getSwingLows } from "./swing-points";
export type { SwingPointValue, SwingPointOptions } from "./swing-points";
export { breakOfStructure, changeOfCharacter } from "./break-of-structure";
export type { BosValue, BosOptions } from "./break-of-structure";
export { fairValueGap, getUnfilledFvgs, getNearestFvg } from "./fair-value-gap";
export type { FvgValue, FvgGap, FvgOptions } from "./fair-value-gap";
export { fibonacciRetracement } from "./fibonacci-retracement";
export type {
  FibonacciRetracementOptions,
  FibonacciRetracementValue,
} from "./fibonacci-retracement";
export { autoTrendLine } from "./auto-trend-line";
export type { AutoTrendLineOptions, AutoTrendLineValue } from "./auto-trend-line";
export { channelLine } from "./channel-line";
export type { ChannelLineOptions, ChannelLineValue } from "./channel-line";
export { fibonacciExtension } from "./fibonacci-extension";
export type { FibonacciExtensionOptions, FibonacciExtensionValue } from "./fibonacci-extension";
export { andrewsPitchfork } from "./andrews-pitchfork";
export type { AndrewsPitchforkOptions, AndrewsPitchforkValue } from "./andrews-pitchfork";
export { getAlternatingSwingPoints } from "./swing-points";
export type { AlternatingSwingPoint } from "./swing-points";
export { heikinAshi } from "./heikin-ashi";
export type { HeikinAshiValue } from "./heikin-ashi";
export { fractals } from "./fractals";
export type { FractalValue, FractalOptions } from "./fractals";
export { zigzag } from "./zigzag";
export type { ZigzagValue, ZigzagOptions } from "./zigzag";
export { openingRange } from "./opening-range";
export type { OpeningRangeOptions, OpeningRangeValue } from "./opening-range";
export { gapAnalysis } from "./gap-analysis";
export type { GapAnalysisOptions, GapValue } from "./gap-analysis";
export { medianPrice, typicalPrice, weightedClose } from "./median-price";
