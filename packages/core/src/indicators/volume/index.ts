/**
 * Volume indicators — analyze trading volume for confirmation and divergence
 *
 * - **Volume MA**: Moving average of volume for baseline comparison
 * - **OBV**: On-Balance Volume — cumulative volume flow
 * - **MFI**: Money Flow Index — volume-weighted RSI
 * - **VWAP**: Volume-Weighted Average Price — intraday fair value
 * - **CMF**: Chaikin Money Flow — accumulation/distribution pressure
 * - **Volume Anomaly**: Detect statistically unusual volume (z-score)
 * - **Volume Profile**: Price-volume distribution (POC, Value Area)
 * - **Volume Trend**: Confirm price trends with volume analysis
 * - **ADL**: Accumulation/Distribution Line
 * - **Anchored VWAP**: VWAP from an arbitrary anchor point
 *
 * @module
 */

export { adl } from "./adl";
export type { AnchoredVwapOptions, AnchoredVwapValue } from "./anchored-vwap";
export { anchoredVwap } from "./anchored-vwap";
export type { CmfOptions } from "./cmf";
export { cmf } from "./cmf";
export type { CvdWithSignalOptions, CvdWithSignalValue } from "./cvd";
export { cvd, cvdWithSignal } from "./cvd";
export type { EaseOfMovementOptions } from "./ease-of-movement";
export { easeOfMovement } from "./ease-of-movement";
export type { ElderForceIndexOptions } from "./elder-force-index";
export { elderForceIndex } from "./elder-force-index";
export type { KlingerOptions, KlingerValue } from "./klinger";
export { klinger } from "./klinger";
export type { MarketProfileOptions, MarketProfileValue } from "./market-profile";
export { marketProfile } from "./market-profile";
export type { MfiOptions } from "./mfi";
export { mfi } from "./mfi";
export type { NviOptions } from "./nvi";
export { nvi } from "./nvi";
export { obv } from "./obv";
export { pvt } from "./pvt";
export type { TwapOptions } from "./twap";
export { twap } from "./twap";
export type { VolumeAnomalyOptions } from "./volume-anomaly";
export { volumeAnomaly } from "./volume-anomaly";
export type { VolumeMaOptions } from "./volume-ma";
export { volumeMa } from "./volume-ma";
export type { VolumeProfileOptions } from "./volume-profile";
export { volumeProfile, volumeProfileSeries } from "./volume-profile";
export type { VolumeTrendOptions } from "./volume-trend";
export { volumeTrend } from "./volume-trend";
export type { VwapBand, VwapOptions, VwapValue } from "./vwap";
export { vwap } from "./vwap";
export type { WeisWaveOptions, WeisWaveValue } from "./weis-wave";
export { weisWave } from "./weis-wave";
