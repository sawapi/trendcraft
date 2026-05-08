/**
 * Signal filters — noise reduction using Ehlers digital signal processing
 *
 * - **Super Smoother**: Two-pole Butterworth filter for minimal lag
 * - **Roofing Filter**: Band-pass filter combining high-pass and super smoother
 *
 * @module
 */

export type { RoofingFilterOptions } from "./roofing-filter";
export { roofingFilter } from "./roofing-filter";
export type { SuperSmootherOptions } from "./super-smoother";
export { superSmoother } from "./super-smoother";
