/**
 * Momentum indicators — measure the speed and strength of price movements
 *
 * - **RSI**: Overbought/oversold (default: 70/30)
 * - **MACD**: Trend momentum via moving average convergence/divergence
 * - **Stochastics**: Price position within recent range
 * - **DMI/ADX**: Trend direction and strength
 * - **CCI**: Deviation from statistical mean
 * - **Williams %R**: Similar to Stochastics, inverted scale
 * - **ROC**: Rate of change as percentage
 * - **StochRSI**: RSI applied to Stochastics for extra sensitivity
 * - **Aroon**: Trend strength via time since high/low
 * - **TRIX**: Triple-smoothed EMA rate of change
 * - **DPO**: Detrended price oscillator
 * - **Hurst**: Hurst exponent for trend persistence measurement
 * - **Connors RSI**: Composite momentum oscillator (RSI + streak RSI + ROC percentile)
 *
 * @module
 */
export { rsi } from "./rsi";
export { macd } from "./macd";
export { stochastics, fastStochastics, slowStochastics } from "./stochastics";
export type { StochasticsValue, StochasticsOptions } from "./stochastics";
export { dmi } from "./dmi";
export type { DmiValue, DmiOptions } from "./dmi";
export { stochRsi } from "./stoch-rsi";
export type { StochRsiValue, StochRsiOptions } from "./stoch-rsi";
export { cci } from "./cci";
export type { CciOptions } from "./cci";
export { williamsR } from "./williams-r";
export type { WilliamsROptions } from "./williams-r";
export { roc } from "./roc";
export type { RocOptions } from "./roc";
export { trix } from "./trix";
export type { TrixOptions, TrixValue } from "./trix";
export { aroon } from "./aroon";
export type { AroonOptions, AroonValue } from "./aroon";
export { dpo } from "./dpo";
export type { DpoOptions } from "./dpo";
export { hurst } from "./hurst";
export type { HurstOptions } from "./hurst";
export { connorsRsi } from "./connors-rsi";
export type { ConnorsRsiOptions, ConnorsRsiValue } from "./connors-rsi";
