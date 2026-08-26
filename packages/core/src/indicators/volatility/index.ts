/**
 * Volatility indicators — measure price dispersion and risk
 *
 * - **Bollinger Bands**: Price channels based on standard deviation
 * - **ATR**: Average True Range — volatility in absolute terms
 * - **Donchian Channel**: Highest high / lowest low over N periods
 * - **Keltner Channel**: ATR-based price channel around EMA
 * - **Chandelier Exit**: Trailing stop based on ATR from highest high
 * - **ATR Stops**: Stop-loss and take-profit levels based on ATR
 * - **Volatility Regime**: Classify market as low/normal/high/extreme volatility
 * - **ATR Filter**: Filter stocks by ATR% for screening
 * - **Choppiness Index**: Measure whether the market is choppy or trending
 *
 * @module
 */

export { atr } from "./atr";
export type { AtrFilterOptions, AtrFilterResult, AtrPercentDetail } from "./atr-filter";
export {
  atrPercentSeries,
  calculateAtrPercent,
  calculateAtrPercentDetail,
  DEFAULT_ATR_THRESHOLD,
  filterStocksByAtr,
  passesAtrFilter,
} from "./atr-filter";
export {
  atrStops,
  calculateAtrStop,
  calculateAtrTakeProfit,
  calculateAtrTrailingStop,
} from "./atr-stops";
export { bollingerBands } from "./bollinger-bands";
export { chandelierExit } from "./chandelier-exit";
export type { ChoppinessIndexOptions } from "./choppiness-index";
export { choppinessIndex } from "./choppiness-index";
export type { DonchianOptions, DonchianValue } from "./donchian-channel";
export { donchianChannel } from "./donchian-channel";
export type {
  EwmaVolatilityFromCandlesOptions,
  EwmaVolatilityOptions,
  GarchOptions,
  GarchResult,
} from "./garch";
export { ewmaVolatility, ewmaVolatilityFromCandles, garch } from "./garch";
export type { GarmanKlassOptions } from "./garman-klass";
export { garmanKlass } from "./garman-klass";
export type { HistoricalVolatilityOptions } from "./historical-volatility";
export { historicalVolatility } from "./historical-volatility";
export type { KeltnerChannelOptions, KeltnerChannelValue } from "./keltner-channel";
export { keltnerChannel } from "./keltner-channel";
export { volatilityRegime } from "./regime";
export type { StandardDeviationOptions } from "./standard-deviation";
export { standardDeviation } from "./standard-deviation";
export type { UlcerIndexOptions } from "./ulcer-index";
export { ulcerIndex } from "./ulcer-index";
