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

export type { AdxrOptions } from "./adxr";
export { adxr } from "./adxr";
export type { AroonOptions, AroonValue } from "./aroon";
export { aroon } from "./aroon";
export type { AwesomeOscillatorOptions } from "./awesome-oscillator";
export { awesomeOscillator } from "./awesome-oscillator";
export type { BalanceOfPowerOptions } from "./balance-of-power";
export { balanceOfPower } from "./balance-of-power";
export type { CciOptions } from "./cci";
export { cci } from "./cci";
export type { CmoOptions } from "./cmo";
export { cmo } from "./cmo";
export type { ConnorsRsiOptions, ConnorsRsiValue } from "./connors-rsi";
export { connorsRsi } from "./connors-rsi";
export type { CoppockCurveOptions } from "./coppock-curve";
export { coppockCurve } from "./coppock-curve";
export type { DmiOptions, DmiValue } from "./dmi";
export { dmi } from "./dmi";
export type { DpoOptions } from "./dpo";
export { dpo } from "./dpo";
export type { HurstOptions } from "./hurst";
export { hurst } from "./hurst";
export type { ImiOptions } from "./imi";
export { imi } from "./imi";
export type { KstOptions, KstValue } from "./kst";
export { kst } from "./kst";
export { macd } from "./macd";
export type { MassIndexOptions } from "./mass-index";
export { massIndex } from "./mass-index";
export type { PpoOptions, PpoValue } from "./ppo";
export { ppo } from "./ppo";
export type { QstickOptions } from "./qstick";
export { qstick } from "./qstick";
export type { RocOptions } from "./roc";
export { roc } from "./roc";
export { rsi } from "./rsi";
export type { StochRsiOptions, StochRsiValue } from "./stoch-rsi";
export { stochRsi } from "./stoch-rsi";
export type { StochasticsOptions, StochasticsValue } from "./stochastics";
export { fastStochastics, slowStochastics, stochastics } from "./stochastics";
export type { TrixOptions, TrixValue } from "./trix";
export { trix } from "./trix";
export type { TsiOptions, TsiValue } from "./tsi";
export { tsi } from "./tsi";
export type { UltimateOscillatorOptions } from "./ultimate-oscillator";
export { ultimateOscillator } from "./ultimate-oscillator";
export type { WilliamsROptions } from "./williams-r";
export { williamsR } from "./williams-r";
