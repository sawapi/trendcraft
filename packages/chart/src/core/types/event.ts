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
