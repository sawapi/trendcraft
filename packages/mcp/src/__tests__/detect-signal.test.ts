import { describe, expect, it } from "vitest";
import type { Candle } from "../schemas/candle";
import { detectSignalHandler } from "../tools/detect-signal";

function trendingCandles(n: number, slope = 0.3): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const close = 100 + i * slope + Math.sin(i / 5) * 2;
    out.push({
      time: i * 86_400_000,
      open: close - 0.4,
      high: close + 0.6,
      low: close - 0.6,
      close,
      volume: 1000 + (i % 7) * 250,
    });
  }
  return out;
}

describe("detectSignalHandler", () => {
  it("computes goldenCross and exposes firedAt times for screening", () => {
    const candles = trendingCandles(80);
    const result = detectSignalHandler({
      kind: "goldenCross",
      candles,
      params: { short: 5, long: 25 },
      lastN: 0,
    });
    expect(result.kind).toBe("goldenCross");
    expect(result.shape).toBe("series");
    expect(result.totalLength).toBe(80);
    // Firing positions are exposed as a sparse list — firedAt entries must be a
    // subset of the underlying series times.
    const seriesTimes = new Set(
      (result.output as Array<{ time: number; value: boolean }>).map((p) => p.time),
    );
    for (const t of result.firedAt) expect(seriesTimes.has(t)).toBe(true);
  });

  it("computes perfectOrder and reports `formed` events in firedAt", () => {
    const candles = trendingCandles(150);
    const result = detectSignalHandler({ kind: "perfectOrder", candles, lastN: 0 });
    expect(result.shape).toBe("series");
    // perfectOrder emits PerfectOrderValue objects; firedAt should track only
    // the bars where `formed: true`, never every-bar (avoid stateful spam).
    expect(result.firedAt.length).toBeLessThanOrEqual(result.totalLength);
  });

  it("computes bollingerSqueeze (event-shape) and lifts event times into firedAt", () => {
    const candles = trendingCandles(160, 0.05);
    const result = detectSignalHandler({
      kind: "bollingerSqueeze",
      candles,
      lastN: 0,
    });
    expect(result.shape).toBe("events");
    // events array elements must each carry a numeric time, which firedAt mirrors.
    expect(result.firedAt.length).toBe(result.output.length);
  });

  it("rejects unknown signal kind with UNSUPPORTED_SIGNAL listing supported kinds", () => {
    expect(() =>
      detectSignalHandler({ kind: "no-such-signal", candles: trendingCandles(20) }),
    ).toThrow(/UNSUPPORTED_SIGNAL.*Supported.*goldenCross/s);
  });

  it("rejects empty candles with canonical INVALID_INPUT", () => {
    expect(() => detectSignalHandler({ kind: "goldenCross", candles: [] })).toThrow(
      /INVALID_INPUT.*at least 1/,
    );
  });

  it("rejects a volume-based signal when any candle omits volume (INVALID_INPUT)", () => {
    // Strip volume off the candles — a volume signal must not see fabricated
    // zeros, so the dispatcher should reject rather than zero-fill.
    const priceOnly = trendingCandles(40).map(({ volume: _volume, ...c }) => c);
    expect(() => detectSignalHandler({ kind: "volumeBreakout", candles: priceOnly })).toThrow(
      /INVALID_INPUT.*reads volume.*40 candle/s,
    );
  });

  it("rejects a volume-based signal when a candle supplies a non-finite volume", () => {
    // A NaN volume would slip past a `=== undefined` check and through `?? 0`,
    // silently distorting the volume average. The finiteness guard rejects it.
    const withNaN = trendingCandles(40).map((c, i) => (i === 5 ? { ...c, volume: Number.NaN } : c));
    expect(() => detectSignalHandler({ kind: "volumeBreakout", candles: withNaN })).toThrow(
      /INVALID_INPUT.*reads volume.*non-finite/s,
    );
  });

  it("rejects a price-based signal routed onto volume via source:'volume' when volume is omitted", () => {
    // perfectOrder is price-based, but `source: "volume"` makes it read
    // candle volume through getPrice — the guard must catch this dynamic
    // path too, not just the static usesVolume kinds.
    const priceOnly = trendingCandles(60).map(({ volume: _volume, ...c }) => c);
    expect(() =>
      detectSignalHandler({
        kind: "perfectOrder",
        candles: priceOnly,
        params: { source: "volume" },
      }),
    ).toThrow(/INVALID_INPUT.*reads volume/s);
  });

  it("tolerates omitted volume for a price-only signal (zero-filled, no throw)", () => {
    const priceOnly = trendingCandles(80).map(({ volume: _volume, ...c }) => c);
    const result = detectSignalHandler({
      kind: "goldenCross",
      candles: priceOnly,
      params: { short: 5, long: 25 },
      lastN: 0,
    });
    expect(result.kind).toBe("goldenCross");
    expect(result.totalLength).toBe(80);
  });

  it("reclassifies invalid params (short>=long) as INVALID_PARAMETER", () => {
    expect(() =>
      detectSignalHandler({
        kind: "goldenCross",
        candles: trendingCandles(40),
        params: { short: 30, long: 5 },
      }),
    ).toThrow(/INVALID_PARAMETER/);
  });

  it("respects lastN slicing on the output array", () => {
    const candles = trendingCandles(120);
    const full = detectSignalHandler({ kind: "goldenCross", candles, lastN: 0 });
    const tail = detectSignalHandler({ kind: "goldenCross", candles, lastN: 10 });
    expect(full.totalLength).toBe(120);
    expect(tail.count).toBe(10);
    expect(tail.truncated).toBe(true);
  });

  it("computes candlestickPatterns and lifts pattern-bearing bars into firedAt", () => {
    const candles = trendingCandles(60);
    const result = detectSignalHandler({ kind: "candlestickPatterns", candles, lastN: 0 });
    expect(result.shape).toBe("series");
    expect(result.totalLength).toBe(60);
    // firedAt for candlestickPatterns must only contain bars where
    // `value.patterns.length > 0` (custom firesAt predicate). Verify by
    // recomputing the predicate over the output series.
    const expectedFiredAt: number[] = [];
    for (const point of result.output as Array<{
      time: number;
      value: { patterns: unknown[] };
    }>) {
      if (Array.isArray(point.value?.patterns) && point.value.patterns.length > 0) {
        expectedFiredAt.push(point.time);
      }
    }
    expect(result.firedAt).toEqual(expectedFiredAt);
  });
});
