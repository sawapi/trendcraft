// @vitest-environment happy-dom
/**
 * Framework wrappers — `options` is applied as a diff, never replayed whole.
 *
 * The React hook used to pass the entire `options` object to
 * `chart.applyOptions()` once the chart existed and again on every identity
 * change; the Vue composable replayed the whole object on every change.
 * `applyOptions` warns (console + `error` event) for creation-only fields
 * (`locale`, `pixelRatio`, ...), so a user who set `locale` once at creation
 * saw "cannot be changed at runtime" on mount and on every parent re-render
 * with an inline `options` literal — for a field they never changed.
 *
 * Runs against the real chart so the warning path is the real one.
 */

import { cleanup, render } from "@testing-library/react";
import { mount } from "@vue/test-utils";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, reactive, ref } from "vue";
import { TrendChart as ReactTrendChart } from "../../react/TrendChart";
import { useTrendChart as useVueTrendChart } from "../../vue/useTrendChart";
import type { ChartOptions } from "../core/types";
import { CanvasChart } from "../renderer/canvas-chart";

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

const candles = [
  { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 200 },
];

const locale = { volume: "Vol" };

let applyOptions: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  document.body.innerHTML = "";
  applyOptions = vi.spyOn(CanvasChart.prototype, "applyOptions");
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  applyOptions.mockRestore();
  warn.mockRestore();
});

/** The runtime-warning text `applyOptions` emits for creation-only fields. */
const runtimeWarning = (calls: unknown[][]) =>
  calls.filter((c) => String(c[0]).includes("cannot be changed at runtime"));

describe("React <TrendChart options>", () => {
  it("does not replay creation-time options on mount, so `locale` produces no warning", () => {
    render(<ReactTrendChart candles={candles} options={{ locale }} />);
    expect(applyOptions).not.toHaveBeenCalled();
    expect(runtimeWarning(warn.mock.calls)).toHaveLength(0);
  });

  it("applies only the keys whose value changed, and nothing for an equal inline literal", () => {
    const { rerender } = render(<ReactTrendChart candles={candles} options={{ locale }} />);

    // Same content, new object identity — the common inline-literal idiom.
    rerender(<ReactTrendChart candles={candles} options={{ locale: { volume: "Vol" } }} />);
    expect(applyOptions).not.toHaveBeenCalled();

    rerender(<ReactTrendChart candles={candles} options={{ locale, watermark: "AAPL" }} />);
    expect(applyOptions).toHaveBeenCalledTimes(1);
    expect(applyOptions).toHaveBeenLastCalledWith({ watermark: "AAPL" });

    // Stimulus check: the diff really reached the chart — the watermark was
    // applied — while the untouched creation-only field never warned.
    expect(runtimeWarning(warn.mock.calls)).toHaveLength(0);
  });

  it("does not warn when options are dropped and re-supplied unchanged", () => {
    const { rerender } = render(<ReactTrendChart candles={candles} options={{ locale }} />);
    rerender(<ReactTrendChart candles={candles} options={undefined} />);
    rerender(<ReactTrendChart candles={candles} options={{ locale }} />);
    expect(applyOptions).not.toHaveBeenCalled();
    expect(runtimeWarning(warn.mock.calls)).toHaveLength(0);
  });

  it("still warns when the user actually changes a creation-only field", () => {
    const { rerender } = render(<ReactTrendChart candles={candles} options={{ locale }} />);
    rerender(<ReactTrendChart candles={candles} options={{ locale: { volume: "Volume" } }} />);
    expect(applyOptions).toHaveBeenCalledTimes(1);
    expect(applyOptions).toHaveBeenLastCalledWith({ locale: { volume: "Volume" } });
    expect(runtimeWarning(warn.mock.calls)).toHaveLength(1);
  });
});

describe("Vue useTrendChart({ options })", () => {
  function harness(options: () => ChartOptions | undefined) {
    return mount(
      defineComponent({
        setup() {
          const { containerRef } = useVueTrendChart({ candles, options });
          return () => h("div", { ref: containerRef });
        },
      }),
      { attachTo: document.body },
    );
  }

  it("does not replay creation-time options on mount", () => {
    const wrapper = harness(() => ({ locale }));
    expect(applyOptions).not.toHaveBeenCalled();
    expect(runtimeWarning(warn.mock.calls)).toHaveLength(0);
    wrapper.unmount();
  });

  it("applies only the changed key when the options object is replaced", async () => {
    const options = ref<ChartOptions>({ locale });
    const wrapper = harness(() => options.value);

    options.value = { locale: { volume: "Vol" } };
    await nextTick();
    expect(applyOptions).not.toHaveBeenCalled();

    options.value = { locale, watermark: "AAPL" };
    await nextTick();
    expect(applyOptions).toHaveBeenCalledTimes(1);
    expect(applyOptions).toHaveBeenLastCalledWith({ watermark: "AAPL" });
    expect(runtimeWarning(warn.mock.calls)).toHaveLength(0);
    wrapper.unmount();
  });

  it("applies only the changed key when a nested field is mutated in place", async () => {
    const options = reactive<ChartOptions>({ locale, crosshair: { mode: "normal" } });
    const wrapper = harness(() => options);

    (options.crosshair as { mode: string }).mode = "magnet";
    await nextTick();
    expect(applyOptions).toHaveBeenCalledTimes(1);
    expect(applyOptions).toHaveBeenLastCalledWith({ crosshair: { mode: "magnet" } });
    expect(runtimeWarning(warn.mock.calls)).toHaveLength(0);
    wrapper.unmount();
  });
});
