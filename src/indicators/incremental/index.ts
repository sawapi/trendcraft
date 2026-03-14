/**
 * Incremental Indicator API
 *
 * Stateful indicators that process one candle at a time for O(1) per-update computation.
 * Ideal for real-time trading and streaming data.
 */

// Types
export type { IncrementalIndicator, WarmUpOptions } from "./types";

// Utilities
export { CircularBuffer } from "./circular-buffer";
export { processAll } from "./bridge";

// Moving Averages
export { createSma } from "./moving-average/sma";
export type { SmaState } from "./moving-average/sma";
export { createEma } from "./moving-average/ema";
export type { EmaState } from "./moving-average/ema";
export { createWma } from "./moving-average/wma";
export type { WmaState } from "./moving-average/wma";
export { createVwma } from "./moving-average/vwma";
export type { VwmaState } from "./moving-average/vwma";

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

// Trend
export { createSupertrend } from "./trend/supertrend";
export type { SupertrendState, SupertrendValue } from "./trend/supertrend";
export { createParabolicSar } from "./trend/parabolic-sar";
export type { ParabolicSarState, ParabolicSarValue } from "./trend/parabolic-sar";
export { createIchimoku } from "./trend/ichimoku";
export type { IchimokuState, IchimokuValue as IncrementalIchimokuValue } from "./trend/ichimoku";

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
