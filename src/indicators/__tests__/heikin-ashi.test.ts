import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { heikinAshi } from "../price/heikin-ashi";

describe("heikinAshi", () => {
  const makeCandle = (
    time: number,
    open: number,
    high: number,
    low: number,
    close: number,
  ): NormalizedCandle => ({
    time,
    open,
    high,
    low,
    close,
    volume: 1000,
  });

  it("should handle empty array", () => {
    expect(heikinAshi([])).toEqual([]);
  });

  it("should handle single candle", () => {
    const candles = [makeCandle(1000, 100, 110, 90, 105)];
    const result = heikinAshi(candles);

    expect(result).toHaveLength(1);
    const v = result[0].value;
    // haClose = (100+110+90+105)/4 = 101.25
    expect(v.close).toBeCloseTo(101.25);
    // haOpen = (100+105)/2 = 102.5 (first bar)
    expect(v.open).toBeCloseTo(102.5);
    // haHigh = max(110, 102.5, 101.25) = 110
    expect(v.high).toBeCloseTo(110);
    // haLow = min(90, 102.5, 101.25) = 90
    expect(v.low).toBeCloseTo(90);
  });

  it("should calculate multi-bar Heikin-Ashi correctly", () => {
    const candles = [
      makeCandle(1000, 100, 110, 95, 105),
      makeCandle(2000, 106, 115, 100, 112),
      makeCandle(3000, 113, 120, 108, 118),
    ];
    const result = heikinAshi(candles);

    expect(result).toHaveLength(3);

    // Bar 0
    const ha0 = result[0].value;
    const ha0Close = (100 + 110 + 95 + 105) / 4; // 102.5
    const ha0Open = (100 + 105) / 2; // 102.5
    expect(ha0.close).toBeCloseTo(ha0Close);
    expect(ha0.open).toBeCloseTo(ha0Open);

    // Bar 1
    const ha1 = result[1].value;
    const ha1Close = (106 + 115 + 100 + 112) / 4; // 108.25
    const ha1Open = (ha0Open + ha0Close) / 2; // 102.5
    expect(ha1.close).toBeCloseTo(ha1Close);
    expect(ha1.open).toBeCloseTo(ha1Open);
    expect(ha1.high).toBeCloseTo(Math.max(115, ha1Open, ha1Close));
    expect(ha1.low).toBeCloseTo(Math.min(100, ha1Open, ha1Close));

    // Bar 2
    const ha2 = result[2].value;
    const ha2Close = (113 + 120 + 108 + 118) / 4; // 114.75
    const ha2Open = (ha1Open + ha1Close) / 2;
    expect(ha2.close).toBeCloseTo(ha2Close);
    expect(ha2.open).toBeCloseTo(ha2Open);
  });

  it("should detect strong bullish trend (no lower shadow)", () => {
    // Create candles where haLow === haOpen (no lower shadow, strong bullish)
    // We need high > haOpen, close > open, and low >= haOpen
    const candles = [
      makeCandle(1000, 100, 110, 100, 110), // first bar: haOpen=105, haClose=105
      makeCandle(2000, 105, 120, 105, 120), // haOpen=105, haClose=(105+120+105+120)/4=112.5
    ];
    const result = heikinAshi(candles);

    // Bar 1: haOpen = (105+105)/2 = 105, haClose = 112.5
    // haLow = min(105, 105, 112.5) = 105 = haOpen → strong bullish
    expect(result[1].value.trend).toBe(1);
  });

  it("should detect strong bearish trend (no upper shadow)", () => {
    // Create candles where haHigh === haOpen (no upper shadow, strong bearish)
    const candles = [
      makeCandle(1000, 110, 110, 100, 100), // haOpen=105, haClose=105
      makeCandle(2000, 105, 105, 85, 90), // haOpen=105, haClose=(105+105+85+90)/4=96.25
    ];
    const result = heikinAshi(candles);

    // Bar 1: haOpen = (105+105)/2 = 105, haClose = 96.25
    // haHigh = max(105, 105, 96.25) = 105 = haOpen → strong bearish
    expect(result[1].value.trend).toBe(-1);
  });

  it("should return trend 0 for indecision", () => {
    // Flat candle: open equals close
    const candles = [makeCandle(1000, 100, 105, 95, 100)];
    const result = heikinAshi(candles);

    // haOpen = (100+100)/2 = 100, haClose = (100+105+95+100)/4 = 100
    // haClose ≈ haOpen → indecision
    expect(result[0].value.trend).toBe(0);
  });

  it("should preserve time values", () => {
    const candles = [
      makeCandle(1700000000000, 100, 110, 90, 105),
      makeCandle(1700086400000, 106, 115, 100, 112),
    ];
    const result = heikinAshi(candles);

    expect(result[0].time).toBe(1700000000000);
    expect(result[1].time).toBe(1700086400000);
  });
});
