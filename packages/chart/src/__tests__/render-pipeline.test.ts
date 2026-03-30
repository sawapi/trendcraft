import { describe, expect, it, vi } from "vitest";
import { DataLayer } from "../core/data-layer";
import { LayoutEngine } from "../core/layout";
import { RendererRegistry } from "../core/renderer-registry";
import { TimeScale } from "../core/scale";
import { DARK_THEME } from "../core/types";
import type { RenderContext } from "../renderer/render-pipeline";
import { renderFrame } from "../renderer/render-pipeline";
import { makeCandle, mockCtx } from "./helpers/mock-ctx";

function makeRenderContext(overrides?: Partial<RenderContext>): RenderContext {
  const ctx = mockCtx();
  const data = new DataLayer();
  const layout = new LayoutEngine();
  const timeScale = new TimeScale();
  const rendererRegistry = new RendererRegistry();

  layout.setDimensions(800, 400, 60, 24);
  timeScale.setWidth(740);

  return {
    ctx,
    pixelRatio: 1,
    canvasWidth: 800,
    canvasHeight: 400,
    theme: DARK_THEME,
    fontSize: 11,
    chartType: "candlestick",
    watermark: undefined,
    priceFormatter: (p: number) => p.toFixed(2),
    timeFormatter: undefined,
    data,
    layout,
    timeScale,
    priceScales: new Map(),
    viewportState: {
      isDragging: false,
      mouseX: 0,
      mouseY: 0,
      activePaneId: null,
      crosshairIndex: null,
    },
    rendererRegistry,
    drawHelper: null,
    emit: vi.fn(),
    ...overrides,
  };
}

describe("renderFrame", () => {
  it("returns RenderResult shape with empty data", () => {
    const rc = makeRenderContext();
    const result = renderFrame(rc);

    expect(result).toHaveProperty("crosshairIndex");
    expect(result).toHaveProperty("paneRects");
    expect(result).toHaveProperty("seriesByPane");
    expect(result).toHaveProperty("drawHelper");
    expect(result.crosshairIndex).toBeNull();
  });

  it("clears canvas with background color", () => {
    const rc = makeRenderContext();
    renderFrame(rc);

    expect(rc.ctx.fillStyle).toBeDefined();
    expect(rc.ctx.fillRect).toHaveBeenCalled();
  });

  it("renders watermark when set", () => {
    const rc = makeRenderContext({ watermark: "TEST" });
    renderFrame(rc);

    expect(rc.ctx.save).toHaveBeenCalled();
    expect(rc.ctx.fillText).toHaveBeenCalledWith("TEST", expect.any(Number), expect.any(Number));
    expect(rc.ctx.restore).toHaveBeenCalled();
  });

  it("renders candles and price axis when data is present", () => {
    const rc = makeRenderContext();
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle(
        1609459200000 + i * 86400000,
        100 + i * 2,
        105 + i * 2,
        95 + i * 2,
        1000 + i * 100,
      ),
    );
    rc.data.setCandles(candles);
    rc.timeScale.setTotalCount(candles.length);
    rc.timeScale.fitContent();

    const result = renderFrame(rc);

    expect(result.paneRects.length).toBeGreaterThan(0);
    // Canvas methods should have been called for rendering
    expect(rc.ctx.beginPath).toHaveBeenCalled();
  });

  it("handles crosshair when active", () => {
    const rc = makeRenderContext({
      viewportState: {
        isDragging: false,
        mouseX: 400,
        mouseY: 200,
        activePaneId: "main",
        crosshairIndex: 5,
      },
    });
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle(1609459200000 + i * 86400000, 100 + i),
    );
    rc.data.setCandles(candles);
    rc.timeScale.setTotalCount(candles.length);
    rc.timeScale.fitContent();

    const result = renderFrame(rc);

    expect(result.crosshairIndex).toBe(5);
    expect(rc.emit).toHaveBeenCalledWith("crosshairMove", expect.any(Object));
  });
});
