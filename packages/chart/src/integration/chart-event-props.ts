/**
 * Chart events as framework-wrapper props: `click` → `onClick`, for every
 * event in {@link ChartEventMap}. The React and Vue wrappers subscribe from
 * this list, so an event added to the map reaches both without restating it.
 */

import type { ChartEvent, ChartEventHandler } from "../core/types";

/** Keyed by every chart event, so a missing or unknown name fails to compile. */
const EVENTS: Record<ChartEvent, 0> = {
  crosshairMove: 0,
  visibleRangeChange: 0,
  click: 0,
  doubleClick: 0,
  resize: 0,
  paneResize: 0,
  seriesAdded: 0,
  seriesRemoved: 0,
  seriesEditRequest: 0,
  seriesRemoveRequest: 0,
  dataFiltered: 0,
  drawingComplete: 0,
  drawingToolChanged: 0,
  error: 0,
};

/** Every chart event name, at run time (`ChartEvent` is type-only). */
export const CHART_EVENTS = Object.keys(EVENTS) as ChartEvent[];

/** One optional handler prop per chart event: `onClick`, `onVisibleRangeChange`, … */
export type ChartEventProps = {
  [E in ChartEvent as `on${Capitalize<E>}`]?: ChartEventHandler<E>;
};

/** The wrapper prop for event `e`: `click` → `onClick`. */
export function eventProp(e: ChartEvent): keyof ChartEventProps {
  return `on${e[0].toUpperCase()}${e.slice(1)}` as keyof ChartEventProps;
}

/**
 * Whether a wrapper subscribes to `e` given the handler it was passed. The
 * legend draws its ⚙ / ✕ only while `seriesEditRequest` /
 * `seriesRemoveRequest` has a listener, so those are subscribed only when a
 * handler is given; every other event always is, and the handler is read
 * when the event fires.
 */
export function wantsEvent(e: ChartEvent, handler: unknown): boolean {
  return !!handler || (e !== "seriesEditRequest" && e !== "seriesRemoveRequest");
}
