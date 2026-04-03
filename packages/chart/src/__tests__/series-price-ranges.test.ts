import { describe, expect, it } from "vitest";
import { bandPriceRange } from "../series/band";
import { candlePriceRange } from "../series/candlestick";
import { cloudPriceRange } from "../series/cloud";
import { histogramRange, volumeRange } from "../series/histogram";
import { channelPriceRange, linePriceRange } from "../series/line";
import { makeCandle } from "./helpers/mock-ctx";

describe("candlePriceRange", () => {
  const candles = [
    makeCandle(1, 100, 110, 90),
    makeCandle(2, 105, 115, 95),
    makeCandle(3, 98, 108, 88),
  ];

  it("returns min/max from visible range", () => {
    const [min, max] = candlePriceRange(candles, 0, 3);
    expect(min).toBe(88);
    expect(max).toBe(115);
  });

  it("respects start/end bounds", () => {
    const [min, max] = candlePriceRange(candles, 1, 2);
    expect(min).toBe(95);
    expect(max).toBe(115);
  });

  it("returns Infinity/-Infinity for empty range", () => {
    const [min, max] = candlePriceRange(candles, 5, 10);
    expect(min).toBe(Number.POSITIVE_INFINITY);
    expect(max).toBe(Number.NEGATIVE_INFINITY);
  });

  it("returns Infinity/-Infinity for empty array", () => {
    const [min, max] = candlePriceRange([], 0, 0);
    expect(min).toBe(Number.POSITIVE_INFINITY);
    expect(max).toBe(Number.NEGATIVE_INFINITY);
  });

  it("handles single candle", () => {
    const [min, max] = candlePriceRange(candles, 0, 1);
    expect(min).toBe(90);
    expect(max).toBe(110);
  });
});

