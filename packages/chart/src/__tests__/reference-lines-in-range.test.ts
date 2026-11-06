/**
 * A pane's reference lines stay inside its value range. Mass Index's 27
 * and 26.5 sat above its values, so the lines it is read against were
 * never on screen.
 */

import { describe, expect, it } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import type { DataPoint, PaneConfig, PaneRect } from "../core/types";
import { computePaneRange } from "../renderer/range-calculator";

function series(values: number[], scaleId: "left" | "right" = "right"): InternalSeries {
  return {
    id: "s",
    paneId: "sub",
    scaleId,
    type: "line",
    config: {},
    data: values.map((value, i) => ({ time: i + 1, value })) as DataPoint<unknown>[],
    visible: true,
  };
}

function pane(config: Partial<PaneConfig>): PaneRect {
  return {
    id: "sub",
    x: 0,
    y: 0,
    width: 800,
    height: 300,
    config: { id: "sub", flex: 1, ...config },
  };
}

describe("reference lines in the pane range", () => {
  it("keeps lines above the values in view", () => {
    // Mass Index: values around 24-25, read against 27 and 26.5.
    const p = pane({ referenceLines: [27, 26.5] });
    expect(computePaneRange(p, 0, 3, [], [series([24, 25.2, 24.6])])).toEqual([24, 27]);
  });

  it("keeps lines below the values in view", () => {
    const p = pane({ referenceLines: [0] });
    expect(computePaneRange(p, 0, 2, [], [series([3, 5])])).toEqual([0, 5]);
  });

  it("does not narrow a range that already holds the lines", () => {
    const p = pane({ referenceLines: [0] });
    expect(computePaneRange(p, 0, 2, [], [series([-2, 4])])).toEqual([-2, 4]);
  });

  it("takes the left scale's lines for the left scale", () => {
    const p = pane({ referenceLines: [100], leftScale: { referenceLines: [10] } });
    expect(computePaneRange(p, 0, 2, [], [series([1, 2], "left")], undefined, "left")).toEqual([
      1, 10,
    ]);
  });

  it("leaves out a line at or below zero on a log scale", () => {
    // A log scale cannot show zero: including it squeezed the data into
    // the top few pixels of the pane.
    const right = pane({ yScale: "log", referenceLines: [0, -5, 250] });
    expect(computePaneRange(right, 0, 2, [], [series([100, 200])])).toEqual([100, 250]);
    const left = pane({ leftScale: { mode: "log", referenceLines: [0] } });
    expect(
      computePaneRange(left, 0, 2, [], [series([100, 200], "left")], undefined, "left"),
    ).toEqual([100, 200]);
  });

  it("leaves an empty pane at the default range", () => {
    const p = pane({ referenceLines: [27] });
    expect(computePaneRange(p, 0, 0, [], [])).toEqual([0, 100]);
  });
});
