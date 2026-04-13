// @vitest-environment happy-dom
/**
 * React useTrendChart — hook lifecycle tests.
 *
 * Directly exercises the `useTrendChart` hook against a mocked ChartInstance,
 * verifying that the hook returns a reactive `chart` value (null → instance)
 * suitable for use in effect dependencies, and that the common per-option
 * reactivity works (theme / indicators / unmount cleanup).
 */

import { act, cleanup, render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type MockChartInstance, createMockChartInstance } from "./helpers/mock-chart-instance";

const { createChartMock } = vi.hoisted(() => ({
  createChartMock: vi.fn(),
}));

vi.mock("../index", () => ({
  createChart: createChartMock,
}));

import { type UseTrendChartOptions, useTrendChart } from "../../react/useTrendChart";

let currentMock: MockChartInstance;

function Harness({
  opts,
  onChart,
}: {
  opts: UseTrendChartOptions;
  onChart?: (chart: ReturnType<typeof useTrendChart>["chart"]) => void;
}) {
  const { containerRef, chart } = useTrendChart(opts);
  const prev = useRef<typeof chart>(null);
  useEffect(() => {
    if (chart !== prev.current) {
      prev.current = chart;
      onChart?.(chart);
    }
  }, [chart, onChart]);
  return <div ref={containerRef} data-testid="chart-host" />;
}

const sampleCandles = [
  { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 200 },
];

beforeEach(() => {
  currentMock = createMockChartInstance();
  createChartMock.mockReset();
  createChartMock.mockImplementation(() => currentMock);
});

afterEach(() => {
  cleanup();
});

describe("useTrendChart (React)", () => {
  it("returns null chart before mount, live instance after", () => {
    const onChart = vi.fn();
    render(<Harness opts={{ candles: sampleCandles }} onChart={onChart} />);
    expect(onChart).toHaveBeenCalledTimes(1);
    // First call is the live instance (null → instance transition is one update)
    expect(onChart).toHaveBeenLastCalledWith(currentMock);
  });

  it("creates chart on mount and destroys on unmount", () => {
    const { unmount } = render(<Harness opts={{ candles: sampleCandles }} />);
    expect(createChartMock).toHaveBeenCalledTimes(1);
    expect(currentMock.__state.destroyCalls).toBe(0);

    unmount();
    expect(currentMock.__state.destroyCalls).toBe(1);
  });

  it("propagates candles and theme changes through dedicated setters", () => {
    const { rerender } = render(<Harness opts={{ candles: sampleCandles, theme: "dark" }} />);
    const setCandlesBefore = currentMock.__state.setCandlesCalls;
    const setThemeBefore = currentMock.__state.setThemeCalls;

    rerender(<Harness opts={{ candles: [...sampleCandles], theme: "light" }} />);

    expect(currentMock.__state.setCandlesCalls).toBeGreaterThan(setCandlesBefore);
    expect(currentMock.__state.setThemeCalls).toBeGreaterThan(setThemeBefore);
  });

  it("re-applies indicators (releasing previous handles) when option changes", () => {
    const a = [[{ time: 1, value: 10 }]];
    const b = [[{ time: 1, value: 20 }], [{ time: 2, value: 30 }]];

    const { rerender } = render(<Harness opts={{ candles: sampleCandles, indicators: a }} />);
    expect(currentMock.addIndicator).toHaveBeenCalledTimes(1);
    expect(currentMock.__state.indicators.size).toBe(1);

    rerender(<Harness opts={{ candles: sampleCandles, indicators: b }} />);
    expect(currentMock.addIndicator).toHaveBeenCalledTimes(3);
    expect(currentMock.__state.indicators.size).toBe(2);
  });

  it("wires event handlers and tears them down on unmount", () => {
    const onCrosshairMove = vi.fn();
    const { unmount } = render(<Harness opts={{ candles: sampleCandles, onCrosshairMove }} />);
    expect(currentMock.__state.eventHandlers.get("crosshairMove")?.size).toBe(1);

    const handler = [...(currentMock.__state.eventHandlers.get("crosshairMove") ?? [])][0];
    act(() => {
      handler?.({ time: 1, price: 100 });
    });
    expect(onCrosshairMove).toHaveBeenCalledWith({ time: 1, price: 100 });

    unmount();
    // destroy() clears all handlers
    expect(currentMock.__state.eventHandlers.size).toBe(0);
  });

  it("chart is reactive: effect with chart in deps fires exactly once per instance", () => {
    const effect = vi.fn();
    function Consumer() {
      const { containerRef, chart } = useTrendChart({ candles: sampleCandles });
      useEffect(() => {
        if (!chart) return;
        effect(chart);
      }, [chart]);
      return <div ref={containerRef} />;
    }

    const { rerender, unmount } = render(<Consumer />);
    expect(effect).toHaveBeenCalledTimes(1);
    expect(effect).toHaveBeenLastCalledWith(currentMock);

    // Unrelated re-render shouldn't re-fire the effect (chart identity stable)
    rerender(<Consumer />);
    expect(effect).toHaveBeenCalledTimes(1);

    unmount();
  });
});
