/**
 * Drawings live on the price pane: taps elsewhere are ignored, and a
 * two-click tool's preview is hidden while the cursor is outside it.
 */
import { describe, expect, it, vi } from "vitest";
import { PriceScale, TimeScale } from "../core/scale";
import { DrawingTool } from "../renderer/drawing-tool";
import { makeCandle } from "./helpers/mock-ctx";

function setup() {
  const candles = Array.from({ length: 50 }, (_, i) => makeCandle(i * 86_400_000, 100 + i));
  const ts = new TimeScale();
  ts.setTotalCount(candles.length);
  ts.setWidth(500);
  ts.fitContent();
  const main = new PriceScale();
  main.setHeight(300);
  main.setDataRange(90, 160);
  const viewport = { crosshairIndex: 10, mouseY: 0 };
  const addDrawing = vi.fn();
  const tool = new DrawingTool({
    getCandles: () => candles,
    getTimeScale: () => ts,
    getLayout: () =>
      ({
        paneRects: [
          { id: "main", x: 0, y: 0, width: 500, height: 300 },
          { id: "volume", x: 0, y: 300, width: 500, height: 100 },
        ],
      }) as never,
    getPriceScales: () => new Map([["main", { left: main, right: main }]]),
    getViewportState: () => viewport as never,
    addDrawing,
    emit: vi.fn() as never,
    requestRender: vi.fn(),
    locale: {} as never,
  });
  return { tool, viewport, addDrawing };
}

describe("drawing tool outside the price pane", () => {
  it("hides the two-click preview while the cursor is in the volume pane", () => {
    const { tool, viewport } = setup();
    tool.setTool("trendline");
    expect(tool.handleTap({ x: 100, y: 150 } as never)).toBe(true); // first anchor on the price pane
    viewport.mouseY = 150;
    expect(tool.buildPreview()).toBeDefined();
    viewport.mouseY = 350; // volume pane
    expect(tool.buildPreview()).toBeUndefined();
  });

  it("ignores the second tap in the volume pane and keeps the tool", () => {
    const { tool, addDrawing } = setup();
    tool.setTool("trendline");
    tool.handleTap({ x: 100, y: 150 } as never);
    tool.handleTap({ x: 200, y: 350 } as never);
    expect(addDrawing).not.toHaveBeenCalled();
    expect(tool.isActive()).toBe(true);
    tool.handleTap({ x: 200, y: 120 } as never);
    expect(addDrawing).toHaveBeenCalledTimes(1);
  });
});
