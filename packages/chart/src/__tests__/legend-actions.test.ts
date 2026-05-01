// @vitest-environment happy-dom
/**
 * Legend per-row actions (⚙ edit / ✕ remove) — only render when the host has
 * subscribed to the matching event. A bare chart must not show affordances
 * that go nowhere when clicked.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createChart } from "../index";

beforeAll(() => {
  const noop = () => {};
  const ctx = new Proxy(
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
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ctx;
});

function makeContainer(): HTMLElement {
  const el = document.createElement("div");
  el.style.width = "800px";
  el.style.height = "400px";
  document.body.appendChild(el);
  return el;
}

const sampleSeries = [
  { time: 1000, value: 1 },
  { time: 2000, value: 2 },
  { time: 3000, value: 3 },
];

describe("Legend per-row actions", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders only the toggle button by default", () => {
    const container = makeContainer();
    const chart = createChart(container, { legend: true });
    chart.addIndicator(sampleSeries, { label: "Test" });
    const actions = container.querySelectorAll(".tc-legend-action");
    expect(actions.length).toBe(0);
    const toggles = container.querySelectorAll('.tc-legend-btn[data-action="toggle"]');
    expect(toggles.length).toBe(1);
    chart.destroy();
  });

  it("renders ⚙ once a seriesEditRequest listener is attached", () => {
    const container = makeContainer();
    const chart = createChart(container, { legend: true });
    chart.on("seriesEditRequest", () => {});
    chart.addIndicator(sampleSeries, { label: "Test" });
    const editButtons = container.querySelectorAll('.tc-legend-action[data-action="edit"]');
    expect(editButtons.length).toBe(1);
    const removeButtons = container.querySelectorAll('.tc-legend-action[data-action="remove"]');
    expect(removeButtons.length).toBe(0);
    chart.destroy();
  });

  it("renders ✕ once a seriesRemoveRequest listener is attached", () => {
    const container = makeContainer();
    const chart = createChart(container, { legend: true });
    chart.on("seriesRemoveRequest", () => {});
    chart.addIndicator(sampleSeries, { label: "Test" });
    const removeButtons = container.querySelectorAll('.tc-legend-action[data-action="remove"]');
    expect(removeButtons.length).toBe(1);
    chart.destroy();
  });
});
