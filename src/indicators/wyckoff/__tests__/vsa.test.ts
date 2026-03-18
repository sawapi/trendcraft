import { describe, it, expect } from "vitest";
import { vsa } from "../vsa";
import type { NormalizedCandle } from "../../../types";

function makeCandle(
  i: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
): NormalizedCandle {
  return {
    time: 1000000 + i * 86400000,
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * Build a baseline of 30 "normal" candles so ATR and volume MA can warm up,
 * then append specific test candles.
 */
function withWarmup(extra: NormalizedCandle[]): NormalizedCandle[] {
  const base: NormalizedCandle[] = [];
  let price = 100;
  for (let i = 0; i < 30; i++) {
    const o = price;
    const h = price + 1;
    const l = price - 1;
    const c = price + (i % 2 === 0 ? 0.5 : -0.5);
    base.push(makeCandle(i, o, h, l, c, 1000));
    price += (i % 2 === 0 ? 0.3 : -0.3);
  }
  return [
    ...base,
    ...extra.map((c, idx) => ({ ...c, time: 1000000 + (30 + idx) * 86400000 })),
  ];
}

describe("vsa", () => {
  it("returns empty array for empty input", () => {
    expect(vsa([])).toEqual([]);
  });

  it("returns correct length for input candles", () => {
    const candles = withWarmup([]);
    const result = vsa(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("classifies absorption bar (high volume + narrow spread)", () => {
    const extra: NormalizedCandle[] = [
      makeCandle(30, 100, 100.2, 99.9, 100.1, 5000), // narrow spread, high vol
    ];
    const candles = withWarmup(extra);
    const result = vsa(candles);
    const last = result[result.length - 1].value;
    expect(last.barType).toBe("absorption");
    expect(last.isEffortDivergence).toBe(true);
  });

  it("classifies effortUp bar (high volume + wide spread + close near high)", () => {
    // volume=2500 → volumeRelative ~2.5 (highVol but not veryHighVol at exactly 2.0x threshold)
    // Use 1800 to be above 1.5x but below 2.0x
    const extra: NormalizedCandle[] = [
      makeCandle(30, 100, 104, 99, 103.5, 1800), // wide spread, high vol (not extreme), close near high
    ];
    const candles = withWarmup(extra);
    const result = vsa(candles);
    const last = result[result.length - 1].value;
    expect(last.barType).toBe("effortUp");
  });

  it("classifies stoppingVolume (high volume + close in lower third)", () => {
    const extra: NormalizedCandle[] = [
      makeCandle(30, 101, 102, 99, 99.5, 5000), // high vol, close near low
    ];
    const candles = withWarmup(extra);
    const result = vsa(candles);
    const last = result[result.length - 1].value;
    expect(last.barType).toBe("stoppingVolume");
  });

  it("classifies noSupply (narrow spread + low volume + close in upper half)", () => {
    // Place bar well above recent lows so "test" doesn't trigger
    // Add bars that push the lows much lower than 110 area
    const ramp: NormalizedCandle[] = [];
    for (let i = 0; i < 5; i++) {
      ramp.push(makeCandle(30 + i, 108 + i, 110 + i, 107 + i, 109 + i, 1000));
    }
    ramp.push(makeCandle(35, 113, 113.3, 112.9, 113.2, 200)); // narrow, low vol, close high (far above lows ~97)
    const candles = withWarmup(ramp);
    const result = vsa(candles);
    const last = result[result.length - 1].value;
    expect(last.barType).toBe("noSupply");
  });

  it("classifies noDemand (narrow spread + low volume + close in lower half)", () => {
    const ramp: NormalizedCandle[] = [];
    for (let i = 0; i < 5; i++) {
      ramp.push(makeCandle(30 + i, 108 + i, 110 + i, 107 + i, 109 + i, 1000));
    }
    ramp.push(makeCandle(35, 113.1, 113.3, 112.9, 113.0, 200)); // narrow, low vol, close low
    const candles = withWarmup(ramp);
    const result = vsa(candles);
    const last = result[result.length - 1].value;
    expect(last.barType).toBe("noDemand");
  });

  it("handles zero-range bar gracefully", () => {
    const extra: NormalizedCandle[] = [
      makeCandle(30, 100, 100, 100, 100, 1000),
    ];
    const candles = withWarmup(extra);
    const result = vsa(candles);
    const last = result[result.length - 1].value;
    expect(last.closePosition).toBe(0.5);
    expect(typeof last.barType).toBe("string");
  });

  it("detects effort divergence correctly", () => {
    const extra: NormalizedCandle[] = [
      makeCandle(30, 100, 104, 99, 103, 200), // wide spread, LOW volume = divergence
    ];
    const candles = withWarmup(extra);
    const result = vsa(candles);
    const last = result[result.length - 1].value;
    expect(last.isEffortDivergence).toBe(true);
  });

  it("returns normal for average bar", () => {
    const extra: NormalizedCandle[] = [
      makeCandle(30, 100, 101, 99, 100.5, 1000), // average everything
    ];
    const candles = withWarmup(extra);
    const result = vsa(candles);
    const last = result[result.length - 1].value;
    expect(last.barType).toBe("normal");
  });

  it("provides numeric values for all fields", () => {
    const extra: NormalizedCandle[] = [
      makeCandle(30, 100, 102, 98, 101, 1500),
    ];
    const candles = withWarmup(extra);
    const result = vsa(candles);
    const last = result[result.length - 1].value;
    expect(typeof last.spreadRelative).toBe("number");
    expect(typeof last.closePosition).toBe("number");
    expect(typeof last.volumeRelative).toBe("number");
    expect(last.closePosition).toBeGreaterThanOrEqual(0);
    expect(last.closePosition).toBeLessThanOrEqual(1);
  });
});
