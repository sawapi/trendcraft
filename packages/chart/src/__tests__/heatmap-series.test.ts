import { describe, expect, it } from "vitest";
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

  it("draws POC as one stroke stepping through every non-null bar", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(5, 800);
    const ps = makePriceScale(300, 100, 200);
    renderHeatmap(ctx, new Map([["poc", [null, null, 150, 160, 170]]]), ts, ps, 800);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    // Each bar's level is drawn at its own price.
    const ys = new Set(
      (ctx.lineTo as unknown as { mock: { calls: number[][] } }).mock.calls.map((c) => c[1]),
    );
    expect(ys.size).toBe(3);
  });

  it("draws each bar's level at the same place whatever the scroll position", () => {
    const poc = Array.from({ length: 200 }, (_, i) => 100 + i * 0.1);
    const yOfBar = (start: number) => {
      const ctx = mockCtx();
      const ts = makeTimeScale(200, 800);
      ts.setVisibleRange(start, start + 50);
      const ps = makePriceScale(300, 90, 130);
      renderHeatmap(ctx, new Map([["poc", poc]]), ts, ps, 800);
      const calls = (ctx.lineTo as unknown as { mock: { calls: number[][] } }).mock.calls;
      const x = ts.indexToX(120) + ts.barSpacing / 2;
      return calls.find((c) => Math.abs(c[0] - x) < 0.01)?.[1];
    };
    // Bar 120 is visible from both positions; its POC line must not move.
    expect(yOfBar(100)).toBeDefined();
    expect(yOfBar(100)).toBe(yOfBar(110));
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
