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
export { bollingerBands } from "./bollinger-bands";
export { atr } from "./atr";
export { donchianChannel } from "./donchian-channel";
export type { DonchianValue, DonchianOptions } from "./donchian-channel";
export { keltnerChannel } from "./keltner-channel";
export type { KeltnerChannelOptions, KeltnerChannelValue } from "./keltner-channel";
export { chandelierExit } from "./chandelier-exit";
export {
  atrStops,
  calculateAtrStop,
  calculateAtrTakeProfit,
  calculateAtrTrailingStop,
} from "./atr-stops";
export { volatilityRegime } from "./regime";
export {
  calculateAtrPercent,
  atrPercentSeries,
  passesAtrFilter,
  filterStocksByAtr,
  DEFAULT_ATR_THRESHOLD,
} from "./atr-filter";
export type { AtrFilterOptions, AtrFilterResult } from "./atr-filter";
export { choppinessIndex } from "./choppiness-index";
export type { ChoppinessIndexOptions } from "./choppiness-index";
export { ulcerIndex } from "./ulcer-index";
export type { UlcerIndexOptions } from "./ulcer-index";
export { historicalVolatility } from "./historical-volatility";
export type { HistoricalVolatilityOptions } from "./historical-volatility";
export { garmanKlass } from "./garman-klass";
export type { GarmanKlassOptions } from "./garman-klass";
export { standardDeviation } from "./standard-deviation";
export type { StandardDeviationOptions } from "./standard-deviation";
export { garch, ewmaVolatility, ewmaVolatilityFromCandles } from "./garch";
export type {
  GarchOptions,
  GarchResult,
  EwmaVolatilityOptions,
  EwmaVolatilityFromCandlesOptions,
} from "./garch";
