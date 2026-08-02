// @vitest-environment happy-dom
/**
 * timeScale.rightOffset + live-edge follow behavior.
 *
 * Two features under test:
 * - `timeScale.rightOffset`: bar-slots of empty space reserved after the
 *   last candle (scrollToEnd / fitContent / clamp / duration presets).
 * - Shift-based live-edge following: appending a bar translates the window
 *   by the appended span instead of snapping to the end position, so a
 *   custom viewport (different margin, partial pan-back) is never
 *   overridden by streaming updates.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeScale } from "../core/scale";
import type { CandleData } from "../core/types";
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

function makeCandles(count: number, startTime = 1_700_000_000_000): CandleData[] {
  return Array.from({ length: count }, (_, i) => ({
    time: startTime + i * 60_000,
    open: 100 + Math.sin(i / 5),
    high: 101 + Math.sin(i / 5),
    low: 99 + Math.sin(i / 5),
    close: 100.5 + Math.sin(i / 5),
    volume: 1000,
  }));
}

function nextBar(candles: CandleData[], offset = 1): CandleData {
  const last = candles[candles.length - 1];
  return { ...last, time: last.time + offset * 60_000 };
}

// ---- TimeScale unit behavior ----

describe("TimeScale rightOffset", () => {
  function makeScale(total = 300, width = 800): TimeScale {
    const ts = new TimeScale();
    ts.setWidth(width);
    ts.setTotalCount(total);
    return ts;
  }

  it("scrollToEnd reserves the offset (index mode); default 0 is unchanged", () => {
    const ts = makeScale();
    ts.scrollToEnd();
    const flush = ts.rawStartIndex;
    expect(flush).toBe(300 - ts.visibleCount);

    ts.setRightOffset(5);
    ts.scrollToEnd();
    expect(ts.rawStartIndex).toBe(flush + 5);

    ts.setRightOffset(2.5); // fractional allowed
    ts.scrollToEnd();
    expect(ts.rawStartIndex).toBe(flush + 2.5);
  });

  it("scrollToEnd reserves the offset in virtual (gap) mode", () => {
    const ts = makeScale(100);
    ts.setGapsBefore([
      { index: 30, size: 1.5 },
      { index: 60, size: 1.5 },
    ]);
    ts.scrollToEnd();
    const flush = ts.rawStartIndex;
    ts.setRightOffset(5);
    ts.scrollToEnd();
    // 5 extra virtual slots on the right push the window 5 bar-slots right
    // (no gaps sit inside the shifted span here, so real == virtual delta).
    expect(ts.rawStartIndex).toBeCloseTo(flush + 5, 10);
  });

  it("caps an oversized offset so at least 2 bars stay visible", () => {
    const ts = makeScale(300);
    ts.setRightOffset(10_000);
    ts.scrollToEnd();
    // effective offset = visibleCount - 2 → exactly 2 bars remain in view
    expect(ts.rawStartIndex).toBe(300 - 2);
    expect(ts.endIndex).toBe(300);
  });

  it("rejects negative and non-finite offsets as 0", () => {
    const ts = makeScale();
    ts.setRightOffset(-3);
    expect(ts.rightOffset).toBe(0);
    ts.setRightOffset(Number.NaN);
    expect(ts.rightOffset).toBe(0);
  });

  it("clamp allows scrolling to the offset position (composes with the 20% pad)", () => {
    const ts = makeScale(300);
    const pad = Math.ceil(ts.visibleCount * 0.2);

    // Offset below the pad: boundary unchanged from today
    ts.setRightOffset(Math.max(0, pad - 5));
    ts.scrollTo(10_000); // clamped to maxStart
    expect(ts.rawStartIndex).toBe(300 + pad - ts.visibleCount);

    // Offset above the pad: boundary extends so scrollToEnd's target is
    // reachable and never fights clamp
    const bigOffset = pad + 15;
    ts.setRightOffset(bigOffset);
    ts.scrollToEnd();
    const pinned = ts.rawStartIndex;
    ts.scrollBy(0); // triggers a clamp round-trip
    expect(ts.rawStartIndex).toBe(pinned);
  });

  it("fitContent includes the offset slots", () => {
    const ts = makeScale(100, 800);
    ts.fitContent();
    const flushSpacing = ts.barSpacing;
    ts.setRightOffset(100);
    ts.fitContent();
    expect(ts.barSpacing).toBeCloseTo(flushSpacing / 2, 10);
    expect(ts.startIndex).toBe(0);
  });

  it("fitContent fits the gap-expanded layout plus the offset", () => {
    const ts = makeScale(100, 800);
    ts.setGapsBefore([{ index: 50, size: 30 }]); // virtualTotal = 130
    ts.setRightOffset(10);
    ts.fitContent();
    // 140 virtual slots must share the 800px width — sizing from the raw
    // bar count would leave the last bars past the right edge.
    expect(ts.barSpacing).toBeCloseTo(800 / 140, 10);
    expect(ts.startIndex).toBe(0);
    expect(ts.visibleCount).toBeGreaterThanOrEqual(140);
  });

  it("setVisibleRangeToEnd keeps the start bar visible across session gaps", () => {
    const ts = makeScale(2000, 800);
    ts.setGapsBefore([{ index: 1900, size: 50 }]); // gap inside the window
    ts.setVisibleRangeToEnd(1700);
    // The gap consumes 50 window slots; sizing the window in real units
    // would make scrollToEnd push the start bar 50 slots out of view.
    expect(ts.startIndex).toBe(1700);
  });

  it("setVisibleRangeToEnd sizes the window to include the margin", () => {
    // 300 bars in 800px stays above the 2px minimum bar spacing.
    const ts = makeScale(2000, 800);
    ts.setVisibleRangeToEnd(1700);
    const flushSpacing = ts.barSpacing;
    expect(ts.startIndex).toBe(1700);

    ts.setRightOffset(5);
    ts.setVisibleRangeToEnd(1700);
    // Same start bar; 5 extra slots squeezed into the same width
    expect(ts.startIndex).toBe(1700);
    expect(ts.barSpacing).toBeCloseTo(flushSpacing * (300 / 305), 10);
    // The window truly ends offset slots past the data
    expect(ts.rawStartIndex + ts.visibleCount).toBeGreaterThanOrEqual(2005);
  });

  it("followLiveEdge re-establishes the end distance (shift on append, no-op otherwise)", () => {
    const ts = makeScale(300);
    ts.scrollTo(100);
    const before = ts.rawStartIndex;

    const dist = ts.endDistanceVirtual;
    ts.setTotalCount(301);
    ts.followLiveEdge(dist);
    expect(ts.rawStartIndex).toBe(before + 1);

    // No append → no movement
    ts.followLiveEdge(ts.endDistanceVirtual);
    expect(ts.rawStartIndex).toBe(before + 1);
  });

  it("followLiveEdge survives the transient index-mode clamp in gap layouts", () => {
    // A session gap wider than the index-mode overscroll pad sits inside
    // the pinned window. setTotalCount clears the virtual layout and clamps
    // in index units before the layout is re-applied — a delta-based shift
    // would inherit that clamped position and permanently lose margin.
    const gaps = (n: number) => [{ index: Math.min(95, n - 1), size: 20 }];
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);
    ts.setVisibleRange(0, 40); // ~40 visible bars
    ts.setGapsBefore(gaps(100));
    ts.scrollToEnd();
    const dist = ts.endDistanceVirtual;

    // The canvas-chart append sequence
    ts.setTotalCount(101); // clears virt + transient index-mode clamp
    ts.setGapsBefore(gaps(101)); // layout re-applied
    ts.followLiveEdge(dist);
    const followed = ts.rawStartIndex;

    // A pinned viewer must land exactly where an explicit scrollToEnd lands
    ts.scrollToEnd();
    expect(followed).toBeCloseTo(ts.rawStartIndex, 10);
  });
});

// ---- Chart-level behavior (real CanvasChart on happy-dom) ----

describe("chart rightOffset and live-edge follow", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function makeChart(rightOffset?: number) {
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
      ...(rightOffset !== undefined ? { timeScale: { rightOffset } } : {}),
    });
    return chart;
  }

  function startIndexOf(chart: ReturnType<typeof createChart>): number {
    const range = chart.getVisibleRange();
    if (!range) throw new Error("no visible range");
    return range.startIndex;
  }

  it("reserves the configured margin at the live edge", () => {
    const candles = makeCandles(300);
    const flush = makeChart();
    flush.setCandles(candles);
    const offset = makeChart(5);
    offset.setCandles(candles);
    expect(startIndexOf(offset)).toBe(startIndexOf(flush) + 5);
  });

  it("keeps the margin while streaming (append advances the window by 1)", () => {
    const candles = makeCandles(300);
    const chart = makeChart(5);
    chart.setCandles(candles);
    const before = startIndexOf(chart);

    chart.updateCandle(nextBar(candles));
    expect(startIndexOf(chart)).toBe(before + 1);
  });

  it("does not override a custom viewport on the next tick (follow shifts, never snaps)", () => {
    const candles = makeCandles(300);
    const chart = makeChart(5);
    chart.setCandles(candles);

    // The user moves to a flush view (margin 0, last bar visible) — a
    // different margin than the configured rightOffset.
    chart.setVisibleRange(candles[200].time, candles[candles.length - 1].time);
    const custom = startIndexOf(chart);

    // A snap-to-end follow would jump by 1 + rightOffset here; the shift
    // follow moves by exactly the appended bar.
    chart.updateCandle(nextBar(candles));
    expect(startIndexOf(chart)).toBe(custom + 1);
  });

  it("leaves a panned-away viewer alone", () => {
    const candles = makeCandles(300);
    const chart = makeChart(5);
    chart.setCandles(candles);

    chart.setVisibleRange(candles[0].time, candles[100].time); // last bar not visible
    const before = startIndexOf(chart);

    chart.updateCandle(nextBar(candles));
    expect(startIndexOf(chart)).toBe(before);
  });

  it("batchUpdates follows once by the total appended span", () => {
    const candles = makeCandles(300);
    const chart = makeChart(5);
    chart.setCandles(candles);
    const before = startIndexOf(chart);

    chart.batchUpdates(() => {
      for (let i = 1; i <= 10; i++) {
        chart.updateCandle(nextBar(candles, i));
      }
    });
    expect(startIndexOf(chart)).toBe(before + 10);
  });

  it("setCandles inside a batch discards the earlier follow baseline", () => {
    const candles = makeCandles(300);
    const chart = makeChart();
    chart.setCandles(candles);

    // Append (captures a baseline), then replace with a much larger dataset
    // inside the same batch. The stale baseline must not push the view past
    // the fresh scrollToEnd position into the overscroll pad.
    const bigger = makeCandles(3000);
    chart.batchUpdates(() => {
      chart.updateCandle(nextBar(candles));
      chart.setCandles(bigger);
    });
    const after = startIndexOf(chart);

    const reference = makeChart();
    reference.setCandles(bigger);
    expect(after).toBe(startIndexOf(reference));
  });

  it("applyOptions changes the margin immediately when pinned to the live edge", () => {
    const candles = makeCandles(300);
    const chart = makeChart(5);
    chart.setCandles(candles);
    const before = startIndexOf(chart);

    chart.applyOptions({ timeScale: { rightOffset: 10 } });
    expect(startIndexOf(chart)).toBe(before + 5);
  });

  it("warns and ignores an invalid rightOffset", () => {
    const chart = makeChart();
    const onError = vi.fn();
    chart.on("error", onError);
    chart.setCandles(makeCandles(300));
    const before = startIndexOf(chart);

    chart.applyOptions({ timeScale: { rightOffset: -3 } });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("rightOffset") }),
    );
    expect(startIndexOf(chart)).toBe(before);
  });

  it("duration presets stay pinned to the live edge (margin follows on the next bar)", () => {
    // 2000 one-minute candles span > 1 day, so "1D" is a strict subset.
    const candles = makeCandles(2000);
    const chart = makeChart(5);
    chart.setCandles(candles);
    chart.setVisibleRangeByDuration("1D");
    const before = startIndexOf(chart);
    expect(before).toBeGreaterThan(0);

    // The preset lands at the live edge (margin included in the window), so
    // streaming keeps following: the next bar advances the window by 1.
    chart.updateCandle(nextBar(candles));
    expect(startIndexOf(chart)).toBe(before + 1);
  });
});
