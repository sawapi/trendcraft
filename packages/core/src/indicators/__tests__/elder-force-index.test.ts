import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { elderForceIndex } from "../volume/elder-force-index";

describe("elderForceIndex", () => {
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
    expect(elderForceIndex([])).toEqual([]);
  });

  it("returns { short: null, long: null } until each EMA has warmed up", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 101, volume: 1200 },
    ]);
    const result = elderForceIndex(candles); // canonical 2 / 13

    expect(result).toHaveLength(2);
    // Bar 0: neither EMA has seen `period` samples.
    expect(result[0].value.short).toBeNull();
    expect(result[0].value.long).toBeNull();
    // Bar 1: shortPeriod=2 has just warmed up, but longPeriod=13 hasn't.
    expect(result[1].value.short).not.toBeNull();
    expect(result[1].value.long).toBeNull();
  });

  it("throws when shortPeriod or longPeriod is less than 1", () => {
    const candles = makeCandles([{ close: 100, volume: 1000 }]);
    expect(() => elderForceIndex(candles, { shortPeriod: 0 })).toThrow();
    expect(() => elderForceIndex(candles, { longPeriod: 0 })).toThrow();
  });

  it("produces non-null short and long values once both EMAs warm up", () => {
    const data: { close: number; volume: number }[] = [];
    for (let i = 0; i < 30; i++) {
      data.push({ close: 100 + i * 0.5, volume: 1000 + i * 100 });
    }
    const candles = makeCandles(data);
    const result = elderForceIndex(candles); // canonical 2 / 13

    expect(result).toHaveLength(30);
    const last = result[result.length - 1].value;
    expect(last.short).not.toBeNull();
    expect(last.long).not.toBeNull();

    // Rising market with rising volume → both Force Index lines positive.
    expect(last.short as number).toBeGreaterThan(0);
    expect(last.long as number).toBeGreaterThan(0);
  });

  it("respects custom shortPeriod and longPeriod", () => {
    const data: { close: number; volume: number }[] = [];
    for (let i = 0; i < 30; i++) {
      data.push({ close: 100 + i * 0.5, volume: 1000 });
    }
    const candles = makeCandles(data);
    const result = elderForceIndex(candles, { shortPeriod: 5, longPeriod: 20 });

    // shortPeriod=5 first non-null at bar 4; longPeriod=20 at bar 19.
    expect(result[3].value.short).toBeNull();
    expect(result[4].value.short).not.toBeNull();
    expect(result[18].value.long).toBeNull();
    expect(result[19].value.long).not.toBeNull();
  });

  it("preserves timestamps", () => {
    const data: { close: number; volume: number }[] = [];
    for (let i = 0; i < 20; i++) {
      data.push({ close: 100 + i, volume: 1000 });
    }
    const candles = makeCandles(data);
    const result = elderForceIndex(candles);

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("handles zero volume bars without crashing", () => {
    const data: { close: number; volume: number }[] = [];
    for (let i = 0; i < 20; i++) {
      data.push({ close: 100 + i, volume: i === 5 ? 0 : 1000 });
    }
    const candles = makeCandles(data);
    const result = elderForceIndex(candles);
    expect(result).toHaveLength(20);
  });
});
