/**
 * Chart event types
 */

import type { TimeValue } from "./fundamental";

export type ChartEvent =
  | "crosshairMove"
  | "visibleRangeChange"
  | "click"
  | "doubleClick"
  | "resize"
  | "paneResize"
  | "seriesAdded"
  | "seriesRemoved"
  | "seriesEditRequest"
  | "seriesRemoveRequest"
  | "dataFiltered"
  | "drawingComplete"
  | "drawingToolChanged"
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

/**
 * Payload for the `crosshairMove` event. Fires when the candle the crosshair
 * snaps to changes. `time`/`index`/`ohlcv` describe the snapped candle;
 * `paneId` is the pane under the pointer. All fields are `null` in the single
 * emission fired when the crosshair leaves the data area.
 */
export type CrosshairMoveData = {
  time: TimeValue | null;
  index: number | null;
  ohlcv: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null;
  paneId: string | null;
};

/**
 * Payload for the chart-wide `click` and `doubleClick` events. Fires on
 * pointer taps (mouse or touch) and double-clicks / double-taps that
 * aren't consumed by the drawing tool. `index` and `time` resolve to the
 * candle nearest the pointer; `null` when the pointer landed outside the
 * data range. Modifier keys carry the keyboard state at click time (always
 * `false` on touch unless the platform pairs a hardware keyboard) so hosts
 * can branch on Shift/Alt/Meta/Ctrl without attaching their own listeners.
 */
export type ChartClickData = {
  x: number;
  y: number;
  index: number | null;
  time: TimeValue | null;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
};

/**
 * Visible range in logical (bar-index) units. `from` is the fractional bar
 * index at the left window edge, `to` the one at the right edge. Unlike the
 * time/index fields of {@link VisibleRangeChangeData}, the values are NOT
 * clamped to the data: `to` past the last bar measures the empty space after
 * it (e.g. the `timeScale.rightOffset` margin), and fractional parts measure
 * partial bar visibility.
 *
 * Logical indices address the current candle array — they are shifted by
 * `maxCandles` trimming and invalidated by `setCandles`. Read-modify-set
 * synchronously; never persist them.
 */
export type LogicalRange = {
  from: number;
  to: number;
};

export type VisibleRangeChangeData = {
  /** Time of the first visible candle (clamped to the data range) */
  startTime: TimeValue;
  /** Time of the last visible candle (clamped to the data range) */
  endTime: TimeValue;
  /** Index of the first visible candle (clamped to the data range) */
  startIndex: number;
  /** Index of the last visible candle (clamped to the data range) */
  endIndex: number;
  /** Unclamped window edges — the only fields that can express empty space
   *  past the last bar (see {@link LogicalRange}). Always populated by the
   *  chart; optional so existing code constructing this type (test mocks)
   *  keeps compiling. */
  logicalRange?: LogicalRange;
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