describe("linePriceRange", () => {
  const data = [
    { time: 1, value: 10 },
    { time: 2, value: 20 },
    { time: 3, value: null },
    { time: 4, value: 15 },
  ];

  it("returns min/max ignoring nulls", () => {
    const [min, max] = linePriceRange(data, 0, 4);
    expect(min).toBe(10);
    expect(max).toBe(20);
  });

  it("respects start/end bounds", () => {
    const [min, max] = linePriceRange(data, 3, 4);
    expect(min).toBe(15);
    expect(max).toBe(15);
  });

  it("returns Infinity/-Infinity for all-null data", () => {
    const allNull = [
      { time: 1, value: null },
      { time: 2, value: null },
    ];
    const [min, max] = linePriceRange(allNull, 0, 2);
    expect(min).toBe(Number.POSITIVE_INFINITY);
    expect(max).toBe(Number.NEGATIVE_INFINITY);
  });

  it("returns Infinity/-Infinity for empty array", () => {
    const [min, max] = linePriceRange([], 0, 0);
    expect(min).toBe(Number.POSITIVE_INFINITY);
    expect(max).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("channelPriceRange", () => {
  const values = [10, null, 30, 20, null];

  it("returns min/max ignoring nulls", () => {
    const [min, max] = channelPriceRange(values, 0, 5);
    expect(min).toBe(10);
    expect(max).toBe(30);
  });

  it("respects start/end bounds", () => {
    const [min, max] = channelPriceRange(values, 2, 4);
    expect(min).toBe(20);
    expect(max).toBe(30);
  });

  it("returns Infinity/-Infinity for all-null data", () => {
    const [min, max] = channelPriceRange([null, null], 0, 2);
    expect(min).toBe(Number.POSITIVE_INFINITY);
    expect(max).toBe(Number.NEGATIVE_INFINITY);
  });

  it("handles single value", () => {
    const [min, max] = channelPriceRange([42], 0, 1);
    expect(min).toBe(42);
    expect(max).toBe(42);
  });
});

describe("bandPriceRange", () => {
  const upper = [100, 110, null, 120];
  const lower = [80, 90, null, 100];

  it("returns min/max across upper and lower", () => {
    const [min, max] = bandPriceRange(upper, lower, 0, 4);
    expect(min).toBe(80);
    expect(max).toBe(120);
  });

  it("handles nulls in one channel", () => {
    const upperWithNull = [100, null, 120];
    const lowerFull = [80, 90, 100];
    const [min, max] = bandPriceRange(upperWithNull, lowerFull, 0, 3);
    expect(min).toBe(80);
    expect(max).toBe(120);
  });

  it("returns Infinity/-Infinity for all-null data", () => {
    const [min, max] = bandPriceRange([null, null], [null, null], 0, 2);
    expect(min).toBe(Number.POSITIVE_INFINITY);
    expect(max).toBe(Number.NEGATIVE_INFINITY);
  });

  it("handles different-length arrays", () => {
    const short = [100];
    const long = [80, 90, 100];
    const [min, max] = bandPriceRange(short, long, 0, 3);
    expect(min).toBe(80);
    expect(max).toBe(100);
  });
});

describe("cloudPriceRange", () => {
  it("returns min/max across all channels", () => {
    const channels = new Map([
      ["tenkan", [50, 60, 55]],
      ["kijun", [45, 55, 50]],
      ["senkouA", [70, 80, 75]],
      ["senkouB", [40, 50, 45]],
    ]);
    const [min, max] = cloudPriceRange(channels, 0, 3);
    expect(min).toBe(40);
    expect(max).toBe(80);
  });

  it("ignores null values", () => {
    const channels = new Map([
      ["a", [null, 10, null]],
      ["b", [5, null, 15]],
    ]);
    const [min, max] = cloudPriceRange(channels, 0, 3);
    expect(min).toBe(5);
    expect(max).toBe(15);
  });

  it("returns Infinity/-Infinity for empty channels", () => {
    const channels = new Map<string, (number | null)[]>();
    const [min, max] = cloudPriceRange(channels, 0, 5);
    expect(min).toBe(Number.POSITIVE_INFINITY);
    expect(max).toBe(Number.NEGATIVE_INFINITY);
  });

  it("respects start/end bounds", () => {
    const channels = new Map([["a", [100, 200, 300]]]);
    const [min, max] = cloudPriceRange(channels, 1, 2);
    expect(min).toBe(200);
    expect(max).toBe(200);
  });
});

describe("volumeRange", () => {
  const candles = [
    makeCandle(1, 100, 110, 90, 5000),
    makeCandle(2, 105, 115, 95, 8000),
    makeCandle(3, 98, 108, 88, 3000),
  ];

  it("returns [0, maxVolume]", () => {
    const [min, max] = volumeRange(candles, 0, 3);
    expect(min).toBe(0);
    expect(max).toBe(8000);
  });

  it("respects start/end bounds", () => {
    const [min, max] = volumeRange(candles, 2, 3);
    expect(min).toBe(0);
    expect(max).toBe(3000);
  });

  it("returns [0, 0] for empty range", () => {
    const [min, max] = volumeRange(candles, 5, 10);
    expect(min).toBe(0);
    expect(max).toBe(0);
  });
});

describe("histogramRange", () => {
  const values = [-5, 10, null, -3, 8];

  it("returns min/max including zero baseline", () => {
    const [min, max] = histogramRange(values, 0, 5);
    expect(min).toBe(-5);
    expect(max).toBe(10);
  });

  it("clamps to zero when all positive", () => {
    const [min, max] = histogramRange([5, 10, 15], 0, 3);
    expect(min).toBe(0);
    expect(max).toBe(15);
  });

  it("clamps to zero when all negative", () => {
    const [min, max] = histogramRange([-5, -10, -15], 0, 3);
    expect(min).toBe(-15);
    expect(max).toBe(0);
  });

  it("ignores null values", () => {
    const [min, max] = histogramRange([null, null, 7], 0, 3);
    expect(min).toBe(0);
    expect(max).toBe(7);
  });

  it("returns [0, 0] for all-null data", () => {
    const [min, max] = histogramRange([null, null], 0, 2);
    expect(min).toBe(0);
    expect(max).toBe(0);
  });
});
