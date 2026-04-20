import { describe, expect, it, vi } from "vitest";
import { DrawHelper, strokeNullableLine, withPaneClip } from "../core/draw-helper";
import { PriceScale, TimeScale } from "../core/scale";

/** Create a minimal mock CanvasRenderingContext2D */
function mockCtx(): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    closePath: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineJoin: "miter",
    lineCap: "butt",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D;
}

function makeHelper() {
  const ts = new TimeScale();
  ts.setTotalCount(100);
  ts.setWidth(800);
  ts.fitContent();

  const ps = new PriceScale();
  ps.setHeight(400);
  ps.setDataRange(100, 200);

  const ctx = mockCtx();
  return { draw: new DrawHelper(ctx, ts, ps), ctx, ts, ps };
}

describe("DrawHelper — coordinate conversion", () => {
  it("x() delegates to timeScale.indexToX", () => {
    const { draw, ts } = makeHelper();
    expect(draw.x(10)).toBe(ts.indexToX(10));
  });

  it("y() delegates to priceScale.priceToY", () => {
    const { draw, ps } = makeHelper();
    expect(draw.y(150)).toBe(ps.priceToY(150));
  });

  it("startIndex / endIndex / barSpacing match timeScale", () => {
    const { draw, ts } = makeHelper();
    expect(draw.startIndex).toBe(ts.startIndex);
    expect(draw.endIndex).toBe(ts.endIndex);
    expect(draw.barSpacing).toBe(ts.barSpacing);
  });
});

describe("DrawHelper.line()", () => {
  it("draws a line with moveTo/lineTo for valid values", () => {
    const { draw, ctx, ts } = makeHelper();
    const start = ts.startIndex;
    const values = new Array(100).fill(null) as (number | null)[];
    values[start] = 150;
    values[start + 1] = 160;
    values[start + 2] = 155;

    draw.line(values, { color: "#FF0000", lineWidth: 2 });

    expect(ctx.strokeStyle).toBe("#FF0000");
    expect(ctx.lineWidth).toBe(2);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    // Resets dash
    expect(ctx.setLineDash).toHaveBeenLastCalledWith([]);
  });

  it("breaks line on null values (gap handling)", () => {
    const { draw, ctx, ts } = makeHelper();
    const start = ts.startIndex;
    const values = new Array(100).fill(null) as (number | null)[];
    values[start] = 150;
    values[start + 1] = null; // gap
    values[start + 2] = 160;

    draw.line(values, { color: "#000" });

    // Should have two moveTo calls (one for each segment start)
    expect(ctx.moveTo).toHaveBeenCalledTimes(2);
    // No lineTo between the gap segments
    expect(ctx.lineTo).not.toHaveBeenCalled();
  });

  it("applies dash pattern", () => {
    const { draw, ctx } = makeHelper();
    draw.line([150, 160], { color: "#000", dash: [4, 2] });
    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 2]);
  });
});

describe("DrawHelper.rect()", () => {
  it("calls fillRect with converted coordinates", () => {
    const { draw, ctx } = makeHelper();
    draw.rect(10, 180, 5, 160, { color: "rgba(0,255,0,0.3)" });

    expect(ctx.fillStyle).toBe("rgba(0,255,0,0.3)");
    expect(ctx.fillRect).toHaveBeenCalledOnce();
  });

  it("adds strokeRect when stroke option provided", () => {
    const { draw, ctx } = makeHelper();
    draw.rect(0, 200, 10, 100, { color: "blue" }, { color: "red", lineWidth: 2 });

    expect(ctx.fillRect).toHaveBeenCalledOnce();
    expect(ctx.strokeRect).toHaveBeenCalledOnce();
    expect(ctx.strokeStyle).toBe("red");
  });
});

describe("DrawHelper.fillBetween()", () => {
  it("fills area between upper and lower arrays", () => {
    const { draw, ctx, ts } = makeHelper();
    const start = ts.startIndex;
    const upper = new Array(100).fill(null) as (number | null)[];
    const lower = new Array(100).fill(null) as (number | null)[];
    for (let i = start; i < start + 5; i++) {
      upper[i] = 180;
      lower[i] = 120;
    }

    draw.fillBetween(upper, lower, { color: "rgba(0,0,255,0.1)" });

    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
  });

  it("skips segments shorter than 2 points", () => {
    const { draw, ctx, ts } = makeHelper();
    const start = ts.startIndex;
    const upper = new Array(100).fill(null) as (number | null)[];
    const lower = new Array(100).fill(null) as (number | null)[];
    upper[start] = 180;
    lower[start] = 120;
    // Only 1 point — should not draw

    draw.fillBetween(upper, lower, { color: "red" });
    expect(ctx.fill).not.toHaveBeenCalled();
  });
});

