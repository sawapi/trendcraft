export {
  benchmarkRS,
  calculateRSRating,
  isOutperforming,
} from "./benchmark-rs";
export type { RSValue, BenchmarkRSOptions } from "./benchmark-rs";

export {
  rankByRS,
  topByRS,
  bottomByRS,
  filterByRSPercentile,
  compareRS,
} from "./multi-rs";
export type { SymbolRSRank, MultiRSOptions } from "./multi-rs";
