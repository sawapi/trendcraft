/**
 * Signal detection utilities
 */

export {
  crossOver,
  crossUnder,
  goldenCross,
  deadCross,
  validateCrossSignals,
  type CrossOptions,
  type CrossValidationOptions,
  type CrossSignalQuality,
} from "./cross";

export {
  obvDivergence,
  rsiDivergence,
  macdDivergence,
  detectDivergence,
  type DivergenceSignal,
  type DivergenceOptions,
} from "./divergence";

export {
  bollingerSqueeze,
  type SqueezeSignal,
  type SqueezeOptions,
} from "./bollinger-squeeze";

export {
  perfectOrder,
  perfectOrderEnhanced,
  type PerfectOrderType,
  type PerfectOrderValue,
  type PerfectOrderOptions,
  // Enhanced mode types
  type SlopeDirection,
  type PerfectOrderState,
  type PerfectOrderValueEnhanced,
  type PerfectOrderOptionsEnhanced,
} from "./perfect-order";
