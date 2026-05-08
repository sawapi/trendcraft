/**
 * Trend indicators — identify and follow market trends
 *
 * - **Ichimoku**: Cloud-based trend system (Tenkan, Kijun, Senkou, Chikou)
 * - **Supertrend**: ATR-based trend direction with built-in stop levels
 * - **Parabolic SAR**: Trailing stop/reverse system for trend following
 * - **Vortex**: Positive/negative trend movement indicators
 *
 * @module
 */

export type { IchimokuOptions, IchimokuValue } from "./ichimoku";
export { ichimoku } from "./ichimoku";
export type { LinearRegressionOptions, LinearRegressionValue } from "./linear-regression";
export { linearRegression } from "./linear-regression";
export type { ParabolicSarOptions, ParabolicSarValue } from "./parabolic-sar";
export { parabolicSar } from "./parabolic-sar";
export type { SchaffTrendCycleOptions } from "./schaff-trend-cycle";
export { schaffTrendCycle } from "./schaff-trend-cycle";
export type { SupertrendOptions, SupertrendValue } from "./supertrend";
export { supertrend } from "./supertrend";
export type { VortexOptions, VortexValue } from "./vortex";
export { vortex } from "./vortex";
