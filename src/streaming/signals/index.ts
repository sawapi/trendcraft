/**
 * Streaming Signal Detectors
 *
 * Incremental signal detection for real-time data processing.
 */

export { createCrossOverDetector, createCrossUnderDetector } from "./cross";
export { createThresholdDetector } from "./threshold";
export { createSqueezeDetector } from "./bollinger-squeeze";
export type { SqueezeDetectorOptions } from "./bollinger-squeeze";
export { createDivergenceDetector } from "./divergence";
export type { DivergenceDetectorOptions } from "./divergence";
