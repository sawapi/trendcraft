import { describe, expect, it, vi } from "vitest";
import { renderHeatmap } from "../series/heatmap";
import { makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

describe("renderHeatmap", () => {
  it("no channels → no draw (but resets line dash)", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(5, 800);
    const ps = makePriceScale(300, 100, 200);
    renderHeatmap(ctx, new Map(), ts, ps, 800);
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
  });

  it("draws POC on the first non-null value, then stops", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(5, 800);
    const ps = makePriceScale(300, 100, 200);
    renderHeatmap(ctx, new Map([["poc", [null, null, 150, 160, 170]]]), ts, ps, 800);
    // POC draws once (single stroke call minimum for POC)
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it("all-null POC draws nothing", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(4, 800);
    const ps = makePriceScale(300, 100, 200);
    renderHeatmap(ctx, new Map([["poc", [null, null, null, null]]]), ts, ps, 800);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("draws VAH + VAL when both present (2 strokes)", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(3, 800);
    const ps = makePriceScale(300, 100, 200);
    renderHeatmap(
      ctx,
      new Map([
        ["vah", [180, null, null]],
        ["val", [120, null, null]],
      ]),
      ts,
      ps,
      800,
    );
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });

  it("POC color overridden by options", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(3, 800);
    const ps = makePriceScale(300, 100, 200);
    const colors: string[] = [];
    Object.defineProperty(ctx, "strokeStyle", {
      set(v: string) {
        colors.push(v);
      },
      get() {
        return "";
      },
    });
    renderHeatmap(ctx, new Map([["poc", [150, 150, 150]]]), ts, ps, 800, { pocColor: "#FF0000" });
    expect(colors).toContain("#FF0000");
  });
});
