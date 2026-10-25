import type { ChartEvent, ChartEventMap } from "../core/types";

/** Emits event `E` with its payload: what the chart hands its internal parts. */
export type ChartEventEmitter = <E extends ChartEvent>(event: E, data: ChartEventMap[E]) => void;
