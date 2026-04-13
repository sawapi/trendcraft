// @vitest-environment happy-dom
/**
 * Vue useTrendChart — composable lifecycle tests.
 *
 * Directly exercises the `useTrendChart` composable by mounting a minimal
 * harness component and verifying chart creation, reactive option updates,
 * and unmount cleanup.
 */

import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, shallowRef } from "vue";
import { type MockChartInstance, createMockChartInstance } from "./helpers/mock-chart-instance";

const { createChartMock } = vi.hoisted(() => ({
  createChartMock: vi.fn(),
}));

vi.mock("../index", () => ({
  createChart: createChartMock,
}));

import { useTrendChart } from "../../vue/useTrendChart";

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
  // no global state to reset
});

describe("useTrendChart (Vue)", () => {
  it("creates chart on mount and destroys on unmount; chart becomes a ShallowRef", () => {
    const Harness = defineComponent({
      setup(_, { expose }) {
        const { containerRef, chart } = useTrendChart({ candles: sampleCandles });
        expose({ chart });
        return () => h("div", { ref: containerRef });
      },
    });

    const wrapper = mount(Harness);
    expect(createChartMock).toHaveBeenCalledTimes(1);
    // Vue auto-unwraps exposed refs on the public instance
    const exposed = wrapper.vm as unknown as { chart: unknown };
    expect(exposed.chart).toBe(currentMock);

    wrapper.unmount();
    expect(currentMock.__state.destroyCalls).toBe(1);
  });

  it("seeds candles and fits content on mount", () => {
    const Harness = defineComponent({
      setup() {
        const { containerRef } = useTrendChart({ candles: sampleCandles });
        return () => h("div", { ref: containerRef });
      },
    });
    mount(Harness);
    expect(currentMock.setCandles).toHaveBeenCalledWith(sampleCandles);
    expect(currentMock.__state.fitContentCalls).toBe(1);
  });

  it("reacts to candles changes via a getter option", async () => {
    const candlesRef = ref(sampleCandles);
    const Harness = defineComponent({
      setup() {
        const { containerRef } = useTrendChart({ candles: () => candlesRef.value });
        return () => h("div", { ref: containerRef });
      },
    });
    mount(Harness);
    expect(currentMock.__state.setCandlesCalls).toBe(1);

    candlesRef.value = [
      ...sampleCandles,
      { time: 3, open: 12, high: 14, low: 11, close: 13, volume: 300 },
    ];
    await Promise.resolve();
    await Promise.resolve();
    expect(currentMock.__state.setCandlesCalls).toBe(2);
  });

  it("re-applies indicators when the reactive option changes", async () => {
    const indicatorsRef = ref<unknown[]>([[{ time: 1, value: 10 }]]);
    const Harness = defineComponent({
      setup() {
        const { containerRef } = useTrendChart({
          candles: sampleCandles,
          indicators: () => indicatorsRef.value as never,
        });
        return () => h("div", { ref: containerRef });
      },
    });
    mount(Harness);
    expect(currentMock.addIndicator).toHaveBeenCalledTimes(1);

    indicatorsRef.value = [[{ time: 1, value: 20 }], [{ time: 2, value: 30 }]];
    await Promise.resolve();
    await Promise.resolve();

    expect(currentMock.addIndicator).toHaveBeenCalledTimes(3);
    expect(currentMock.__state.indicators.size).toBe(2);
  });

  it("forwards chart events to composable callbacks", () => {
    const onCrosshairMove = vi.fn();
    const Harness = defineComponent({
      setup() {
        const { containerRef } = useTrendChart({ candles: sampleCandles, onCrosshairMove });
        return () => h("div", { ref: containerRef });
      },
    });
    mount(Harness);
    const handler = [...(currentMock.__state.eventHandlers.get("crosshairMove") ?? [])][0];
    handler?.({ time: 1, price: 100 });
    expect(onCrosshairMove).toHaveBeenCalledWith({ time: 1, price: 100 });
  });

  it("chart shallow ref stays identity-stable across unrelated re-renders", async () => {
    const trigger = ref(0);
    const captured = shallowRef<unknown[]>([]);
    const Harness = defineComponent({
      setup() {
        const { containerRef, chart } = useTrendChart({ candles: sampleCandles });
        return () => {
          // Force dependency on `trigger`
          void trigger.value;
          captured.value.push(chart.value);
          return h("div", { ref: containerRef });
        };
      },
    });
    mount(Harness);
    trigger.value++;
    await Promise.resolve();
    await Promise.resolve();

    const nonNull = captured.value.filter((c) => c !== null);
    // All non-null captures point at the same chart instance
    expect(new Set(nonNull).size).toBe(1);
    expect(nonNull[0]).toBe(currentMock);
  });
});
