// @vitest-environment happy-dom
/**
 * applyOptions — runtime option dispatch.
 *
 * Verifies that `chart.applyOptions(partial)` routes each field to the
 * appropriate internal setter (theme/chartType/volume/etc.) and emits
 * a warning for fields that cannot be changed at runtime.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LIGHT_THEME } from "../core/types";
import { createChart } from "../index";

// happy-dom does not ship a canvas 2D context implementation. Stub a no-op
// context so we can construct a real CanvasChart and exercise applyOptions.
beforeAll(() => {
  const noop = () => {};
  const context2d = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return null;
        if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
        return noop;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () =>
    context2d;
});

function makeContainer(): HTMLElement {
  const el = document.createElement("div");
  el.style.width = "800px";
  el.style.height = "400px";
  document.body.appendChild(el);
  return el;
}

describe("applyOptions", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("routes theme to setTheme", () => {
    const chart = createChart(makeContainer(), { theme: "dark" });
    const setTheme = vi.spyOn(chart, "setTheme");
    chart.applyOptions({ theme: "light" });
    expect(setTheme).toHaveBeenCalledWith("light");
    chart.destroy();
  });

  it("routes chartType to setChartType", () => {
    const chart = createChart(makeContainer());
    const spy = vi.spyOn(chart, "setChartType");
    chart.applyOptions({ chartType: "line" });
    expect(spy).toHaveBeenCalledWith("line");
    chart.destroy();
  });

  it("routes volume to setShowVolume", () => {
    const chart = createChart(makeContainer());
    const spy = vi.spyOn(chart, "setShowVolume");
    chart.applyOptions({ volume: false });
    expect(spy).toHaveBeenCalledWith(false);
    chart.applyOptions({ volume: true });
    expect(spy).toHaveBeenCalledWith(true);
    chart.destroy();
  });

  it("accepts a custom ThemeColors object via applyOptions", () => {
    const chart = createChart(makeContainer(), { theme: "dark" });
    // Custom theme — just verify no throw
    expect(() => chart.applyOptions({ theme: LIGHT_THEME })).not.toThrow();
    chart.destroy();
  });

  it("toggles legend overlay on and off", () => {
    const container = makeContainer();
    const chart = createChart(container, { legend: true });

    chart.applyOptions({ legend: false });
    chart.applyOptions({ legend: true });
    // Legend toggle should not throw and the chart continues to accept further updates
    expect(() => chart.applyOptions({ theme: "light" })).not.toThrow();
    chart.destroy();
  });

  it("accepts partial size updates without requiring all four dimensions", () => {
    const container = makeContainer();
    const chart = createChart(container, { width: 800, height: 400 });
    chart.applyOptions({ priceAxisWidth: 80 });
    chart.applyOptions({ width: 1000 });
    chart.applyOptions({ height: 500, timeAxisHeight: 40 });
    // No throw + chart stays responsive
    expect(() => chart.applyOptions({ theme: "light" })).not.toThrow();
    chart.destroy();
  });

  it("ignores undefined fields (no setter dispatch)", () => {
    const chart = createChart(makeContainer());
    const setTheme = vi.spyOn(chart, "setTheme");
    const setChartType = vi.spyOn(chart, "setChartType");
    chart.applyOptions({});
    expect(setTheme).not.toHaveBeenCalled();
    expect(setChartType).not.toHaveBeenCalled();
    chart.destroy();
  });

  it("warns via error event for fields that cannot be changed at runtime", () => {
    const chart = createChart(makeContainer());
    const errors: Array<{ message: string; detail: unknown }> = [];
    chart.on("error", (d) => errors.push(d as { message: string; detail: unknown }));

    chart.applyOptions({ pixelRatio: 2, fontFamily: "monospace" });

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("pixelRatio");
    expect(errors[0]?.message).toContain("fontFamily");
    chart.destroy();
  });

  it("applies multiple fields in a single call", () => {
    const chart = createChart(makeContainer(), { theme: "dark" });
    const setTheme = vi.spyOn(chart, "setTheme");
    const setChartType = vi.spyOn(chart, "setChartType");
    const setShowVolume = vi.spyOn(chart, "setShowVolume");

    chart.applyOptions({ theme: "light", chartType: "line", volume: false });

    expect(setTheme).toHaveBeenCalledWith("light");
    expect(setChartType).toHaveBeenCalledWith("line");
    expect(setShowVolume).toHaveBeenCalledWith(false);
    chart.destroy();
  });
});
