import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { weisWave } from "../volume/weis-wave";

describe("weisWave", () => {
  const makeCandles = (data: { close: number; volume: number }[]): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.close + 1,
      low: d.close - 1,
      close: d.close,
      volume: d.volume,
    }));

  it("should return empty for empty input", () => {
    expect(weisWave([])).toEqual([]);
  });

  it("should handle single candle", () => {
    const candles = makeCandles([{ close: 100, volume: 1000 }]);
    const result = weisWave(candles);

    expect(result).toHaveLength(1);
    expect(result[0].value.waveVolume).toBe(1000);
  });

  it("should accumulate volume in same direction", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 102, volume: 1500 },
      { close: 104, volume: 2000 },
    ]);
    const result = weisWave(candles);

    // All up — accumulate
    expect(result[2].value.waveVolume).toBe(1000 + 1500 + 2000);
    expect(result[2].value.direction).toBe("up");
  });

  it("should start new wave on direction reversal", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 102, volume: 1500 },
      { close: 101, volume: 800 }, // reversal to down
    ]);
    const result = weisWave(candles);

    expect(result[1].value.direction).toBe("up");
    expect(result[2].value.direction).toBe("down");
    expect(result[2].value.waveVolume).toBe(800);
  });

  it("should respect threshold", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 102, volume: 1500 },
      { close: 101.5, volume: 800 }, // change < threshold=1
    ]);
    const result = weisWave(candles, { threshold: 1 });

    // Change is 0.5, below threshold of 1, so no reversal
    expect(result[2].value.direction).toBe("up");
    expect(result[2].value.waveVolume).toBe(1000 + 1500 + 800);
  });

  it("should preserve timestamps", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 102, volume: 1500 },
    ]);
    const result = weisWave(candles);

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should use highlow method when specified", () => {
    const candles: NormalizedCandle[] = [
      {
        time: 1700000000000,
        open: 100,
        high: 103,
        low: 97,
        close: 100,
        volume: 1000,
      },
      {
        time: 1700000086400000,
        open: 101,
        high: 106,
        low: 100,
        close: 101,
        volume: 1500,
      },
    ];
    const result = weisWave(candles, { method: "highlow" });

    // mid1 = (103+97)/2 = 100, mid2 = (106+100)/2 = 103 → up
    expect(result[1].value.direction).toBe("up");
  });
});
