// @vitest-environment happy-dom
/**
 * Indicator auto-color assignment — Bug 3 regression test.
 *
 * Verifies that `addIndicator` prefers the first palette color not already
 * in use, so a remove→re-add (e.g. param-change) cycle keeps the same color
 * instead of rotating to the next palette slot.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DataPoint } from "../core/types";
import { createChart } from "../index";

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

const series: DataPoint<number>[] = [
  { time: 1, value: 1 },
  { time: 2, value: 2 },
];

describe("addIndicator color assignment", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reuses the same color when an indicator is removed and re-added", () => {
    const chart = createChart(makeContainer());
    const first = chart.addIndicator(series, { label: "A" });
    const originalColor = first.config.color;
    expect(originalColor).toBeTruthy();

    first.remove();
    const reAdded = chart.addIndicator(series, { label: "A2" });
    expect(reAdded.config.color).toBe(originalColor);
    chart.destroy();
  });

  it("assigns distinct colors while multiple indicators coexist", () => {
    const chart = createChart(makeContainer());
    const a = chart.addIndicator(series, { label: "A" });
    const b = chart.addIndicator(series, { label: "B" });
    const c = chart.addIndicator(series, { label: "C" });
    expect(a.config.color).not.toBe(b.config.color);
    expect(b.config.color).not.toBe(c.config.color);
    expect(a.config.color).not.toBe(c.config.color);
    chart.destroy();
  });
});
