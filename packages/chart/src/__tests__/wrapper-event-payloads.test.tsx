// @vitest-environment happy-dom
/**
 * Framework wrappers — event callback types match what the chart emits.
 *
 * `onError` was declared as `{ source, error }` while the chart emits
 * `ChartErrorPayload = { message, code?, detail? }`; `onSeriesAdded` /
 * `onSeriesRemoved` were declared as a full `SeriesInfo` while the chart emits
 * `{ id, label }` and `{ id }`. A blind cast hid the mismatch from the
 * compiler, so `onError={(e) => log(e.source)}` type-checked and logged
 * `undefined`.
 *
 * Runs against the real chart: the payloads asserted here are the ones
 * `CanvasChart` builds, not a mock's.
 */

import { act, cleanup, render } from "@testing-library/react";
import { mount } from "@vue/test-utils";
import { createRef, Suspense, startTransition, useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { TrendChart as ReactTrendChart, type TrendChartRef } from "../../react/TrendChart";
import type { UseTrendChartOptions as ReactOptions } from "../../react/useTrendChart";
import { TrendChart as VueTrendChart } from "../../vue/TrendChart";
import type { UseTrendChartOptions as VueOptions } from "../../vue/useTrendChart";
import type { ChartErrorPayload, SeriesAddedData, SeriesRemovedData } from "../index";

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

beforeEach(() => {
  document.body.innerHTML = "";
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const candles = [
  { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 200 },
];
const sma = [
  { time: 1, value: 10.5 },
  { time: 2, value: 11.5 },
];

describe("callback parameter types (compile-time)", () => {
  it("declares the emitted payload shapes, not invented ones", () => {
    const react: ReactOptions = {
      candles,
      onError: (e) => {
        const message: string = e.message;
        const code: ChartErrorPayload["code"] = e.code;
        // @ts-expect-error — `source` was never emitted by the chart
        e.source;
        return [message, code];
      },
      onSeriesAdded: (s) => {
        const added: SeriesAddedData = { id: s.id, label: s.label };
        // @ts-expect-error — `paneId` is not part of the seriesAdded payload
        s.paneId;
        return added;
      },
      onSeriesRemoved: (s) => {
        const removed: SeriesRemovedData = { id: s.id };
        // @ts-expect-error — `label` is not part of the seriesRemoved payload
        s.label;
        return removed;
      },
    };
    const vue: VueOptions = {
      candles,
      onError: (e) => {
        // @ts-expect-error — `error` was never emitted by the chart
        e.error;
        return e.message;
      },
    };
    expect(react.candles).toBe(candles);
    expect(vue.candles).toBe(candles);
  });
});

describe("React <TrendChart> event callbacks", () => {
  it("delivers the chart's own payloads to onError / onSeriesAdded / onSeriesRemoved", () => {
    const errors: ChartErrorPayload[] = [];
    const added: SeriesAddedData[] = [];
    // Each render's inline callback tags what it receives, so a dispatch to
    // the previous render's closure (the old behaviour) is distinguishable
    // from a dispatch to the current one.
    const removed: (SeriesRemovedData & { render: number })[] = [];
    const ref = createRef<TrendChartRef>();

    const { rerender } = render(
      <ReactTrendChart
        ref={ref}
        candles={candles}
        indicators={[{ data: sma, config: { label: "SMA" } }]}
        onError={(e) => errors.push(e)}
        onSeriesAdded={(s) => added.push(s)}
        onSeriesRemoved={(s) => removed.push({ ...s, render: 1 })}
      />,
    );

    // The series created from the initial `indicators` prop is observed.
    expect(added).toHaveLength(1);
    expect(added[0]).toEqual({ id: expect.any(String), label: "SMA" });

    // Drop the indicator → the wrapper releases its handle during this
    // commit's cleanups → seriesRemoved must reach render 2's callback.
    rerender(
      <ReactTrendChart
        ref={ref}
        candles={candles}
        indicators={[]}
        onError={(e) => errors.push(e)}
        onSeriesAdded={(s) => added.push(s)}
        onSeriesRemoved={(s) => removed.push({ ...s, render: 2 })}
      />,
    );
    expect(removed).toEqual([{ id: added[0].id, render: 2 }]);

    // A validation warning → onError receives the real ChartErrorPayload.
    ref.current?.chart?.setCandles("nope" as never);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "setCandles: expected an array",
      code: "INVALID_INPUT",
      detail: "string",
    });
  });
});

describe("React <TrendChart> callbacks under a pending transition", () => {
  it("dispatches to the committed render's callback, not to one React has not committed", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let released = false;
    // Suspends only while `on` and the gate is closed — a sibling that holds
    // the transition back from committing.
    function Suspender({ on }: { on: boolean }) {
      if (on && !released) throw gate;
      return null;
    }
    const log: string[] = [];
    const ref = createRef<TrendChartRef>();
    let setPending: (v: boolean) => void = () => {};
    function App() {
      const [pending, set] = useState(false);
      setPending = set;
      const tag = pending ? "pending" : "committed";
      return (
        <Suspense fallback={null}>
          <ReactTrendChart ref={ref} candles={candles} onError={() => log.push(tag)} />
          <Suspender on={pending} />
        </Suspense>
      );
    }
    render(<App />);

    // The transition renders <App> with tag "pending" and is then held back
    // by the suspended sibling: the on-screen chart is still render 1's.
    await act(async () => {
      startTransition(() => setPending(true));
    });
    act(() => {
      ref.current?.chart?.setCandles("nope" as never);
    });
    expect(log).toEqual(["committed"]);

    // Once the sibling resolves the transition commits, and only then does
    // the pending render's callback take over.
    released = true;
    await act(async () => {
      release();
      await gate;
    });
    act(() => {
      ref.current?.chart?.setCandles("nope" as never);
    });
    expect(log).toEqual(["committed", "pending"]);
  });
});

describe("Vue <TrendChart> event emits", () => {
  it("forwards the chart's own payloads on error / seriesAdded / seriesRemoved", async () => {
    const wrapper = mount(VueTrendChart, {
      props: {
        candles,
        indicators: [{ data: sma, config: { label: "SMA" } }],
      },
      attachTo: document.body,
    });

    const added = wrapper.emitted("seriesAdded") as SeriesAddedData[][];
    expect(added).toHaveLength(1);
    expect(added[0][0]).toEqual({ id: expect.any(String), label: "SMA" });

    await wrapper.setProps({ indicators: [] });
    await nextTick();
    const removed = wrapper.emitted("seriesRemoved") as SeriesRemovedData[][];
    expect(removed).toEqual([[{ id: added[0][0].id }]]);

    const exposed = wrapper.vm as unknown as { chart: () => { setCandles: (c: unknown) => void } };
    exposed.chart().setCandles("nope");
    const errors = wrapper.emitted("error") as ChartErrorPayload[][];
    expect(errors).toHaveLength(1);
    expect(errors[0][0]).toMatchObject({
      message: "setCandles: expected an array",
      code: "INVALID_INPUT",
      detail: "string",
    });
    wrapper.unmount();
  });
});
