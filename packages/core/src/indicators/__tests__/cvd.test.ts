import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { cvd, cvdWithSignal } from "../volume/cvd";

const makeCandle = (
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
): NormalizedCandle => ({ time, open, high, low, close, volume });

describe("cvd", () => {
  it("should return empty for empty input", () => {
    expect(cvd([])).toEqual([]);
  });

  it("should return delta=0 for doji (range=0)", () => {
    const candles = [
      makeCandle(1000, 100, 100, 100, 100, 5000),
      makeCandle(2000, 50, 50, 50, 50, 3000),
    ];
    const result = cvd(candles);
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(0);
    expect(result[1].value).toBe(0);
  });

  it("should return delta=+volume for bullish candle (close=high)", () => {
    // buyVolume = vol * (high - low) / (high - low) = vol
    // sellVolume = 0
    // delta = vol - 0 = vol
    const candles = [makeCandle(1000, 90, 110, 90, 110, 2000)];
    const result = cvd(candles);
    expect(result[0].value).toBe(2000);
  });

  it("should return delta=-volume for bearish candle (close=low)", () => {
    // buyVolume = vol * 0 / range = 0
    // sellVolume = vol
    // delta = 0 - vol = -vol
    const candles = [makeCandle(1000, 110, 110, 90, 90, 2000)];
    const result = cvd(candles);
    expect(result[0].value).toBe(-2000);
  });

  it("should return delta=0 when close is at midpoint", () => {
    // buyVolume = vol * 0.5, sellVolume = vol * 0.5, delta = 0
    const candles = [makeCandle(1000, 100, 110, 90, 100, 4000)];
    const result = cvd(candles);
    expect(result[0].value).toBe(0);
  });

  it("should accumulate deltas as a running sum", () => {
    const candles = [
      makeCandle(1000, 90, 110, 90, 110, 1000), // delta = +1000
      makeCandle(2000, 100, 110, 90, 100, 1000), // delta = 0
      makeCandle(3000, 110, 110, 90, 90, 1000), // delta = -1000
      makeCandle(4000, 90, 110, 90, 110, 500), // delta = +500
    ];
    const result = cvd(candles);
    expect(result[0].value).toBe(1000);
    expect(result[1].value).toBe(1000); // 1000 + 0
    expect(result[2].value).toBe(0); // 1000 - 1000
    expect(result[3].value).toBe(500); // 0 + 500
  });

  it("should preserve time values", () => {
    const candles = [
      makeCandle(1000, 100, 110, 90, 100, 500),
      makeCandle(2000, 100, 110, 90, 100, 500),
    ];
    const result = cvd(candles);
    expect(result[0].time).toBe(1000);
    expect(result[1].time).toBe(2000);
  });
});

describe("cvdWithSignal", () => {
  it("should return empty for empty input", () => {
    expect(cvdWithSignal([])).toEqual([]);
  });

  it("should compute signal as EMA of CVD", () => {
    // 15 candles, all bullish (close=high), so CVD grows linearly
    const candles = Array.from({ length: 15 }, (_, i) =>
      makeCandle((i + 1) * 1000, 90, 110, 90, 110, 1000),
    );
    // Each delta = +1000, CVD = 1000, 2000, ... 15000

    const result = cvdWithSignal(candles, { signalPeriod: 5 });
    expect(result).toHaveLength(15);

    // Signal should be null for first 4 bars (period-1 = 4)
    for (let i = 0; i < 4; i++) {
      expect(result[i].value.signal).toBeNull();
    }

    // Signal at index 4 = SMA of first 5 CVD values = (1000+2000+3000+4000+5000)/5 = 3000
    expect(result[4].value.signal).toBe(3000);

    // After that, signal should be non-null
    for (let i = 5; i < 15; i++) {
      expect(result[i].value.signal).not.toBeNull();
    }
  });

  it("should apply smoothing when smoothing > 1", () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle((i + 1) * 1000, 90, 110, 90, 110, 1000),
    );

    const noSmoothing = cvdWithSignal(candles, { smoothing: 1 });
    const withSmoothing = cvdWithSignal(candles, { smoothing: 5 });

    // With smoothing, CVD values should differ from raw CVD (after the seed period)
    // The smoothed CVD lags the raw CVD
    expect(withSmoothing[10].value.cvd).not.toBe(noSmoothing[10].value.cvd);
  });

  it("should have cvd values matching raw cvd when smoothing=1", () => {
    const candles = [
      makeCandle(1000, 90, 110, 90, 110, 1000),
      makeCandle(2000, 110, 110, 90, 90, 1000),
      makeCandle(3000, 90, 110, 90, 110, 500),
    ];

    const rawCvd = cvd(candles);
    const withSignal = cvdWithSignal(candles, { smoothing: 1, signalPeriod: 2 });

    for (let i = 0; i < rawCvd.length; i++) {
      expect(withSignal[i].value.cvd).toBe(rawCvd[i].value);
    }
  });
});
