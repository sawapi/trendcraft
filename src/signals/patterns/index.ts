// Types
export type {
  PatternType,
  PatternKeyPoint,
  PatternNeckline,
  PatternSignal,
  DoublePatternOptions,
  HeadShouldersOptions,
  CupHandleOptions,
  TriangleOptions,
  WedgeOptions,
  ChannelOptions,
  FlagOptions,
} from "./types";

// Double Top/Bottom
export { doubleTop, doubleBottom } from "./double-top-bottom";

// Head and Shoulders
export { headAndShoulders, inverseHeadAndShoulders } from "./head-shoulders";

// Cup with Handle
export { cupWithHandle } from "./cup-handle";

// Triangle
export { detectTriangle } from "./triangle";

// Wedge
export { detectWedge } from "./wedge";

// Channel
export { detectChannel } from "./channel";

// Flag/Pennant
export { detectFlag } from "./flag";

// Pattern Filter
export { filterPatterns, type PatternFilterOptions } from "./pattern-filter";

// Trendline Utilities
export {
  fitTrendline,
  fitTrendlinePair,
  classifyTrendlinePair,
  isSlopeFlat,
  countTouchPoints,
  lookupAtr,
  getPatternBounds,
  avgClosePrice,
  findTrendlineBreakout,
  buildTouchKeyPoints,
  calculateBreakoutLevels,
  checkBreakoutVolume,
  calculateBaseConfidence,
  clampConfidence,
  type TrendlineFit,
  type TrendlinePairType,
} from "./trendline-utils";
