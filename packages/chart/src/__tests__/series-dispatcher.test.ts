import { describe, expect, it, vi } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import { dispatchSeries } from "../renderer/series-dispatcher";
import { makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

function makeSeries(data: unknown[], overrides?: Partial<InternalSeries>): InternalSeries {
  return {
    id: "test",
    paneId: "main",
    scaleId: "right",
    type: "line",
    config: {},
    data: data as InternalSeries["data"],
    visible: true,
    ...overrides,
  };
}

describe("dispatchSeries", () => {
  const ctx = mockCtx();
  const ts = makeTimeScale(5, 800);
  const ps = makePriceScale(400, 0, 200);

  it("routes number data to line renderer", () => {
    const s = makeSeries([
      { time: 1, value: 100 },
      { time: 2, value: 110 },
      { time: 3, value: 105 },
    ]);
    // Should not throw
    dispatchSeries(ctx, s, ts, ps);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("routes band data to band renderer", () => {
    const s = makeSeries([
      { time: 1, value: { upper: 110, middle: 100, lower: 90 } },
      { time: 2, value: { upper: 115, middle: 105, lower: 95 } },
    ]);
    dispatchSeries(ctx, s, ts, ps);
    // Band renders fill + stroke
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("routes ichimoku data to cloud renderer", () => {
    const s = makeSeries([
      {
        time: 1,
        value: { tenkan: 100, kijun: 95, senkouA: 110, senkouB: 90, chikou: 100 },
      },
      {
        time: 2,
        value: { tenkan: 105, kijun: 98, senkouA: 115, senkouB: 92, chikou: 105 },
      },
    ]);
    dispatchSeries(ctx, s, ts, ps);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("does not throw for empty data", () => {
    const s = makeSeries([]);
    expect(() => dispatchSeries(ctx, s, ts, ps)).not.toThrow();
  });

  it("returns early when rule is not detected", () => {
    const s = makeSeries([{ time: 1, value: undefined }]);
    expect(() => dispatchSeries(ctx, s, ts, ps)).not.toThrow();
  });

  it("handles histogram type override for number data", () => {
    const newCtx = mockCtx();
    const s = makeSeries(
      [
        { time: 1, value: 5 },
        { time: 2, value: -3 },
      ],
      { config: { type: "histogram" } },
    );
    dispatchSeries(newCtx, s, ts, ps);
    expect(newCtx.fillRect).toHaveBeenCalled();
  });
});
