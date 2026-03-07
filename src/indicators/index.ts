// Moving Averages
export { sma, ema, wma, vwma, kama, t3 } from "./moving-average";
export type { WmaOptions, VwmaOptions, KamaOptions, T3Options } from "./moving-average";

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
  trix,
  aroon,
  dpo,
  hurst,
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
  TrixOptions,
  TrixValue,
  AroonOptions,
  AroonValue,
  DpoOptions,
  HurstOptions,
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
  adl,
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
  getAlternatingSwingPoints,
  breakOfStructure,
  changeOfCharacter,
  fairValueGap,
  getUnfilledFvgs,
  getNearestFvg,
  fibonacciRetracement,
  autoTrendLine,
  channelLine,
  fibonacciExtension,
  andrewsPitchfork,
  heikinAshi,
  fractals,
  zigzag,
} from "./price";
export type {
  HighestLowestValue,
  PivotPointsOptions,
  PivotPointsValue,
  SwingPointValue,
  SwingPointOptions,
  AlternatingSwingPoint,
  BosValue,
  BosOptions,
  FvgValue,
  FvgGap,
  FvgOptions,
  FibonacciRetracementOptions,
  FibonacciRetracementValue,
  AutoTrendLineOptions,
  AutoTrendLineValue,
  ChannelLineOptions,
  ChannelLineValue,
  FibonacciExtensionOptions,
  FibonacciExtensionValue,
  AndrewsPitchforkOptions,
  AndrewsPitchforkValue,
  HeikinAshiValue,
  FractalValue,
  FractalOptions,
  ZigzagValue,
  ZigzagOptions,
} from "./price";

// Trend
export { ichimoku, supertrend, parabolicSar, vortex } from "./trend";
export type {
  IchimokuOptions,
  IchimokuValue,
  SupertrendOptions,
  SupertrendValue,
  ParabolicSarOptions,
  ParabolicSarValue,
  VortexOptions,
  VortexValue,
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

// Filter (Ehlers)
export { superSmoother, roofingFilter } from "./filter";
export type { SuperSmootherOptions, RoofingFilterOptions } from "./filter";

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

