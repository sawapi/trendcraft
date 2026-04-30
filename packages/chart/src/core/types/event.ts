/**
 * Chart event types
 */

import type { TimeValue } from "./fundamental";

export type ChartEvent =
  | "crosshairMove"
  | "visibleRangeChange"
  | "click"
  | "resize"
  | "paneResize"
  | "seriesAdded"
  | "seriesRemoved"
  | "dataFiltered"
  | "drawingComplete"
  | "error";

export type CrosshairMoveData = {
  time: TimeValue | null;
  price: number | null;
  x: number;
  y: number;
  paneId: string;
};

export type VisibleRangeChangeData = {
  startTime: TimeValue;
  endTime: TimeValue;
  startIndex: number;
  endIndex: number;
};

/**
 * Stable error/warning codes carried on the `error` event payload.
 *
 * The chart never throws on bad public-API input — it logs via `console.warn`
 * and emits an `error` event with one of these codes so downstream tooling
 * (monitoring, tests, framework wrappers) can react without parsing message
 * strings. Codes are additive: new ones may be introduced; existing ones are
 * not renamed without a changelog note.
 */
export type ChartErrorCode =
  | "INVALID_INPUT" // wrong top-level type (e.g. addIndicator called with non-array)
  | "INVALID_SHAPE" // an array element does not match the expected shape
  | "EMPTY_INPUT" // the input is structurally valid but empty (informational)
  | "INVALID_OPTION" // an unsupported option was passed to applyOptions/createChart
  | "UNKNOWN_INDICATOR_TYPE" // type/preset not registered with the chart
  | "BAD_CANDLE"; // a candle object was rejected during setCandles/updateCandle

export type ChartErrorPayload = {
  message: string;
  code?: ChartErrorCode;
  detail?: unknown;
};
