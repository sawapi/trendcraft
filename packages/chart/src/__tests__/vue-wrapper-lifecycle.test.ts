// @vitest-environment happy-dom
/**
 * Vue TrendChart — lifecycle tests.
 *
 * Verifies mount / update / unmount behavior against a mocked ChartInstance:
 * - createChart is called once on mount, destroy on unmount
 * - setProps updates propagate via dedicated chart methods
 * - Emits forward chart events
 * - Drawings / timeframes / primitives are swapped cleanly on prop updates
 */

import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type MockChartInstance, createMockChartInstance } from "./helpers/mock-chart-instance";

const { createChartMock } = vi.hoisted(() => ({
  createChartMock: vi.fn(),
}));

vi.mock("../index", () => ({
  createChart: createChartMock,
}));

import { TrendChart } from "../../vue/TrendChart";

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
  // Prevent state leakage between tests
});

describe("Vue TrendChart lifecycle", () => {
  it("calls createChart once on mount and destroy on unmount", () => {
    const wrapper = mount(TrendChart, { props: { candles: sampleCandles } });
    expect(createChartMock).toHaveBeenCalledTimes(1);
    expect(currentMock.__state.destroyCalls).toBe(0);

    wrapper.unmount();
    expect(currentMock.__state.destroyCalls).toBe(1);
  });

  it("sets initial candles and fits content on mount", () => {
    mount(TrendChart, { props: { candles: sampleCandles } });
    expect(currentMock.setCandles).toHaveBeenCalledWith(sampleCandles);
    expect(currentMock.__state.fitContentCalls).toBe(1);
  });

  it("respects fitOnLoad=false", () => {
    mount(TrendChart, { props: { candles: sampleCandles, fitOnLoad: false } });
    expect(currentMock.__state.fitContentCalls).toBe(0);
  });

  it("updates candles when prop changes", async () => {
    const wrapper = mount(TrendChart, { props: { candles: sampleCandles } });
    expect(currentMock.__state.setCandlesCalls).toBe(1);

    const next = [
      ...sampleCandles,
      { time: 3, open: 12, high: 14, low: 11, close: 13, volume: 300 },
    ];
    await wrapper.setProps({ candles: next });
    expect(currentMock.__state.setCandlesCalls).toBe(2);
  });

  it("registers event listeners once on mount", () => {
    mount(TrendChart, { props: { candles: sampleCandles } });
    // Vue wrapper subscribes unconditionally to all four events in onMounted
    expect(currentMock.__state.eventHandlers.get("crosshairMove")?.size).toBe(1);
    expect(currentMock.__state.eventHandlers.get("seriesAdded")?.size).toBe(1);
    expect(currentMock.__state.eventHandlers.get("seriesRemoved")?.size).toBe(1);
    expect(currentMock.__state.eventHandlers.get("error")?.size).toBe(1);
  });

  it("forwards chart events as Vue emits", () => {
    const wrapper = mount(TrendChart, { props: { candles: sampleCandles } });
    const handler = [...(currentMock.__state.eventHandlers.get("crosshairMove") ?? [])][0];
    expect(handler).toBeDefined();
    handler?.({ time: 42, price: 100 });

    const emitted = wrapper.emitted("crosshairMove");
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]?.[0]).toEqual({ time: 42, price: 100 });
  });

  it("does not duplicate event registrations when props change", async () => {
    const wrapper = mount(TrendChart, { props: { candles: sampleCandles } });
    const beforeSize = currentMock.__state.eventHandlers.get("crosshairMove")?.size;

    await wrapper.setProps({ candles: [...sampleCandles], theme: "light" });

    expect(currentMock.__state.eventHandlers.get("crosshairMove")?.size).toBe(beforeSize);
  });

  it("applies theme and chartType via dedicated setters", async () => {
    const wrapper = mount(TrendChart, { props: { candles: sampleCandles, theme: "dark" } });
    await wrapper.setProps({ theme: "light" });
    expect(currentMock.setTheme).toHaveBeenCalledWith("light");

    await wrapper.setProps({ chartType: "line" });
    expect(currentMock.setChartType).toHaveBeenCalledWith("line");
  });

  it("re-applies indicators (removing previous handles) when prop changes", async () => {
    const indicatorsA = [[{ time: 1, value: 10 }]];
    const indicatorsB = [[{ time: 1, value: 20 }], [{ time: 2, value: 30 }]];

    const wrapper = mount(TrendChart, {
      props: { candles: sampleCandles, indicators: indicatorsA },
    });
    expect(currentMock.addIndicator).toHaveBeenCalledTimes(1);
    expect(currentMock.__state.indicators.size).toBe(1);

    await wrapper.setProps({ indicators: indicatorsB });
    expect(currentMock.addIndicator).toHaveBeenCalledTimes(3);
    expect(currentMock.__state.indicators.size).toBe(2);
  });

  it("swaps drawings cleanly when prop changes", async () => {
    const d1 = [{ id: "d1", type: "hline" as const, price: 100 }];
    const d2 = [{ id: "d2", type: "hline" as const, price: 200 }];

    const wrapper = mount(TrendChart, {
      props: { candles: sampleCandles, drawings: d1 as never },
    });
    expect(currentMock.__state.drawingIds.has("d1")).toBe(true);

    await wrapper.setProps({ drawings: d2 as never });
    expect(currentMock.removeDrawing).toHaveBeenCalledWith("d1");
    expect(currentMock.__state.drawingIds.has("d2")).toBe(true);
    expect(currentMock.__state.drawingIds.has("d1")).toBe(false);
  });

  it("swaps primitives cleanly when plugins prop changes", async () => {
    const a = { name: "overlay-a", kind: "primitive" as const, draw: vi.fn() };
    const b = { name: "overlay-b", kind: "primitive" as const, draw: vi.fn() };

    const wrapper = mount(TrendChart, {
      props: { candles: sampleCandles, plugins: { primitives: [a] } as never },
    });
    expect(currentMock.__state.registeredPrimitives.has("overlay-a")).toBe(true);

    await wrapper.setProps({ plugins: { primitives: [b] } as never });
    expect(currentMock.removePrimitive).toHaveBeenCalledWith("overlay-a");
    expect(currentMock.__state.registeredPrimitives.has("overlay-b")).toBe(true);

    wrapper.unmount();
    expect(currentMock.__state.destroyCalls).toBe(1);
  });
});
