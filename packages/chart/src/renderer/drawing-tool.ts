/**
 * DrawingTool — Interactive drawing state machine.
 * Handles click-to-place drawing creation (one-click and two-click tools).
 */

import type { ChartLocale } from "../core/i18n";
import type { LayoutEngine } from "../core/layout";
import type { PointerInfo } from "../core/pointer";
import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, Drawing, DrawingType } from "../core/types";
import type { ViewportState } from "../core/viewport";

export type DrawingToolDeps = {
  getCandles: () => readonly CandleData[];
  getTimeScale: () => TimeScale;
  getLayout: () => LayoutEngine;
  getPriceScales: () => Map<string, { left: PriceScale; right: PriceScale }>;
  getViewportState: () => ViewportState;
  addDrawing: (drawing: Drawing) => void;
  emit: (event: string, data: unknown) => void;
  requestRender: () => void;
  locale: ChartLocale;
};

export class DrawingTool {
  private _activeTool: DrawingType | null = null;
  private _inProgress: { startTime: number; startPrice: number } | null = null;
  private _idCounter = 0;

  constructor(private _deps: DrawingToolDeps) {}

  get activeTool(): DrawingType | null {
    return this._activeTool;
  }

  setTool(tool: DrawingType | null): void {
    this._activeTool = tool;
    this._inProgress = null;
    this._deps.requestRender();
  }

  handleTap(pos: PointerInfo): void {
    if (!this._activeTool) return;

    const ts = this._deps.getTimeScale();
    const candles = this._deps.getCandles();
    const idx = ts.xToIndex(pos.x);
    const candle = candles[idx];
    if (!candle) return;
    const time = candle.time;

    const mainPane = this._deps.getLayout().paneRects.find((p) => p.id === "main");
    if (!mainPane) return;
    const scales = this._deps.getPriceScales().get("main");
    if (!scales) return;
    const price = scales.right.yToPrice(pos.y - mainPane.y);

    const tool = this._activeTool;
    const oneClick =
      tool === "hline" || tool === "vline" || tool === "hray" || tool === "textLabel";

    if (oneClick) {
      this._complete(time, price, time, price);
      return;
    }

    // Two-click tools
    if (!this._inProgress) {
      this._inProgress = { startTime: time, startPrice: price };
      this._deps.requestRender();
    } else {
      this._complete(this._inProgress.startTime, this._inProgress.startPrice, time, price);
    }
  }

  buildPreview(): Drawing | undefined {
    if (!this._activeTool || !this._inProgress) return undefined;

    const vs = this._deps.getViewportState();
    if (vs.crosshairIndex === null) return undefined;

    const candles = this._deps.getCandles();
    const endCandle = candles[vs.crosshairIndex];
    if (!endCandle) return undefined;

    const mainPane = this._deps.getLayout().paneRects.find((p) => p.id === "main");
    if (!mainPane) return undefined;
    const scales = this._deps.getPriceScales().get("main");
    if (!scales) return undefined;

    const endTime = endCandle.time;
    const endPrice = scales.right.yToPrice(vs.mouseY - mainPane.y);
    const { startTime, startPrice } = this._inProgress;
    const tool = this._activeTool;

    switch (tool) {
      case "trendline":
        return { id: "__preview__", type: "trendline", startTime, startPrice, endTime, endPrice };
      case "ray":
        return { id: "__preview__", type: "ray", startTime, startPrice, endTime, endPrice };
      case "arrow":
        return { id: "__preview__", type: "arrow", startTime, startPrice, endTime, endPrice };
      case "rectangle":
        return { id: "__preview__", type: "rectangle", startTime, startPrice, endTime, endPrice };
      case "fibRetracement":
        return {
          id: "__preview__",
          type: "fibRetracement",
          startTime,
          startPrice,
          endTime,
          endPrice,
        };
      case "fibExtension":
        return {
          id: "__preview__",
          type: "fibExtension",
          startTime,
          startPrice,
          endTime,
          endPrice,
        };
      case "channel":
        return {
          id: "__preview__",
          type: "channel",
          startTime,
          startPrice,
          endTime,
          endPrice,
          channelWidth: Math.abs(endPrice - startPrice) * 0.3,
        };
      default:
        return undefined;
    }
  }

  reset(): void {
    this._activeTool = null;
    this._inProgress = null;
  }

  private _complete(
    startTime: number,
    startPrice: number,
    endTime: number,
    endPrice: number,
  ): void {
    const tool = this._activeTool;
    if (!tool) return;

    const id = `draw_${++this._idCounter}`;
    let drawing: Drawing;

    switch (tool) {
      case "hline":
        drawing = { id, type: "hline", price: startPrice };
        break;
      case "vline":
        drawing = { id, type: "vline", time: startTime };
        break;
      case "hray":
        drawing = { id, type: "hray", time: startTime, price: startPrice };
        break;
      case "textLabel":
        drawing = {
          id,
          type: "textLabel",
          time: startTime,
          price: startPrice,
          text: this._deps.locale.defaultLabel,
        };
        break;
      case "trendline":
        drawing = { id, type: "trendline", startTime, startPrice, endTime, endPrice };
        break;
      case "ray":
        drawing = { id, type: "ray", startTime, startPrice, endTime, endPrice };
        break;
      case "arrow":
        drawing = { id, type: "arrow", startTime, startPrice, endTime, endPrice };
        break;
      case "rectangle":
        drawing = { id, type: "rectangle", startTime, startPrice, endTime, endPrice };
        break;
      case "fibRetracement":
        drawing = { id, type: "fibRetracement", startTime, startPrice, endTime, endPrice };
        break;
      case "fibExtension":
        drawing = { id, type: "fibExtension", startTime, startPrice, endTime, endPrice };
        break;
      case "channel": {
        const ts = this._deps.getTimeScale();
        const candles = this._deps.getCandles();
        const visStart = ts.startIndex;
        const visEnd = ts.endIndex;
        let avgRange = 0;
        let count = 0;
        for (let i = visStart; i < visEnd && i < candles.length; i++) {
          const c = candles[i];
          if (c) {
            avgRange += c.high - c.low;
            count++;
          }
        }
        const channelWidth =
          count > 0 ? (avgRange / count) * 2 : Math.abs(endPrice - startPrice) * 0.5;
        drawing = { id, type: "channel", startTime, startPrice, endTime, endPrice, channelWidth };
        break;
      }
      default:
        return;
    }

    this._deps.addDrawing(drawing);
    this._deps.emit("drawingComplete", drawing);
    this._activeTool = null;
    this._inProgress = null;
    this._deps.requestRender();
  }
}
