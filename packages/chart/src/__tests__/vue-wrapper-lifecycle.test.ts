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
import type { ChartEvent, CrosshairMoveData } from "../core/types";
import { CHART_EVENTS, eventProp } from "../integration/chart-event-props";
import { createMockChartInstance, type MockChartInstance } from "./helpers/mock-chart-instance";

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
    // Vue wrapper subscribes unconditionally to every event in onMounted
    // (except the legend's edit/remove requests, which need a listener)
    expect(currentMock.__state.eventHandlers.get("crosshairMove")?.size).toBe(1);
    expect(currentMock.__state.eventHandlers.get("seriesAdded")?.size).toBe(1);
    expect(currentMock.__state.eventHandlers.get("seriesRemoved")?.size).toBe(1);
    expect(currentMock.__state.eventHandlers.get("error")?.size).toBe(1);
  });

  it("forwards chart events as Vue emits", () => {
    const wrapper = mount(TrendChart, { props: { candles: sampleCandles } });
    const handler = [...(currentMock.__state.eventHandlers.get("crosshairMove") ?? [])][0];
    expect(handler).toBeDefined();
    const data: CrosshairMoveData = { time: 42, index: 3, ohlcv: null, paneId: "main" };
    handler?.(data);

    const emitted = wrapper.emitted("crosshairMove");
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]?.[0]).toEqual(data);
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

  it("applies runtime option changes when the options prop is replaced", async () => {
    const wrapper = mount(TrendChart, {
      props: { candles: sampleCandles, options: { watermark: "v1" } as never },
    });
    // Replacing options with a new object must drive applyOptions. Before the
    // fix the prop was forwarded by value (not as a getter), so the watcher
    // never re-fired and runtime option changes were silently dropped.
    await wrapper.setProps({ options: { watermark: "v2" } as never });
    expect(currentMock.applyOptions).toHaveBeenCalledWith({ watermark: "v2" });

    wrapper.unmount();
  });
});

describe("Vue TrendChart — every chart event as an emit", () => {
  const fire = (event: ChartEvent, data: unknown) => {
    for (const h of currentMock.__state.eventHandlers.get(event) ?? []) h(data);
  };

  it("re-emits each chart event the parent listens to", () => {
    // Listen to all fourteen (the legend requests need a listener to be
    // subscribed at all).
    const attrs = Object.fromEntries(CHART_EVENTS.map((e) => [eventProp(e), vi.fn()]));
    const wrapper = mount(TrendChart, { props: { candles: sampleCandles }, attrs });
    for (const e of CHART_EVENTS) {
      const data = { event: e };
      fire(e, data);
      expect(wrapper.emitted(e)?.[0]?.[0], e).toEqual(data);
    }
  });

  it("subscribes the legend's edit/remove requests only when the parent listens", () => {
    // A listener makes the legend draw its ⚙ / ✕, so subscribing without one
    // would show buttons that do nothing.
    mount(TrendChart, { props: { candles: sampleCandles } });
    expect(currentMock.__state.eventHandlers.get("seriesEditRequest")?.size ?? 0).toBe(0);
    expect(currentMock.__state.eventHandlers.get("seriesRemoveRequest")?.size ?? 0).toBe(0);

    currentMock = createMockChartInstance();
    createChartMock.mockImplementation(() => currentMock);
    mount(TrendChart, {
      props: { candles: sampleCandles },
      attrs: { onSeriesEditRequest: vi.fn() },
    });
    expect(currentMock.__state.eventHandlers.get("seriesEditRequest")?.size).toBe(1);
    expect(currentMock.__state.eventHandlers.get("seriesRemoveRequest")?.size ?? 0).toBe(0);
  });

  it.each([
    ["onSeriesRemoveRequestOnce", "@series-remove-request.once"],
    ["onSeries-remove-request", "a hyphenated render-function key"],
  ])("detects a legend listener bound as %s (%s)", (key) => {
    // emit() resolves these keys, so the request must be subscribed for them.
    mount(TrendChart, { props: { candles: sampleCandles }, attrs: { [key]: vi.fn() } });
    expect(currentMock.__state.eventHandlers.get("seriesRemoveRequest")?.size).toBe(1);
  });

  it("emits the chart's click payload on @click, not the DOM MouseEvent", async () => {
    const onClick = vi.fn();
    const wrapper = mount(TrendChart, { props: { candles: sampleCandles }, attrs: { onClick } });
    await wrapper.trigger("click");
    expect(onClick).not.toHaveBeenCalled();
    const data = { x: 1, y: 2, index: 0, time: 1 };
    fire("click", data);
    expect(onClick).toHaveBeenCalledWith(data);
  });
});
