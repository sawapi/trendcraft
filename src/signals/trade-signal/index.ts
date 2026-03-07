/**
 * Trade Signal Module
 *
 * Unified trade signal format and converters from various signal sources.
 */

export {
  fromCrossSignal,
  fromDivergenceSignal,
  fromSqueezeSignal,
  fromPatternSignal,
  fromScoreResult,
  fromPipelineResult,
} from "./converters";
