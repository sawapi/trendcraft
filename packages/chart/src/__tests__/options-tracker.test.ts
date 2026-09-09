/**
 * `createChartOptionsTracker` — what counts as "changed" for the wrappers'
 * `options` diff.
 */

import { describe, expect, it } from "vitest";
import { createChartOptionsTracker } from "../core/options-tracker";
import type { ChartOptions } from "../core/types";

describe("createChartOptionsTracker", () => {
  it("reports nothing for the options the chart was created from", () => {
    const initial: ChartOptions = { locale: { volume: "Vol" }, watermark: "AAPL" };
    const tracker = createChartOptionsTracker(initial);
    expect(tracker.diff(initial)).toBeNull();
    // Structurally equal but a different object — the inline-literal idiom.
    expect(tracker.diff({ locale: { volume: "Vol" }, watermark: "AAPL" })).toBeNull();
  });

  it("reports only the fields whose values changed", () => {
    const tracker = createChartOptionsTracker({ locale: { volume: "Vol" }, fontSize: 12 });
    expect(tracker.diff({ locale: { volume: "Vol" }, fontSize: 14 })).toEqual({ fontSize: 14 });
    // The snapshot advanced: the same value again is not a change.
    expect(tracker.diff({ locale: { volume: "Vol" }, fontSize: 14 })).toBeNull();
  });

  it("compares nested plain objects and arrays structurally", () => {
    const tracker = createChartOptionsTracker({
      crosshair: { mode: "normal", snapThreshold: 5 },
      hotkeys: { f: "cancel" },
    });
    expect(tracker.diff({ crosshair: { mode: "normal", snapThreshold: 5 } })).toBeNull();
    expect(tracker.diff({ crosshair: { mode: "magnet", snapThreshold: 5 } })).toEqual({
      crosshair: { mode: "magnet", snapThreshold: 5 },
    });
    expect(tracker.diff({ crosshair: { mode: "magnet" } })).toEqual({
      crosshair: { mode: "magnet" },
    });
  });

  it("snapshots, so an in-place mutation of the same object is a change", () => {
    const options: ChartOptions = { crosshair: { mode: "normal" } };
    const tracker = createChartOptionsTracker(options);
    (options.crosshair as { mode: string }).mode = "magnet";
    expect(tracker.diff(options)).toEqual({ crosshair: { mode: "magnet" } });
  });

  it("forwards the live value, not a copy", () => {
    const tracker = createChartOptionsTracker({});
    const crosshair = { mode: "magnet" as const };
    const changed = tracker.diff({ crosshair });
    expect(changed?.crosshair).toBe(crosshair);
  });

  it("compares functions by identity", () => {
    const a = (p: number) => String(p);
    const b = (p: number) => String(p);
    const tracker = createChartOptionsTracker({ priceFormatter: a });
    expect(tracker.diff({ priceFormatter: a })).toBeNull();
    expect(tracker.diff({ priceFormatter: b })).toEqual({ priceFormatter: b });
  });

  it("ignores fields that are absent or undefined, and remembers the value the chart kept", () => {
    const tracker = createChartOptionsTracker({ watermark: "AAPL", fontSize: 12 });
    // `applyOptions` treats undefined as "leave as is", so neither is a change.
    expect(tracker.diff({ watermark: undefined, fontSize: 12 })).toBeNull();
    expect(tracker.diff({ fontSize: 12 })).toBeNull();
    expect(tracker.diff(undefined)).toBeNull();
    // The chart still holds "AAPL", so re-supplying it is not a change —
    // `options={cond ? { locale } : undefined}` toggling must not re-warn.
    expect(tracker.diff({ watermark: "AAPL" })).toBeNull();
    expect(tracker.diff({ watermark: "MSFT" })).toEqual({ watermark: "MSFT" });
  });

  it("treats a nested undefined field as absent, like applyOptions' `??` resolution", () => {
    const tracker = createChartOptionsTracker({ crosshair: {} });
    expect(tracker.diff({ crosshair: { mode: undefined } })).toBeNull();
    expect(tracker.diff({ crosshair: { mode: "magnet" } })).toEqual({
      crosshair: { mode: "magnet" },
    });
    expect(tracker.diff({ crosshair: { mode: "magnet", snapThreshold: undefined } })).toBeNull();
  });

  it("treats NaN as equal to NaN and 0 as different from -0 (Object.is semantics)", () => {
    const tracker = createChartOptionsTracker({ fontSize: Number.NaN, animationDuration: 0 });
    expect(tracker.diff({ fontSize: Number.NaN, animationDuration: 0 })).toBeNull();
    expect(tracker.diff({ fontSize: Number.NaN, animationDuration: -0 })).toEqual({
      animationDuration: -0,
    });
  });

  it("does not confuse a key named like an Object.prototype member with an inherited one", () => {
    const tracker = createChartOptionsTracker({});
    const hotkeys = { toString: "cancel" } as unknown as ChartOptions["hotkeys"];
    expect(tracker.diff({ hotkeys })).toEqual({ hotkeys });
    expect(tracker.diff({ hotkeys: { toString: "cancel" } as never })).toBeNull();
  });
});
