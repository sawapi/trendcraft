/**
 * Re-exports `createLiveSimulator` from `@trendcraft/chart/replay`. The
 * implementation was lifted into chart so the showcase + Strategy
 * Studio share one source of truth for "drive the chart from a static
 * candle array on a timer". Existing call sites in this example keep
 * importing from this path.
 */

export {
  createLiveSimulator,
  type LiveSource,
  type SimulatorHandle,
  type SimulatorOptions,
  type SimulatorState,
} from "@trendcraft/chart/replay";
