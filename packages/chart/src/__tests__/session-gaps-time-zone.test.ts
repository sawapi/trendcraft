// @vitest-environment happy-dom
/**
 * Calendar features follow the chart's `timeZone`: `"dayBoundary"` session
 * gaps split at midnight in that zone (or in `sessionGaps.timeZone`), and the
 * `"YTD"` duration starts at that zone's January 1.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TimeScale } from "../core/scale";
import type { CandleData, ChartOptions } from "../core/types";
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

const HOUR = 3_600_000;

/** Hourly bars from 00:00Z on 2026-03-02 (a Monday), outside any DST change. */
function hourlyBars(count: number): CandleData[] {
  const start = Date.UTC(2026, 2, 2);
  return Array.from({ length: count }, (_, i) => ({
    time: start + i * HOUR,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1,
  }));
}

function mount(options: ChartOptions) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return createChart(el, options);
}

/** Indices `setGapsBefore` receives on each call. */
function captureGaps(): number[][] {
  const calls: number[][] = [];
  const orig = TimeScale.prototype.setGapsBefore;
  vi.spyOn(TimeScale.prototype, "setGapsBefore").mockImplementation(function (this: TimeScale, g) {
    calls.push(g.map((x) => x.index));
    return orig.call(this, g);
  });
  return calls;
}

const dayBoundary = { sessionGaps: { mode: "dayBoundary" as const } };

describe("dayBoundary session gaps", () => {
  it("split at UTC midnight without a timeZone", () => {
    const calls = captureGaps();
    const chart = mount({ timeScale: dayBoundary });
    chart.setCandles(hourlyBars(48));
    expect(calls.at(-1)).toEqual([24]);
    chart.destroy();
  });

  it("split at midnight in the chart's timeZone", () => {
    // Tokyo midnight is 15:00Z.
    const calls = captureGaps();
    const chart = mount({ timeZone: "Asia/Tokyo", timeScale: dayBoundary });
    chart.setCandles(hourlyBars(48));
    expect(calls.at(-1)).toEqual([15, 39]);
    chart.destroy();
  });

  it("split in sessionGaps.timeZone when it is set", () => {
    // New York midnight is 05:00Z in March before the DST change.
    const calls = captureGaps();
    const chart = mount({
      timeZone: "Asia/Tokyo",
      timeScale: { sessionGaps: { mode: "dayBoundary", timeZone: "America/New_York" } },
    });
    chart.setCandles(hourlyBars(48));
    expect(calls.at(-1)).toEqual([5, 29]);
    chart.destroy();
  });

  it("move when applyOptions changes the chart's timeZone", () => {
    const calls = captureGaps();
    const chart = mount({ timeScale: dayBoundary });
    chart.setCandles(hourlyBars(48));
    chart.applyOptions({ timeZone: "Asia/Tokyo" });
    expect(calls.at(-1)).toEqual([15, 39]);
    chart.applyOptions({ timeZone: "" });
    expect(calls.at(-1)).toEqual([24]);
    chart.destroy();
  });

  it("ignore an unknown sessionGaps.timeZone with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const calls = captureGaps();
    const chart = mount({
      timeZone: "Asia/Tokyo",
      timeScale: { sessionGaps: { mode: "dayBoundary", timeZone: "Bogus/Zone" } },
    });
    chart.setCandles(hourlyBars(48));
    expect(calls.at(-1)).toEqual([15, 39]);
    expect(warn).toHaveBeenCalledTimes(1);
    chart.destroy();
  });
});

describe("YTD", () => {
  it("starts at January 1 in the chart's timeZone", () => {
    // Daily bars stamped at Tokyo midnight (15:00Z the day before). The bar
    // at 15:00Z on Dec 31 is Tokyo's Jan 1; UTC's Jan 1 starts after it.
    const days = [-3, -2, -1, 0, 1, 2, 3];
    const candles = days.map((d) => ({
      time: Date.UTC(2026, 0, 1 + d, 15) - 86_400_000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1,
    }));
    const start = vi.spyOn(TimeScale.prototype, "setVisibleRangeToEnd");
    const chart = mount({ timeZone: "Asia/Tokyo", animationDuration: 0 });
    chart.setCandles(candles);
    chart.setVisibleRangeByDuration("YTD");
    expect(start).toHaveBeenLastCalledWith(3);
    chart.destroy();
  });
});
