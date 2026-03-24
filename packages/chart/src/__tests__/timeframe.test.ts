import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import type { CandleData, TimeframeOverlay } from "../core/types";

function makeCandle(time: number, close: number): CandleData {
  return { time, open: close - 1, high: close + 2, low: close - 2, close, volume: 1000 };
}

describe("Timeframe Overlays", () => {
  it("adds and retrieves a timeframe overlay", () => {
    const dl = new DataLayer();
    const overlay: TimeframeOverlay = {
      id: "weekly",
      candles: [makeCandle(1000, 100), makeCandle(2000, 110)],
      timeframe: "1W",
    };
    dl.addTimeframe(overlay);

    expect(dl.timeframes.length).toBe(1);
    expect(dl.timeframes[0].timeframe).toBe("1W");
  });

  it("removes a timeframe overlay", () => {
    const dl = new DataLayer();
    dl.addTimeframe({
      id: "weekly",
      candles: [makeCandle(1000, 100)],
      timeframe: "1W",
    });
    dl.addTimeframe({
      id: "monthly",
      candles: [makeCandle(1000, 100)],
      timeframe: "1M",
    });

    expect(dl.timeframes.length).toBe(2);
    dl.removeTimeframe("weekly");
    expect(dl.timeframes.length).toBe(1);
    expect(dl.timeframes[0].id).toBe("monthly");
  });

  it("marks dirty on add/remove", () => {
    const dl = new DataLayer();
    dl.clearDirty();

    dl.addTimeframe({
      id: "weekly",
      candles: [makeCandle(1000, 100)],
      timeframe: "1W",
    });
    expect(dl.dirty).toBe(true);

    dl.clearDirty();
    dl.removeTimeframe("weekly");
    expect(dl.dirty).toBe(true);
  });

  it("supports custom opacity and color", () => {
    const dl = new DataLayer();
    dl.addTimeframe({
      id: "weekly",
      candles: [makeCandle(1000, 100)],
      timeframe: "1W",
      opacity: 0.3,
      color: "#FF0000",
    });

    const overlay = dl.timeframes[0];
    expect(overlay.opacity).toBe(0.3);
    expect(overlay.color).toBe("#FF0000");
  });
});
