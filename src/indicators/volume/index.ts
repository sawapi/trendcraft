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
 *
 * @module
 */
export { volumeMa } from "./volume-ma";
export type { VolumeMaOptions } from "./volume-ma";
export { obv } from "./obv";
export { mfi } from "./mfi";
export type { MfiOptions } from "./mfi";
export { vwap } from "./vwap";
export type { VwapOptions, VwapValue } from "./vwap";
export { cmf } from "./cmf";
export type { CmfOptions } from "./cmf";
export { volumeAnomaly } from "./volume-anomaly";
export type { VolumeAnomalyOptions } from "./volume-anomaly";
export { volumeProfile, volumeProfileSeries } from "./volume-profile";
export type { VolumeProfileOptions } from "./volume-profile";
export { volumeTrend } from "./volume-trend";
export type { VolumeTrendOptions } from "./volume-trend";
export { adl } from "./adl";
