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
  type PerfectOrderType,
  type PerfectOrderValue,
  type PerfectOrderOptions,
} from "./perfect-order";
