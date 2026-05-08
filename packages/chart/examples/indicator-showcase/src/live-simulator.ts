/**
 * Re-exports `createLiveSimulator` from `@trendcraft/chart/replay`. The
 * implementation was lifted into chart so the showcase + Strategy
 * Studio share one source of truth for "drive the chart from a static
 * candle array on a timer". Existing call sites in this example keep
 * importing from this path.
 */

export {
  type LiveSource,
  type SimulatorHandle,
  type SimulatorOptions,
  type SimulatorState,
  createLiveSimulator,
} from "@trendcraft/chart/replay";
