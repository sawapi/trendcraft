/**
 * Incremental Indicator API
 *
 * Stateful indicators that process one candle at a time for O(1) per-update computation.
 * Ideal for real-time trading and streaming data.
 */

// Types
export type { IncrementalIndicator, WarmUpOptions } from "./types";
export { restoreState } from "./types";

// Utilities
export { CircularBuffer } from "./circular-buffer";
export { processAll } from "./bridge";
export { getSourcePrice, makeCandle } from "./utils";

// Moving Averages
export { createSma } from "./moving-average/sma";
export type { SmaState } from "./moving-average/sma";
export { createEma } from "./moving-average/ema";
export type { EmaState } from "./moving-average/ema";
export { createWma } from "./moving-average/wma";
export type { WmaState } from "./moving-average/wma";
export { createVwma } from "./moving-average/vwma";
export type { VwmaState } from "./moving-average/vwma";
export { createKama } from "./moving-average/kama";
export type { KamaState } from "./moving-average/kama";
export { createHma } from "./moving-average/hma";
export type { HmaState } from "./moving-average/hma";
export { createT3 } from "./moving-average/t3";
export type { T3State } from "./moving-average/t3";
export { createMcGinleyDynamic } from "./moving-average/mcginley-dynamic";
export type { McGinleyDynamicState } from "./moving-average/mcginley-dynamic";
export { createEmaRibbon } from "./moving-average/ema-ribbon";
export type { EmaRibbonState, EmaRibbonValue } from "./moving-average/ema-ribbon";
export { createDema } from "./moving-average/dema";
export type { DemaState } from "./moving-average/dema";
export { createTema } from "./moving-average/tema";
export type { TemaState } from "./moving-average/tema";
export { createZlema } from "./moving-average/zlema";
export type { ZlemaState } from "./moving-average/zlema";
export { createAlma } from "./moving-average/alma";
export type { AlmaState } from "./moving-average/alma";
export { createFrama } from "./moving-average/frama";
export type { FramaState } from "./moving-average/frama";

// Momentum (includes TRIX)
export { createRsi } from "./momentum/rsi";
export type { RsiState } from "./momentum/rsi";
export { createMacd } from "./momentum/macd";
export type { MacdState } from "./momentum/macd";
export { createStochastics } from "./momentum/stochastics";
export type { StochasticsState, StochasticsValue } from "./momentum/stochastics";
export { createDmi } from "./momentum/dmi";
export type { DmiState, DmiValue } from "./momentum/dmi";
export { createRoc } from "./momentum/roc";
export type { RocState } from "./momentum/roc";
export { createWilliamsR } from "./momentum/williams-r";
export type { WilliamsRState } from "./momentum/williams-r";
export { createCci } from "./momentum/cci";
export type { CciState } from "./momentum/cci";
export { createStochRsi } from "./momentum/stoch-rsi";
export type { StochRsiState, StochRsiValue } from "./momentum/stoch-rsi";
export { createTrix } from "./momentum/trix";
export type { TrixState, TrixValue as IncrementalTrixValue } from "./momentum/trix";
export { createAroon } from "./momentum/aroon";
export type { AroonState, AroonValue as IncrementalAroonValue } from "./momentum/aroon";
export { createConnorsRsi } from "./momentum/connors-rsi";
export type {
  ConnorsRsiState,
  ConnorsRsiValue as IncrementalConnorsRsiValue,
} from "./momentum/connors-rsi";
export { createCmo } from "./momentum/cmo";
export type { CmoState } from "./momentum/cmo";
export { createAdxr } from "./momentum/adxr";
export type { AdxrState } from "./momentum/adxr";
export { createImi } from "./momentum/imi";
export type { ImiState as IncrementalImiState } from "./momentum/imi";
export { createVortex } from "./momentum/vortex";
export type { VortexState, VortexValue as IncrementalVortexValue } from "./momentum/vortex";
export { createAwesomeOscillator } from "./momentum/awesome-oscillator";
export type { AwesomeOscillatorState } from "./momentum/awesome-oscillator";
export { createBalanceOfPower } from "./momentum/balance-of-power";
export type { BalanceOfPowerState } from "./momentum/balance-of-power";
export { createQStick } from "./momentum/qstick";
export type { QStickState } from "./momentum/qstick";
export { createPpo } from "./momentum/ppo";
export type { PpoState, PpoValue as IncrementalPpoValue } from "./momentum/ppo";
export { createCoppockCurve } from "./momentum/coppock-curve";
export type { CoppockCurveState } from "./momentum/coppock-curve";
export { createMassIndex } from "./momentum/mass-index";
export type { MassIndexState } from "./momentum/mass-index";
export { createDpo } from "./momentum/dpo";
export type { DpoState } from "./momentum/dpo";
export { createUltimateOscillator } from "./momentum/ultimate-oscillator";
export type { UltimateOscillatorState } from "./momentum/ultimate-oscillator";
export { createTsi } from "./momentum/tsi";
export type { TsiState, TsiValue as IncrementalTsiValue } from "./momentum/tsi";
export { createKst } from "./momentum/kst";
export type { KstState, KstValue as IncrementalKstValue } from "./momentum/kst";
export { createHurst } from "./momentum/hurst";
export type { HurstState } from "./momentum/hurst";
export { createStc } from "./momentum/schaff-trend-cycle";
export type { StcState } from "./momentum/schaff-trend-cycle";