describe("DrawHelper.hline()", () => {
  it("draws a horizontal line across full width", () => {
    const { draw, ctx, ts, ps } = makeHelper();
    draw.hline(150, { color: "#FF9800" });

    expect(ctx.moveTo).toHaveBeenCalledWith(0, ps.priceToY(150));
    expect(ctx.lineTo).toHaveBeenCalledWith(ts.width, ps.priceToY(150));
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.setLineDash).toHaveBeenLastCalledWith([]);
  });

  it("applies dash pattern", () => {
    const { draw, ctx } = makeHelper();
    draw.hline(150, { color: "#000", dash: [6, 3] });
    expect(ctx.setLineDash).toHaveBeenCalledWith([6, 3]);
  });
});

describe("DrawHelper.circle()", () => {
  it("draws an arc at the correct position", () => {
    const { draw, ctx, ts, ps } = makeHelper();
    draw.circle(50, 150, 3, { color: "#26a69a" });

    expect(ctx.fillStyle).toBe("#26a69a");
    expect(ctx.arc).toHaveBeenCalledWith(ts.indexToX(50), ps.priceToY(150), 3, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalled();
  });
});

describe("DrawHelper.text()", () => {
  it("draws text at the correct position", () => {
    const { draw, ctx, ts, ps } = makeHelper();
    draw.text("Hello", 50, 150, { color: "#fff" });

    expect(ctx.fillText).toHaveBeenCalledWith("Hello", ts.indexToX(50), ps.priceToY(150));
    expect(ctx.fillStyle).toBe("#fff");
  });

  it("uses default alignment when not specified", () => {
    const { draw, ctx } = makeHelper();
    draw.text("Test", 0, 100);
    expect(ctx.textAlign).toBe("center");
    expect(ctx.textBaseline).toBe("bottom");
  });
});

describe("DrawHelper.scope()", () => {
  it("calls save/restore around the callback", () => {
    const { draw, ctx } = makeHelper();
    const inner = vi.fn();

    draw.scope(inner);

    expect(ctx.save).toHaveBeenCalledOnce();
    expect(inner).toHaveBeenCalledWith(ctx);
    expect(ctx.restore).toHaveBeenCalledOnce();
  });

  it("restores even if callback throws", () => {
    const { draw, ctx } = makeHelper();

    expect(() =>
      draw.scope(() => {
        throw new Error("test");
      }),
    ).toThrow("test");

    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });
});

describe("withPaneClip()", () => {
  const pane = { x: 10, y: 20, width: 800, height: 400 };

  it("establishes a clip rect and restores after the callback", () => {
    const ctx = mockCtx();
    const order: string[] = [];
    (ctx.save as ReturnType<typeof vi.fn>).mockImplementation(() => order.push("save"));
    (ctx.beginPath as ReturnType<typeof vi.fn>).mockImplementation(() => order.push("beginPath"));
    (ctx.rect as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => order.push("rect"));
    (ctx.clip as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => order.push("clip"));
    (ctx.restore as ReturnType<typeof vi.fn>).mockImplementation(() => order.push("restore"));

    withPaneClip(ctx, pane, () => order.push("inner"));

    expect(order).toEqual(["save", "beginPath", "rect", "clip", "inner", "restore"]);
    expect(ctx.rect).toHaveBeenCalledWith(10, 20, 800, 400);
  });

  it("restores even if the callback throws", () => {
    const ctx = mockCtx();

    expect(() =>
      withPaneClip(ctx, pane, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");

    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });
});

describe("strokeNullableLine()", () => {
  it("breaks the path at null gaps (moveTo after each gap)", () => {
    const { ctx, ts, ps } = makeHelper();
    const start = ts.startIndex;
    const values: (number | null)[] = new Array(100).fill(null);
    values[start] = 100;
    values[start + 1] = 110;
    // gap at start + 2
    values[start + 3] = 120;
    values[start + 4] = 130;

    strokeNullableLine(ctx, values, ts, ps, { color: "#0f0", lineWidth: 2 });

    expect(ctx.strokeStyle).toBe("#0f0");
    expect(ctx.lineWidth).toBe(2);
    // 2 segments → 2 moveTo calls, plus 2 lineTo (one per continuation)
    expect(ctx.moveTo).toHaveBeenCalledTimes(2);
    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalledOnce();
  });

  it("clears the line-dash it set on exit", () => {
    const { ctx, ts, ps } = makeHelper();
    const start = ts.startIndex;
    const values: (number | null)[] = new Array(100).fill(null);
    values[start] = 100;
    values[start + 1] = 110;

    strokeNullableLine(ctx, values, ts, ps, { color: "#f00", dash: [4, 2] });

    const calls = (ctx.setLineDash as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toEqual([4, 2]);
    expect(calls[calls.length - 1][0]).toEqual([]);
  });

  it("is a no-op on an all-null array (beginPath+stroke only, no path commands)", () => {
    const { ctx, ts, ps } = makeHelper();
    const values: (number | null)[] = new Array(100).fill(null);

    strokeNullableLine(ctx, values, ts, ps, { color: "#000" });

    expect(ctx.moveTo).not.toHaveBeenCalled();
    expect(ctx.lineTo).not.toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalledOnce();
  });
});
