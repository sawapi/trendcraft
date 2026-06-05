/**
 * Incremental Indicator API
 *
 * Stateful indicators that process one candle at a time for O(1) per-update computation.
 * Ideal for real-time trading and streaming data.
 */

export { processAll } from "./bridge";
// Utilities
export { CircularBuffer } from "./circular-buffer";
export type { RoofingFilterState } from "./filter/roofing-filter";
export { createRoofingFilter } from "./filter/roofing-filter";
export type { SuperSmootherState } from "./filter/super-smoother";
// Filter (Ehlers)
export { createSuperSmoother } from "./filter/super-smoother";
export type { AdxrState } from "./momentum/adxr";
export { createAdxr } from "./momentum/adxr";
export type { AroonState, AroonValue as IncrementalAroonValue } from "./momentum/aroon";
export { createAroon } from "./momentum/aroon";
export type { AwesomeOscillatorState } from "./momentum/awesome-oscillator";
export { createAwesomeOscillator } from "./momentum/awesome-oscillator";
export type { BalanceOfPowerState } from "./momentum/balance-of-power";
export { createBalanceOfPower } from "./momentum/balance-of-power";
export type { CciState } from "./momentum/cci";
export { createCci } from "./momentum/cci";
export type { CmoState } from "./momentum/cmo";
export { createCmo } from "./momentum/cmo";
export type {
  ConnorsRsiState,
  ConnorsRsiValue as IncrementalConnorsRsiValue,
} from "./momentum/connors-rsi";
export { createConnorsRsi } from "./momentum/connors-rsi";
export type { CoppockCurveState } from "./momentum/coppock-curve";
export { createCoppockCurve } from "./momentum/coppock-curve";
export type { DmiState, DmiValue } from "./momentum/dmi";
export { createDmi } from "./momentum/dmi";
export type { DpoState } from "./momentum/dpo";
export { createDpo } from "./momentum/dpo";
export type { HurstState } from "./momentum/hurst";
export { createHurst } from "./momentum/hurst";
export type { ImiState as IncrementalImiState } from "./momentum/imi";
export { createImi } from "./momentum/imi";
export type { KstState, KstValue as IncrementalKstValue } from "./momentum/kst";
export { createKst } from "./momentum/kst";
export type { MacdState } from "./momentum/macd";
export { createMacd } from "./momentum/macd";
export type { MassIndexState } from "./momentum/mass-index";
export { createMassIndex } from "./momentum/mass-index";
export type { PpoState, PpoValue as IncrementalPpoValue } from "./momentum/ppo";
export { createPpo } from "./momentum/ppo";
export type { QStickState } from "./momentum/qstick";
export { createQStick } from "./momentum/qstick";
export type { RocState } from "./momentum/roc";
export { createRoc } from "./momentum/roc";
export type { RsiState } from "./momentum/rsi";
// Momentum (includes TRIX)
export { createRsi } from "./momentum/rsi";
export type { StcState } from "./momentum/schaff-trend-cycle";
export { createStc } from "./momentum/schaff-trend-cycle";
export type { StochRsiState, StochRsiValue } from "./momentum/stoch-rsi";
export { createStochRsi } from "./momentum/stoch-rsi";
export type { StochasticsState, StochasticsValue } from "./momentum/stochastics";
export { createStochastics } from "./momentum/stochastics";
export type { TrixState, TrixValue as IncrementalTrixValue } from "./momentum/trix";
export { createTrix } from "./momentum/trix";
export type { TsiState, TsiValue as IncrementalTsiValue } from "./momentum/tsi";
export { createTsi } from "./momentum/tsi";
export type { UltimateOscillatorState } from "./momentum/ultimate-oscillator";
export { createUltimateOscillator } from "./momentum/ultimate-oscillator";
export type { VortexState, VortexValue as IncrementalVortexValue } from "./momentum/vortex";
export { createVortex } from "./momentum/vortex";
export type { WilliamsRState } from "./momentum/williams-r";
export { createWilliamsR } from "./momentum/williams-r";
export type { AlmaState } from "./moving-average/alma";
export { createAlma } from "./moving-average/alma";
export type { DemaState } from "./moving-average/dema";
export { createDema } from "./moving-average/dema";
export type { EmaState } from "./moving-average/ema";
export { createEma } from "./moving-average/ema";
export type { EmaRibbonState, EmaRibbonValue } from "./moving-average/ema-ribbon";
export { createEmaRibbon } from "./moving-average/ema-ribbon";
export type { FramaState } from "./moving-average/frama";
export { createFrama } from "./moving-average/frama";
export type { HmaState } from "./moving-average/hma";
export { createHma } from "./moving-average/hma";
export type { KamaState } from "./moving-average/kama";
export { createKama } from "./moving-average/kama";
export type { McGinleyDynamicState } from "./moving-average/mcginley-dynamic";
export { createMcGinleyDynamic } from "./moving-average/mcginley-dynamic";
export type { SmaState } from "./moving-average/sma";
// Moving Averages
export { createSma } from "./moving-average/sma";
export type { T3State } from "./moving-average/t3";
export { createT3 } from "./moving-average/t3";
export type { TemaState } from "./moving-average/tema";
export { createTema } from "./moving-average/tema";
export type { VwmaState } from "./moving-average/vwma";
export { createVwma } from "./moving-average/vwma";
export type { WmaState } from "./moving-average/wma";
export { createWma } from "./moving-average/wma";
export type { ZlemaState } from "./moving-average/zlema";
export { createZlema } from "./moving-average/zlema";
export type {
  AutoTrendLineOptions,
  AutoTrendLineState,
  AutoTrendLineValue as IncrementalAutoTrendLineValue,
} from "./price/auto-trend-line";
export { createAutoTrendLine } from "./price/auto-trend-line";
export type {
  BosState,
  BosValue as IncrementalBosValue,
  ChochState,
} from "./price/break-of-structure";
export {
  createBreakOfStructure,
  createChangeOfCharacter,
} from "./price/break-of-structure";
export type {
  ChannelLineOptions,
  ChannelLineState,
  ChannelLineValue as IncrementalChannelLineValue,
} from "./price/channel-line";
export { createChannelLine } from "./price/channel-line";
export type { FairValueGapState, FvgValue as IncrementalFvgValue } from "./price/fair-value-gap";
export { createFairValueGap } from "./price/fair-value-gap";
export type {
  FibonacciExtensionOptions,
  FibonacciExtensionState,
  FibonacciExtensionValue as IncrementalFibonacciExtensionValue,
} from "./price/fibonacci-extension";
export { createFibonacciExtension } from "./price/fibonacci-extension";
export type {
  FibonacciRetracementOptions,
  FibonacciRetracementState,
  FibonacciRetracementValue as IncrementalFibonacciRetracementValue,
} from "./price/fibonacci-retracement";
export { createFibonacciRetracement } from "./price/fibonacci-retracement";
export type { FractalsState, FractalValue as IncrementalFractalValue } from "./price/fractals";
export { createFractals } from "./price/fractals";
export type { GapAnalysisState, GapValue as IncrementalGapValue } from "./price/gap-analysis";
export { createGapAnalysis } from "./price/gap-analysis";
export type {
  HeikinAshiState,
  HeikinAshiValue as IncrementalHeikinAshiValue,
} from "./price/heikin-ashi";
export { createHeikinAshi } from "./price/heikin-ashi";
export type {
  HighestLowestState,
  HighestLowestValue as IncrementalHighestLowestValue,
} from "./price/highest-lowest";
// Price
export { createHighestLowest } from "./price/highest-lowest";
export type {
  OpeningRangeState,
  OpeningRangeValue as IncrementalOpeningRangeValue,
} from "./price/opening-range";
export { createOpeningRange } from "./price/opening-range";
export type {
  PivotPointsState,
  PivotPointsValue as IncrementalPivotPointsValue,
} from "./price/pivot-points";
export { createPivotPoints } from "./price/pivot-points";
export type { ReturnsState } from "./price/returns";
export { createReturns } from "./price/returns";
export type {
  SwingPointsState,
  SwingPointValue as IncrementalSwingPointValue,
} from "./price/swing-points";
export { createSwingPoints } from "./price/swing-points";
export type {
  ZigzagState,
  ZigzagValue as IncrementalZigzagValue,
} from "./price/zigzag";
export { createZigzag } from "./price/zigzag";
export type {
  LiquiditySweep as IncrementalLiquiditySweep,
  LiquiditySweepOptions,
  LiquiditySweepState,
  LiquiditySweepValue as IncrementalLiquiditySweepValue,
} from "./smc/liquidity-sweep";
// SMC
export { createLiquiditySweep } from "./smc/liquidity-sweep";
// State Contract — the versioned envelope every `getState()` returns and
// every `fromState` accepts. Exported so TypeScript consumers can name
// the snapshot type. (Distinct from the looser `streaming` snapshot
// type of the same name; this is the per-indicator state envelope.)
export type { IndicatorSnapshot, SnapshotMeta } from "./state-contract";
export type { IchimokuState, IchimokuValue as IncrementalIchimokuValue } from "./trend/ichimoku";
export { createIchimoku } from "./trend/ichimoku";
export type {
  LinearRegressionState,
  LinearRegressionValue as IncrementalLinearRegressionValue,
} from "./trend/linear-regression";
export { createLinearRegression } from "./trend/linear-regression";
export type { ParabolicSarState, ParabolicSarValue } from "./trend/parabolic-sar";
export { createParabolicSar } from "./trend/parabolic-sar";
export type { SupertrendState, SupertrendValue } from "./trend/supertrend";
// Trend
export { createSupertrend } from "./trend/supertrend";
// Types
export type { IncrementalIndicator, WarmUpOptions } from "./types";
export { restoreState } from "./types";
export { getSourcePrice, makeCandle } from "./utils";
export type { AtrState } from "./volatility/atr";
// Volatility
export { createAtr } from "./volatility/atr";
export type { AtrStopsState } from "./volatility/atr-stops";
export { createAtrStops } from "./volatility/atr-stops";
export type { BollingerBandsState } from "./volatility/bollinger-bands";
export { createBollingerBands } from "./volatility/bollinger-bands";
export type { ChandelierExitState } from "./volatility/chandelier-exit";
export { createChandelierExit } from "./volatility/chandelier-exit";
export type { ChoppinessIndexState } from "./volatility/choppiness-index";
export { createChoppinessIndex } from "./volatility/choppiness-index";
export type { DonchianState, DonchianValue } from "./volatility/donchian-channel";
export { createDonchianChannel } from "./volatility/donchian-channel";
export type { EwmaVolatilityState } from "./volatility/ewma-volatility";
export { createEwmaVolatility } from "./volatility/ewma-volatility";
export type { GarmanKlassState } from "./volatility/garman-klass";
export { createGarmanKlass } from "./volatility/garman-klass";
export type { HistoricalVolatilityState } from "./volatility/historical-volatility";
export { createHistoricalVolatility } from "./volatility/historical-volatility";
export type { KeltnerChannelState, KeltnerChannelValue } from "./volatility/keltner-channel";
export { createKeltnerChannel } from "./volatility/keltner-channel";
export type { RegimeOptions, RegimeState, RegimeValue } from "./volatility/regime";
export { createRegime } from "./volatility/regime";
export type { StandardDeviationState } from "./volatility/standard-deviation";
export { createStandardDeviation } from "./volatility/standard-deviation";
export type { UlcerIndexState } from "./volatility/ulcer-index";
export { createUlcerIndex } from "./volatility/ulcer-index";
export type { AdlState } from "./volume/adl";
export { createAdl } from "./volume/adl";
export type {
  AnchoredVwapState,
  AnchoredVwapValue as IncrementalAnchoredVwapValue,
} from "./volume/anchored-vwap";
export { createAnchoredVwap } from "./volume/anchored-vwap";
export type { CmfState } from "./volume/cmf";
export { createCmf } from "./volume/cmf";
export type { CvdState } from "./volume/cvd";
export { createCvd } from "./volume/cvd";
export type { EmvState } from "./volume/ease-of-movement";
export { createEmv } from "./volume/ease-of-movement";
export type { ElderForceIndexState } from "./volume/elder-force-index";
export { createElderForceIndex } from "./volume/elder-force-index";
export type { KlingerState, KlingerValue as IncrementalKlingerValue } from "./volume/klinger";
export { createKlinger } from "./volume/klinger";
export type { MfiState } from "./volume/mfi";
export { createMfi } from "./volume/mfi";
export type { NviState } from "./volume/nvi";
export { createNvi } from "./volume/nvi";
export type { ObvState } from "./volume/obv";
// Volume
export { createObv } from "./volume/obv";
export type { PvtState } from "./volume/pvt";
export { createPvt } from "./volume/pvt";
export type { TwapState } from "./volume/twap";
export { createTwap } from "./volume/twap";
export type { VolumeAnomalyState } from "./volume/volume-anomaly";
export { createVolumeAnomaly } from "./volume/volume-anomaly";
export type { VolumeTrendState } from "./volume/volume-trend";
export { createVolumeTrend } from "./volume/volume-trend";
export type { VwapState, VwapValue } from "./volume/vwap";
export { createVwap } from "./volume/vwap";
export type { WeisWaveState, WeisWaveValue as IncrementalWeisWaveValue } from "./volume/weis-wave";
export { createWeisWave } from "./volume/weis-wave";
export type { VsaState, VsaValue as IncrementalVsaValue } from "./wyckoff/vsa";
// Wyckoff
export { createVsa } from "./wyckoff/vsa";