// Volatility
export { createAtr } from "./volatility/atr";
export type { AtrState } from "./volatility/atr";
export { createBollingerBands } from "./volatility/bollinger-bands";
export type { BollingerBandsState } from "./volatility/bollinger-bands";
export { createDonchianChannel } from "./volatility/donchian-channel";
export type { DonchianState, DonchianValue } from "./volatility/donchian-channel";
export { createKeltnerChannel } from "./volatility/keltner-channel";
export type { KeltnerChannelState, KeltnerChannelValue } from "./volatility/keltner-channel";
export { createRegime } from "./volatility/regime";
export type { RegimeState, RegimeValue, RegimeOptions } from "./volatility/regime";
export { createChandelierExit } from "./volatility/chandelier-exit";
export type { ChandelierExitState } from "./volatility/chandelier-exit";
export { createChoppinessIndex } from "./volatility/choppiness-index";
export type { ChoppinessIndexState } from "./volatility/choppiness-index";
export { createEwmaVolatility } from "./volatility/ewma-volatility";
export type { EwmaVolatilityState } from "./volatility/ewma-volatility";
export { createGarmanKlass } from "./volatility/garman-klass";
export type { GarmanKlassState } from "./volatility/garman-klass";
export { createHistoricalVolatility } from "./volatility/historical-volatility";
export type { HistoricalVolatilityState } from "./volatility/historical-volatility";
export { createAtrStops } from "./volatility/atr-stops";
export type { AtrStopsState } from "./volatility/atr-stops";
export { createUlcerIndex } from "./volatility/ulcer-index";
export type { UlcerIndexState } from "./volatility/ulcer-index";
export { createStandardDeviation } from "./volatility/standard-deviation";
export type { StandardDeviationState } from "./volatility/standard-deviation";

// Filter (Ehlers)
export { createSuperSmoother } from "./filter/super-smoother";
export type { SuperSmootherState } from "./filter/super-smoother";
export { createRoofingFilter } from "./filter/roofing-filter";
export type { RoofingFilterState } from "./filter/roofing-filter";

// Trend
export { createSupertrend } from "./trend/supertrend";
export type { SupertrendState, SupertrendValue } from "./trend/supertrend";
export { createParabolicSar } from "./trend/parabolic-sar";
export type { ParabolicSarState, ParabolicSarValue } from "./trend/parabolic-sar";
export { createIchimoku } from "./trend/ichimoku";
export type { IchimokuState, IchimokuValue as IncrementalIchimokuValue } from "./trend/ichimoku";
export { createLinearRegression } from "./trend/linear-regression";
export type {
  LinearRegressionState,
  LinearRegressionValue as IncrementalLinearRegressionValue,
} from "./trend/linear-regression";

