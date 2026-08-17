// Types

// Channel
export { detectChannel } from "./channel";
// Cup with Handle
export { cupWithHandle } from "./cup-handle";
// Double Top/Bottom
export { doubleBottom, doubleTop } from "./double-top-bottom";
// Flag/Pennant
export { detectFlag } from "./flag";
// Harmonic Patterns
export { detectHarmonicPatterns } from "./harmonic-patterns";
// Head and Shoulders
export { headAndShoulders, inverseHeadAndShoulders } from "./head-shoulders";
// Pattern Filter
export { filterPatterns, type PatternFilterOptions } from "./pattern-filter";
// Trendline Utilities
export {
  avgClosePrice,
  buildTouchKeyPoints,
  calculateBaseConfidence,
  calculateBreakoutLevels,
  checkBreakoutVolume,
  clampConfidence,
  classifyTrendlinePair,
  countTouchPoints,
  findTrendlineBreakout,
  fitTrendline,
  fitTrendlinePair,
  getPatternBounds,
  isSlopeFlat,
  lookupAtr,
  type TrendlineFit,
  type TrendlinePairType,
} from "./trendline-utils";
// Triangle
export { detectTriangle } from "./triangle";
export type {
  ChannelOptions,
  CupHandleOptions,
  DoublePatternOptions,
  FlagOptions,
  HarmonicPatternOptions,
  HarmonicPatternType,
  HeadShouldersOptions,
  PatternBias,
  PatternKeyPoint,
  PatternNeckline,
  PatternSignal,
  PatternType,
  TriangleOptions,
  WedgeOptions,
} from "./types";
export { PATTERN_BIAS, resolvePatternDirection } from "./types";
// Wedge
export { detectWedge } from "./wedge";
