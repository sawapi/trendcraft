// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { ChartInstance, CrosshairMoveData, VisibleRangeChangeData } from "../core/types";
import { syncCharts } from "../integration/sync";

// Tiny fake ChartInstance exposing just the surface that syncCharts uses.
type FakeChart = Pick<
  ChartInstance,
  "on" | "off" | "setCrosshair" | "setVisibleRange" | "setVisibleLogicalRange"
> & {
  emit: (event: string, data: unknown) => void;
};

function makeFakeChart(): FakeChart {
  const listeners = new Map<string, Set<(d: unknown) => void>>();
  const chart: FakeChart = {
    on: vi.fn((event: string, handler: (d: unknown) => void) => {
      let s = listeners.get(event);
      if (!s) {
        s = new Set();
        listeners.set(event, s);
      }
      s.add(handler);
    }) as FakeChart["on"],
    off: vi.fn((event: string, handler: (d: unknown) => void) => {
      listeners.get(event)?.delete(handler);
    }) as FakeChart["off"],
    setCrosshair: vi.fn(),
    setVisibleRange: vi.fn(),
    setVisibleLogicalRange: vi.fn(),
    emit: (event, data) => {
      listeners.get(event)?.forEach((h) => h(data));
    },
  };
  return chart;
}

describe("syncCharts", () => {
  it("mirrors crosshair time from source to other charts", () => {
    const a = makeFakeChart();
    const b = makeFakeChart();
    const c = makeFakeChart();
    syncCharts([a, b, c] as unknown as ChartInstance[]);

    const move: CrosshairMoveData = {
      time: 1609459200000,
      index: 0,
      ohlcv: { open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      paneId: "main",
    };
    a.emit("crosshairMove", move);

    expect(a.setCrosshair).not.toHaveBeenCalled();
    expect(b.setCrosshair).toHaveBeenCalledWith(1609459200000);
    expect(c.setCrosshair).toHaveBeenCalledWith(1609459200000);
  });

  it("forwards null time to clear crosshairs on peer charts", () => {
    const a = makeFakeChart();
    const b = makeFakeChart();
    syncCharts([a, b] as unknown as ChartInstance[]);

    a.emit("crosshairMove", { time: null, index: null, ohlcv: null, paneId: null });
    expect(b.setCrosshair).toHaveBeenCalledWith(null);
  });

  it("does not re-enter when setCrosshair on target emits its own event", () => {
    // Simulates the ping-pong that the re-entry guard blocks: when A emits a
    // move, syncCharts calls B.setCrosshair(); if that triggers B's own
    // crosshairMove event, the handler should ignore it.
    const a = makeFakeChart();
    const b = makeFakeChart();
    (b.setCrosshair as ReturnType<typeof vi.fn>).mockImplementation((time) => {
      b.emit("crosshairMove", { time, index: null, ohlcv: null, paneId: "main" });
    });

    syncCharts([a, b] as unknown as ChartInstance[]);
    a.emit("crosshairMove", { time: 100, price: null, x: 0, y: 0, paneId: "main" });

    expect(b.setCrosshair).toHaveBeenCalledTimes(1);
    expect(a.setCrosshair).not.toHaveBeenCalled();
  });

  it("mirrors visible range only when viewport: true is passed", () => {
    const a = makeFakeChart();
    const b = makeFakeChart();
    syncCharts([a, b] as unknown as ChartInstance[], { viewport: true });

    const range: VisibleRangeChangeData = {
      startTime: 1,
      endTime: 100,
      startIndex: 0,
      endIndex: 99,
      logicalRange: { from: 0, to: 104.5 },
    };
    a.emit("visibleRangeChange", range);
    // `viewport: true` mirrors TIMES, even when a logical range is present:
    // multi-timeframe charts must translate times through their own data —
    // bar index 100 on a 1h chart and a 4h chart are different moments.
    expect(b.setVisibleRange).toHaveBeenCalledWith(1, 100);
    expect(b.setVisibleLogicalRange).not.toHaveBeenCalled();
  });

  it('viewport: "logical" mirrors the unclamped bar-index range', () => {
    const a = makeFakeChart();
    const b = makeFakeChart();
    syncCharts([a, b] as unknown as ChartInstance[], { viewport: "logical" });

    a.emit("visibleRangeChange", {
      startTime: 1,
      endTime: 100,
      startIndex: 0,
      endIndex: 99,
      logicalRange: { from: 0, to: 104.5 },
    });
    // Same-data charts only: the logical mirror round-trips the empty space
    // past the last bar that the saturated time fields cannot express.
    expect(b.setVisibleLogicalRange).toHaveBeenCalledWith(0, 104.5);
    expect(b.setVisibleRange).not.toHaveBeenCalled();
  });

  it('viewport: "logical" falls back to times when a payload has no logical range', () => {
    const a = makeFakeChart();
    const b = makeFakeChart();
    syncCharts([a, b] as unknown as ChartInstance[], { viewport: "logical" });

    a.emit("visibleRangeChange", { startTime: 1, endTime: 100, startIndex: 0, endIndex: 99 });
    expect(b.setVisibleRange).toHaveBeenCalledWith(1, 100);
    expect(b.setVisibleLogicalRange).not.toHaveBeenCalled();
  });

  it("does not mirror viewport by default", () => {
    const a = makeFakeChart();
    const b = makeFakeChart();
    syncCharts([a, b] as unknown as ChartInstance[]);

    a.emit("visibleRangeChange", { startTime: 1, endTime: 2, startIndex: 0, endIndex: 1 });
    expect(b.setVisibleRange).not.toHaveBeenCalled();
  });

  it("disposer detaches all listeners", () => {
    const a = makeFakeChart();
    const b = makeFakeChart();
    const dispose = syncCharts([a, b] as unknown as ChartInstance[], { viewport: true });
    dispose();

    a.emit("crosshairMove", { time: 100, price: null, x: 0, y: 0, paneId: "main" });
    a.emit("visibleRangeChange", { startTime: 1, endTime: 2, startIndex: 0, endIndex: 1 });

    expect(b.setCrosshair).not.toHaveBeenCalled();
    expect(b.setVisibleRange).not.toHaveBeenCalled();
  });

  it("returns a no-op when called with fewer than 2 charts", () => {
    const a = makeFakeChart();
    const dispose = syncCharts([a] as unknown as ChartInstance[]);
    expect(typeof dispose).toBe("function");
    expect(a.on).not.toHaveBeenCalled();
  });
});