// Volume
export { createObv } from "./volume/obv";
export type { ObvState } from "./volume/obv";
export { createCmf } from "./volume/cmf";
export type { CmfState } from "./volume/cmf";
export { createMfi } from "./volume/mfi";
export type { MfiState } from "./volume/mfi";
export { createVwap } from "./volume/vwap";
export type { VwapState, VwapValue } from "./volume/vwap";
export { createAdl } from "./volume/adl";
export type { AdlState } from "./volume/adl";
export { createTwap } from "./volume/twap";
export type { TwapState } from "./volume/twap";
export { createElderForceIndex } from "./volume/elder-force-index";
export type { ElderForceIndexState } from "./volume/elder-force-index";
export { createVolumeAnomaly } from "./volume/volume-anomaly";
export type { VolumeAnomalyState } from "./volume/volume-anomaly";
export { createKlinger } from "./volume/klinger";
export type { KlingerState, KlingerValue as IncrementalKlingerValue } from "./volume/klinger";
export { createPvt } from "./volume/pvt";
export type { PvtState } from "./volume/pvt";
export { createNvi } from "./volume/nvi";
export type { NviState } from "./volume/nvi";
export { createCvd } from "./volume/cvd";
export type { CvdState } from "./volume/cvd";
export { createWeisWave } from "./volume/weis-wave";
export type { WeisWaveState, WeisWaveValue as IncrementalWeisWaveValue } from "./volume/weis-wave";
export { createAnchoredVwap } from "./volume/anchored-vwap";
export type {
  AnchoredVwapState,
  AnchoredVwapValue as IncrementalAnchoredVwapValue,
} from "./volume/anchored-vwap";
export { createEmv } from "./volume/ease-of-movement";
export type { EmvState } from "./volume/ease-of-movement";
export { createVolumeTrend } from "./volume/volume-trend";
export type { VolumeTrendState } from "./volume/volume-trend";

// Price
export { createHighestLowest } from "./price/highest-lowest";
export type {
  HighestLowestState,
  HighestLowestValue as IncrementalHighestLowestValue,
} from "./price/highest-lowest";
export { createPivotPoints } from "./price/pivot-points";
export type {
  PivotPointsState,
  PivotPointsValue as IncrementalPivotPointsValue,
} from "./price/pivot-points";
export { createFractals } from "./price/fractals";
export type { FractalsState, FractalValue as IncrementalFractalValue } from "./price/fractals";
export { createGapAnalysis } from "./price/gap-analysis";
export type { GapAnalysisState, GapValue as IncrementalGapValue } from "./price/gap-analysis";
export { createOpeningRange } from "./price/opening-range";
export type {
  OpeningRangeState,
  OpeningRangeValue as IncrementalOpeningRangeValue,
} from "./price/opening-range";
export { createFairValueGap } from "./price/fair-value-gap";
export type { FairValueGapState, FvgValue as IncrementalFvgValue } from "./price/fair-value-gap";
export { createHeikinAshi } from "./price/heikin-ashi";
export type {
  HeikinAshiState,
  HeikinAshiValue as IncrementalHeikinAshiValue,
} from "./price/heikin-ashi";
export { createReturns } from "./price/returns";
export type { ReturnsState } from "./price/returns";
export { createSwingPoints } from "./price/swing-points";
export type {
  SwingPointsState,
  SwingPointValue as IncrementalSwingPointValue,
} from "./price/swing-points";
export { createZigzag } from "./price/zigzag";
export type {
  ZigzagState,
  ZigzagValue as IncrementalZigzagValue,
} from "./price/zigzag";
export {
  createBreakOfStructure,
  createChangeOfCharacter,
} from "./price/break-of-structure";
export type {
  BosState,
  ChochState,
  BosValue as IncrementalBosValue,
} from "./price/break-of-structure";

// Wyckoff
export { createVsa } from "./wyckoff/vsa";
export type { VsaState, VsaValue as IncrementalVsaValue } from "./wyckoff/vsa";
