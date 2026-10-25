/**
 * `on()` / `off()` hand each handler its event's payload.
 *
 * The handler used to receive `unknown`, so every consumer cast — and the
 * React/Vue wrappers restated the name → payload pairing in four places.
 * These are type-level checks: `tsc` (the package's `typecheck` script, run
 * in CI) fails this file if a handler's payload is not its event's type, or
 * if a handler written for another event's payload is accepted.
 */

import { describe, expectTypeOf, it } from "vitest";
import type {
  ChartClickData,
  ChartErrorPayload,
  ChartInstance,
  ChartResizeData,
  CrosshairMoveData,
  DataFilteredData,
  Drawing,
  DrawingToolChangedData,
  PaneResizeData,
  SeriesActionData,
  SeriesAddedData,
  SeriesRemovedData,
  VisibleRangeChangeData,
} from "../index";

/** Never called: the assertions are checked by `tsc`, not at run time. */
function handlersReceiveTheirPayload(chart: ChartInstance): void {
  chart.on("crosshairMove", (d) => expectTypeOf(d).toEqualTypeOf<CrosshairMoveData>());
  chart.on("visibleRangeChange", (d) => expectTypeOf(d).toEqualTypeOf<VisibleRangeChangeData>());
  chart.on("click", (d) => expectTypeOf(d).toEqualTypeOf<ChartClickData>());
  chart.on("doubleClick", (d) => expectTypeOf(d).toEqualTypeOf<ChartClickData>());
  chart.on("resize", (d) => expectTypeOf(d).toEqualTypeOf<ChartResizeData>());
  chart.on("paneResize", (d) => expectTypeOf(d).toEqualTypeOf<PaneResizeData>());
  chart.on("seriesAdded", (d) => expectTypeOf(d).toEqualTypeOf<SeriesAddedData>());
  chart.on("seriesRemoved", (d) => expectTypeOf(d).toEqualTypeOf<SeriesRemovedData>());
  chart.on("seriesEditRequest", (d) => expectTypeOf(d).toEqualTypeOf<SeriesActionData>());
  chart.on("seriesRemoveRequest", (d) => expectTypeOf(d).toEqualTypeOf<SeriesActionData>());
  chart.on("dataFiltered", (d) => expectTypeOf(d).toEqualTypeOf<DataFilteredData>());
  chart.on("drawingComplete", (d) => expectTypeOf(d).toEqualTypeOf<Drawing>());
  chart.on("drawingToolChanged", (d) => expectTypeOf(d).toEqualTypeOf<DrawingToolChangedData>());
  chart.on("error", (d) => expectTypeOf(d).toEqualTypeOf<ChartErrorPayload>());

  // A handler written for another event's payload is rejected...
  // @ts-expect-error — crosshairMove carries CrosshairMoveData, not ChartClickData
  chart.on("crosshairMove", (_d: ChartClickData) => undefined);
  // @ts-expect-error — same for off()
  chart.off("click", (_d: SeriesAddedData) => undefined);
  // ...while one that takes `unknown` (written against the old signature) still fits.
  chart.on("click", (_d: unknown) => undefined);
}

describe("ChartEventMap", () => {
  it("types each handler by its event (checked by tsc)", () => {
    expectTypeOf(handlersReceiveTheirPayload).toBeFunction();
  });
});
