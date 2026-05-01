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
  | "seriesEditRequest"
  | "seriesRemoveRequest"
  | "dataFiltered"
  | "drawingComplete"
  | "error";

/**
 * Payload for `seriesEditRequest` and `seriesRemoveRequest` events. Fired when
 * the user clicks the edit / remove affordance on a legend row. The chart
 * never edits or removes the series itself — it only delegates the intent
 * back to the host application, which owns indicator parameters and lifecycle.
 *
 * `anchorEl` is the DOM element of the clicked legend row (or button), so the
 * host can position a popover next to the user's cursor without having to
 * query the chart's internal selectors. Same window only — for cross-frame
 * use, derive a bounding rect from it on the host side.
 */
export type SeriesActionData = {
  seriesId: string;
  anchorEl: HTMLElement;
};

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
