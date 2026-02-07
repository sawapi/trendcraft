/**
 * Signal marker generation for ECharts
 * Perfect Order, Range-Bound, Cross, Divergence, Squeeze, and Volume signals
 *
 * Re-exports all marker functions from sub-modules.
 */

export { SIGNAL_COLORS } from "./markers/signalColors";
export type { MarkPointItem, MarkAreaItem, MarkLineItem } from "./markers/signalColors";

export { createPerfectOrderMarkPoints } from "./markers/perfectOrderMarkers";

export {
  createRangeBoundAreas,
  createSupportResistanceLines,
  shouldMergeRanges,
  mergeRanges,
} from "./markers/rangeBoundMarkers";

export {
  createCrossMarkPoints,
  createDivergenceMarkers,
  createSqueezeMarkers,
} from "./markers/crossDivergenceMarkers";

export {
  createVolumeBreakoutMarkers,
  createVolumeMaCrossMarkers,
} from "./markers/volumeMarkers";
