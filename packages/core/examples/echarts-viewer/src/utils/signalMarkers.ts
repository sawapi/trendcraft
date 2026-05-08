/**
 * Signal marker generation for ECharts
 * Perfect Order, Range-Bound, Cross, Divergence, Squeeze, and Volume signals
 *
 * Re-exports all marker functions from sub-modules.
 */

export {
  createCrossMarkPoints,
  createDivergenceMarkers,
  createSqueezeMarkers,
} from "./markers/crossDivergenceMarkers";
export { createPatternMarkLines, createPatternMarkPoints } from "./markers/patternMarkers";

export { createPerfectOrderMarkPoints } from "./markers/perfectOrderMarkers";

export {
  createRangeBoundAreas,
  createSupportResistanceLines,
  mergeRanges,
  shouldMergeRanges,
} from "./markers/rangeBoundMarkers";
export type { MarkAreaItem, MarkLineItem, MarkPointItem } from "./markers/signalColors";
export { SIGNAL_COLORS } from "./markers/signalColors";
export {
  createVolumeBreakoutMarkers,
  createVolumeMaCrossMarkers,
} from "./markers/volumeMarkers";
