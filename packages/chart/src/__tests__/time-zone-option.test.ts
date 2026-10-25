// @vitest-environment happy-dom
/**
 * The `timeZone` option at construction (ops #89): a known zone is applied,
 * an unknown one or a non-string is ignored with a warning.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { TimeScale } from "../core/scale";
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

afterEach(() => {
  vi.restoreAllMocks();
});

function zoneOf(timeZone: unknown): string | undefined {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const chart = createChart(el, { timeZone: timeZone as string });
  const zone = (chart as unknown as { _timeScale: TimeScale })._timeScale.timeZone;
  chart.destroy();
  return zone;
}

describe("timeZone at construction", () => {
  it("applies a known zone", () => {
    expect(zoneOf("America/New_York")).toBe("America/New_York");
  });

  it("ignores an unknown zone or a non-string, with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(zoneOf("Bogus/Zone")).toBeUndefined();
    expect(zoneOf(5)).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
