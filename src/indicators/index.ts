// Moving Averages
export { sma, ema, wma } from "./moving-average";
export type { WmaOptions } from "./moving-average";

// Momentum
export {
  rsi,
  macd,
  stochastics,
  fastStochastics,
  slowStochastics,
  dmi,
  stochRsi,
  cci,
  williamsR,
  roc,
} from "./momentum";
export type {
  StochasticsValue,
  StochasticsOptions,
  DmiValue,
  DmiOptions,
  StochRsiValue,
  StochRsiOptions,
  CciOptions,
  WilliamsROptions,
  RocOptions,
} from "./momentum";

// Volatility
export {
  bollingerBands,
  atr,
  donchianChannel,
  keltnerChannel,
  chandelierExit,
  atrStops,
  calculateAtrStop,
  calculateAtrTakeProfit,
  calculateAtrTrailingStop,
  volatilityRegime,
  // ATR Filter (stock screening)
  calculateAtrPercent,
  atrPercentSeries,
  passesAtrFilter,
  filterStocksByAtr,
  DEFAULT_ATR_THRESHOLD,
} from "./volatility";
export type {
  DonchianValue,
  DonchianOptions,
  KeltnerChannelOptions,
  KeltnerChannelValue,
  AtrFilterOptions,
  AtrFilterResult,
} from "./volatility";

// Volume
export {
  volumeMa,
  obv,
  mfi,
  vwap,
  cmf,
  volumeAnomaly,
  volumeProfile,
  volumeProfileSeries,
  volumeTrend,
} from "./volume";
export type {
  VolumeMaOptions,
  MfiOptions,
  VwapOptions,
  VwapValue,
  CmfOptions,
  VolumeAnomalyOptions,
  VolumeProfileOptions,
  VolumeTrendOptions,
} from "./volume";

// Price
export {
  highestLowest,
  highest,
  lowest,
  returns,
  cumulativeReturns,
  pivotPoints,
  swingPoints,
  getSwingHighs,
  getSwingLows,
  breakOfStructure,
  changeOfCharacter,
  fairValueGap,
  getUnfilledFvgs,
  getNearestFvg,
  fibonacciRetracement,
} from "./price";
export type {
  HighestLowestValue,
  PivotPointsOptions,
  PivotPointsValue,
  SwingPointValue,
  SwingPointOptions,
  BosValue,
  BosOptions,
  FvgValue,
  FvgGap,
  FvgOptions,
  FibonacciRetracementOptions,
  FibonacciRetracementValue,
} from "./price";

// Trend
export { ichimoku, supertrend, parabolicSar } from "./trend";
export type {
  IchimokuOptions,
  IchimokuValue,
  SupertrendOptions,
  SupertrendValue,
  ParabolicSarOptions,
  ParabolicSarValue,
} from "./trend";

// Relative Strength
export {
  benchmarkRS,
  calculateRSRating,
  isOutperforming,
  rankByRS,
  topByRS,
  bottomByRS,
  filterByRSPercentile,
  compareRS,
} from "./relative-strength";
export type {
  RSValue,
  BenchmarkRSOptions,
  SymbolRSRank,
  MultiRSOptions,
} from "./relative-strength";

// Smart Money Concepts (SMC)
export {
  orderBlock,
  getActiveOrderBlocks,
  getNearestOrderBlock,
  liquiditySweep,
  getRecoveredSweeps,
  hasRecentSweepSignal,
} from "./smc";
export type {
  OrderBlock,
  OrderBlockValue,
  OrderBlockOptions,
  LiquiditySweep,
  LiquiditySweepValue,
  LiquiditySweepOptions,
} from "./smc";
