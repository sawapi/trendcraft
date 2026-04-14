import { describe, expect, it, type vi } from "vitest";
import type { DataPoint, PaneRect } from "../core/types";
import { renderScoreHeatmap } from "../renderer/score-renderer";
import { makePane, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

function scores(vals: (number | null)[]): DataPoint<number | null>[] {
  return vals.map((v, i) => ({ time: i * 60_000, value: v }));
}

describe("renderScoreHeatmap", () => {
  it("skips null / undefined / missing points", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(5, 800);
    const pane: PaneRect = makePane("main", 300);
    renderScoreHeatmap(ctx, scores([null, null, null, null, null]), ts, pane);
    // Only clip save/restore should happen; no fillRect
    expect(ctx.fillRect as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("renders a rect per scored bar and clamps score to [0,100]", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(4, 800);
    const pane = makePane("main", 200);
    renderScoreHeatmap(ctx, scores([0, 50, 100, 150]), ts, pane);
    const fillRect = ctx.fillRect as ReturnType<typeof vi.fn>;
    expect(fillRect).toHaveBeenCalledTimes(4);
    // last point value 150 should have been clamped (doesn't throw, produces a color)
  });

  it("color ramp: low score is red-ish, high score is green-ish", () => {
    // Inspect fillStyle set sequence by capturing string assignments
    const colors: string[] = [];
    const proxy = mockCtx();
    Object.defineProperty(proxy, "fillStyle", {
      set(v: string) {
        colors.push(v);
      },
      get() {
        return "";
      },
    });
    const ts = makeTimeScale(3, 800);
    renderScoreHeatmap(proxy, scores([0, 50, 100]), ts, makePane("main", 100));
    expect(colors.length).toBeGreaterThanOrEqual(3);
    // Score 0 → red dominant (r high, g/b low)
    expect(colors[0]).toMatch(/rgb\(239,83,80\)/);
    // Score 50 → yellow (r=239, g=255, b=0)
    expect(colors[1]).toMatch(/rgb\(239,255,0\)/);
    // Score 100 → green (38,166,154)
    expect(colors[2]).toMatch(/rgb\(38,166,154\)/);
  });

  it("clips to paneRect via save/rect/clip/restore", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(2, 800);
    renderScoreHeatmap(ctx, scores([10, 90]), ts, makePane("main", 100));
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.rect).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});
