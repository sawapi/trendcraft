/**
 * Streaming Signal Detectors
 *
 * Incremental signal detection for real-time data processing.
 */

export type { SqueezeDetectorOptions } from "./bollinger-squeeze";
export { createSqueezeDetector } from "./bollinger-squeeze";
export { createCrossOverDetector, createCrossUnderDetector } from "./cross";
export type { DivergenceDetectorOptions } from "./divergence";
export { createDivergenceDetector } from "./divergence";
export { createThresholdDetector } from "./threshold";
