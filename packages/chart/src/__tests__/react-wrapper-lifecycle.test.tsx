// @vitest-environment happy-dom
/**
 * React TrendChart — lifecycle tests.
 *
 * Verifies mount / update / unmount behavior against a mocked ChartInstance:
 * - createChart is called once on mount, destroy on unmount
 * - Prop updates propagate via dedicated chart methods
 * - Event handlers are (un)registered without duplicates
 * - Indicator handles / drawings / timeframes / primitives are released on update and unmount
 */

import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type MockChartInstance, createMockChartInstance } from "./helpers/mock-chart-instance";

const { createChartMock } = vi.hoisted(() => ({
  createChartMock: vi.fn(),
}));

vi.mock("../index", () => ({
  createChart: createChartMock,
}));

import { TrendChart, type TrendChartRef } from "../../react/TrendChart";

let currentMock: MockChartInstance;

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

describe("React TrendChart lifecycle", () => {
  it("calls createChart once on mount and destroy on unmount", () => {
    const { unmount } = render(<TrendChart candles={sampleCandles} />);
    expect(createChartMock).toHaveBeenCalledTimes(1);
    expect(currentMock.__state.destroyCalls).toBe(0);

    unmount();
    expect(currentMock.__state.destroyCalls).toBe(1);
    expect(currentMock.__state.destroyed).toBe(true);
  });

  it("exposes ChartInstance via imperative ref", () => {
    const ref = createRef<TrendChartRef>();
    render(<TrendChart ref={ref} candles={sampleCandles} />);
    expect(ref.current?.chart).toBe(currentMock);
  });

  it("propagates candles prop updates to setCandles and fitContent", () => {
    const { rerender } = render(<TrendChart candles={sampleCandles} />);
    expect(currentMock.__state.setCandlesCalls).toBe(1);
    expect(currentMock.__state.fitContentCalls).toBe(1);

    const next = [
      ...sampleCandles,
      { time: 3, open: 12, high: 14, low: 11, close: 13, volume: 300 },
    ];
    rerender(<TrendChart candles={next} />);
    expect(currentMock.__state.setCandlesCalls).toBe(2);
    expect(currentMock.__state.fitContentCalls).toBe(2);
  });

  it("honors fitOnLoad=false", () => {
    render(<TrendChart candles={sampleCandles} fitOnLoad={false} />);
    expect(currentMock.__state.setCandlesCalls).toBe(1);
    expect(currentMock.__state.fitContentCalls).toBe(0);
  });

  it("applies theme and chart type changes via dedicated setters", () => {
    const { rerender } = render(<TrendChart candles={sampleCandles} theme="dark" />);
    const themeBefore = currentMock.__state.setThemeCalls;
    rerender(<TrendChart candles={sampleCandles} theme="light" />);
    expect(currentMock.__state.setThemeCalls).toBeGreaterThan(themeBefore);

    rerender(<TrendChart candles={sampleCandles} theme="light" chartType="line" />);
    expect(currentMock.setChartType).toHaveBeenCalledWith("line");
  });

  it("registers event handlers once and unregisters on unmount", () => {
    const onCrosshairMove = vi.fn();
    const onError = vi.fn();
    const { unmount } = render(
      <TrendChart candles={sampleCandles} onCrosshairMove={onCrosshairMove} onError={onError} />,
    );
    expect(currentMock.__state.eventHandlers.get("crosshairMove")?.size).toBe(1);
    expect(currentMock.__state.eventHandlers.get("error")?.size).toBe(1);

    unmount();
    // destroy() clears all handlers
    expect(currentMock.__state.eventHandlers.size).toBe(0);
  });

  it("does not duplicate event handlers when unrelated props change", () => {
    const onCrosshairMove = vi.fn();
    const { rerender } = render(
      <TrendChart candles={sampleCandles} onCrosshairMove={onCrosshairMove} />,
    );
    expect(currentMock.__state.eventHandlers.get("crosshairMove")?.size).toBe(1);

    // Unrelated prop change — handler identity unchanged, should remain single registration
    rerender(
      <TrendChart candles={sampleCandles} onCrosshairMove={onCrosshairMove} theme="light" />,
    );
    expect(currentMock.__state.eventHandlers.get("crosshairMove")?.size).toBe(1);
  });

  it("swaps event handler cleanly when callback identity changes", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<TrendChart candles={sampleCandles} onCrosshairMove={first} />);
    expect(currentMock.__state.eventHandlers.get("crosshairMove")?.size).toBe(1);

    rerender(<TrendChart candles={sampleCandles} onCrosshairMove={second} />);
    expect(currentMock.__state.eventHandlers.get("crosshairMove")?.size).toBe(1);
  });

  it("removes indicator handles when indicators prop changes", () => {
    const indicatorsA = [[{ time: 1, value: 10 }]];
    const indicatorsB = [[{ time: 1, value: 20 }], [{ time: 2, value: 30 }]];

    const { rerender } = render(<TrendChart candles={sampleCandles} indicators={indicatorsA} />);
    expect(currentMock.addIndicator).toHaveBeenCalledTimes(1);
    expect(currentMock.__state.indicators.size).toBe(1);

    rerender(<TrendChart candles={sampleCandles} indicators={indicatorsB} />);
    // Previous handle removed, 2 new handles added
    expect(currentMock.addIndicator).toHaveBeenCalledTimes(3);
    expect(currentMock.__state.indicators.size).toBe(2);
  });

  it("cleans up drawings and timeframes on unmount", () => {
    const drawings = [{ id: "d1", type: "hline" as const, price: 100 }];
    const timeframes = [{ id: "tf1", candles: sampleCandles }];
    const { unmount } = render(
      <TrendChart candles={sampleCandles} drawings={drawings} timeframes={timeframes as never} />,
    );
    expect(currentMock.__state.drawingIds.has("d1")).toBe(true);
    expect(currentMock.__state.timeframeIds.has("tf1")).toBe(true);

    unmount();
    expect(currentMock.removeDrawing).toHaveBeenCalledWith("d1");
    expect(currentMock.removeTimeframe).toHaveBeenCalledWith("tf1");
  });

  it("removes registered primitives when plugins prop changes", () => {
    const pluginA = { name: "overlay-a", kind: "primitive" as const, draw: vi.fn() };
    const pluginB = { name: "overlay-b", kind: "primitive" as const, draw: vi.fn() };

    const { rerender, unmount } = render(
      <TrendChart candles={sampleCandles} plugins={{ primitives: [pluginA as never] }} />,
    );
    expect(currentMock.__state.registeredPrimitives.has("overlay-a")).toBe(true);

    rerender(<TrendChart candles={sampleCandles} plugins={{ primitives: [pluginB as never] }} />);
    // Prev plugin removed on cleanup
    expect(currentMock.removePrimitive).toHaveBeenCalledWith("overlay-a");
    expect(currentMock.__state.registeredPrimitives.has("overlay-b")).toBe(true);

    unmount();
    expect(currentMock.removePrimitive).toHaveBeenCalledWith("overlay-b");
  });

  it("forwards emitted events to handlers", () => {
    const onCrosshairMove = vi.fn();
    render(<TrendChart candles={sampleCandles} onCrosshairMove={onCrosshairMove} />);

    const handler = [...(currentMock.__state.eventHandlers.get("crosshairMove") ?? [])][0];
    expect(handler).toBeDefined();
    act(() => {
      handler?.({ time: 42, price: 100 });
    });
    expect(onCrosshairMove).toHaveBeenCalledWith({ time: 42, price: 100 });
  });
});
