/**
 * Signal filters — noise reduction using Ehlers digital signal processing
 *
 * - **Super Smoother**: Two-pole Butterworth filter for minimal lag
 * - **Roofing Filter**: Band-pass filter combining high-pass and super smoother
 *
 * @module
 */
export { superSmoother } from "./super-smoother";
export type { SuperSmootherOptions } from "./super-smoother";
export { roofingFilter } from "./roofing-filter";
export type { RoofingFilterOptions } from "./roofing-filter";
