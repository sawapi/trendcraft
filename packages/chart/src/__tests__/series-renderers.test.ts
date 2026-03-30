import { describe, expect, it } from "vitest";
import { DARK_THEME } from "../core/types";
import { renderArea } from "../series/area";
import { renderBand } from "../series/band";
import { renderCandlesticks } from "../series/candlestick";
import { renderCloud } from "../series/cloud";
import { renderHistogram, renderVolume } from "../series/histogram";
import { renderChannelLine, renderLine } from "../series/line";
import { renderMarkers } from "../series/marker";
import { renderMountainChart } from "../series/mountain";
import { renderOhlcBars } from "../series/ohlc-bar";
import { renderPriceLineChart } from "../series/price-line";
import { makeCandle, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

const theme = DARK_THEME;

function setup(count = 5) {
  const ctx = mockCtx();
  const ts = makeTimeScale(count, 800);
  const ps = makePriceScale(400, 90, 120);
  return { ctx, ts, ps };
}

describe("renderCandlesticks", () => {
  it("draws wicks and bodies for each candle", () => {
    const { ctx, ts, ps } = setup();
    const candles = [
      makeCandle(1, 100, 110, 90),
      makeCandle(2, 105, 115, 95),
      makeCandle(3, 98, 108, 88),
    ];
    renderCandlesticks(ctx, candles, ts, ps, theme);
    // Wicks drawn via stroke, bodies via fillRect
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("handles empty candles", () => {
    const { ctx, ts, ps } = setup(0);
    renderCandlesticks(ctx, [], ts, ps, theme);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe("renderLine", () => {
  it("draws a continuous line", () => {
    const { ctx, ts, ps } = setup();
    const data = [
      { time: 1, value: 100 },
      { time: 2, value: 105 },
      { time: 3, value: 98 },
    ];
    renderLine(ctx, data, ts, ps, ts.startIndex, { color: "#FF0000", lineWidth: 2 });
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("breaks line on null gaps", () => {
    const { ctx, ts, ps } = setup();
    const data = [
      { time: 1, value: 100 },
      { time: 2, value: null },
      { time: 3, value: 98 },
    ];
    renderLine(ctx, data, ts, ps, ts.startIndex, { color: "#000", lineWidth: 1 });
    // Two segments = two moveTo calls
    expect(ctx.moveTo).toHaveBeenCalledTimes(2);
  });

  it("applies dash pattern", () => {
    const { ctx, ts, ps } = setup();
    const data = [{ time: 1, value: 100 }];
    renderLine(ctx, data, ts, ps, ts.startIndex, { color: "#000", lineWidth: 1, dash: [4, 2] });
    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 2]);
  });
});

describe("renderChannelLine", () => {
  it("draws a channel line from values array", () => {
    const { ctx, ts, ps } = setup();
    renderChannelLine(ctx, [100, 105, 98], ts, ps, { color: "#00F", lineWidth: 1 });
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("skips null values", () => {
    const { ctx, ts, ps } = setup();
    renderChannelLine(ctx, [null, null, null], ts, ps, { color: "#00F", lineWidth: 1 });
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });
});

describe("renderArea", () => {
  it("renders fill and line for valid data", () => {
    const { ctx, ts, ps } = setup();
    const data = [
      { time: 1, value: 100 },
      { time: 2, value: 105 },
      { time: 3, value: 98 },
    ];
    renderArea(ctx, data, ts, ps);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("skips segments with fewer than 2 points", () => {
    const { ctx, ts, ps } = setup();
    renderArea(ctx, [{ time: 1, value: 100 }], ts, ps);
    expect(ctx.fill).not.toHaveBeenCalled();
  });
});

describe("renderBand", () => {
  it("renders fill between upper/lower and three lines", () => {
    const { ctx, ts, ps } = setup();
    const upper = [110, 115, 112];
    const middle = [100, 105, 102];
    const lower = [90, 95, 92];
    renderBand(ctx, upper, middle, lower, ts, ps);
    // Fill between upper/lower + 3 lines
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("handles all-null data gracefully", () => {
    const { ctx, ts, ps } = setup();
    renderBand(ctx, [null, null], [null, null], [null, null], ts, ps);
    expect(ctx.fill).not.toHaveBeenCalled();
  });
});

describe("renderCloud", () => {
  it("renders cloud fill and lines", () => {
    const { ctx, ts, ps } = setup();
    const channels = new Map([
      ["tenkan", [100, 105, 102]],
      ["kijun", [98, 103, 100]],
      ["senkouA", [110, 115, 112]],
      ["senkouB", [90, 95, 92]],
      ["chikou", [100, 105, 102]],
    ]);
    renderCloud(ctx, channels, ts, ps);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("handles missing channels", () => {
    const { ctx, ts, ps } = setup();
    renderCloud(ctx, new Map(), ts, ps);
    // No crash, just no fills
    expect(ctx.fill).not.toHaveBeenCalled();
  });
});

describe("renderHistogram", () => {
  it("renders bars with up/down colors", () => {
    const { ctx, ts, ps } = setup();
    const psHist = makePriceScale(400, -10, 10);
    renderHistogram(ctx, [5, -3, 8, null, -2], ts, psHist, {
      upColor: "#26a69a",
      downColor: "#ef5350",
    });
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("skips null values", () => {
    const { ctx, ts, ps } = setup();
    const psHist = makePriceScale(400, -10, 10);
    renderHistogram(ctx, [null, null], ts, psHist, {
      upColor: "#26a69a",
      downColor: "#ef5350",
    });
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe("renderVolume", () => {
  it("renders volume bars", () => {
    const { ctx, ts } = setup();
    const ps = makePriceScale(400, 0, 10000);
    const candles = [makeCandle(1, 100, 110, 90, 5000), makeCandle(2, 105, 115, 95, 8000)];
    renderVolume(ctx, candles, ts, ps, theme);
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});

describe("renderMarkers", () => {
  it("renders circles for non-null values", () => {
    const { ctx, ts, ps } = setup();
    renderMarkers(ctx, [100, null, 105], ts, ps);
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.fill).toHaveBeenCalledTimes(2);
  });

  it("renders nothing for all-null", () => {
    const { ctx, ts, ps } = setup();
    renderMarkers(ctx, [null, null], ts, ps);
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});

describe("renderMountainChart", () => {
  it("renders gradient fill and line", () => {
    const { ctx, ts, ps } = setup();
    const candles = [
      makeCandle(1, 100, 110, 90),
      makeCandle(2, 105, 115, 95),
      makeCandle(3, 98, 108, 88),
    ];
    renderMountainChart(ctx, candles, ts, ps, theme);
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("returns early with fewer than 2 candles", () => {
    const { ctx, ts, ps } = setup();
    renderMountainChart(ctx, [makeCandle(1, 100)], ts, ps, theme);
    expect(ctx.fill).not.toHaveBeenCalled();
  });
});

describe("renderOhlcBars", () => {
  it("renders vertical bars with open/close ticks", () => {
    const { ctx, ts, ps } = setup();
    const candles = [makeCandle(1, 100, 110, 90), makeCandle(2, 105, 115, 95)];
    renderOhlcBars(ctx, candles, ts, ps, theme);
    // 3 strokes per bar (high-low, open tick, close tick) x 2 candles = 6
    expect(ctx.stroke).toHaveBeenCalledTimes(6);
  });
});

describe("renderPriceLineChart", () => {
  it("renders a line from close prices", () => {
    const { ctx, ts, ps } = setup();
    const candles = [makeCandle(1, 100, 110, 90), makeCandle(2, 105, 115, 95)];
    renderPriceLineChart(ctx, candles, ts, ps, theme);
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
