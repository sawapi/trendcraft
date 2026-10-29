import { describe, expect, it } from "vitest";
import { runBacktest } from "../../backtest/engine";
import { runBacktestScaled } from "../../backtest/scaled-entry";
import { rsi } from "../../indicators/momentum/rsi";
import { ema } from "../../indicators/moving-average/ema";
import { sma } from "../../indicators/moving-average/sma";
import { atr } from "../../indicators/volatility/atr";
import { calculateScore } from "../../scoring/calculator";
import { createCandleAggregator } from "../../streaming/candle-aggregator";
import { createCandleResampler } from "../../streaming/candle-resampler";
import { createLiveCandle } from "../../streaming/live-candle";
import { createPipeline } from "../../streaming/pipeline";
import type { Candle, NormalizedCandle } from "../../types";
import { validateCandles } from "../../validation/validate";
import { ensureNormalized, normalizeAndValidate, normalizeCandles } from "../normalize";
import { resample } from "../resample";

function bars(count: number): NormalizedCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: Date.UTC(2024, 0, 1 + i),
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100 + i,
    volume: 1000,
  }));
}

const FIELDS = ["time", "open", "high", "low", "close", "volume"] as const;
const BAD = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

describe("non-finite candles are rejected at the boundary", () => {
  for (const field of FIELDS) {
    it(`rejects a non-finite ${field}, normalized or not`, () => {
      for (const bad of BAD) {
        const normalized = bars(30);
        normalized[12] = { ...normalized[12], [field]: bad };
        expect(() => ensureNormalized(normalized)).toThrow(`candle 12 has a non-finite ${field}`);

        // Second-stamped input goes through normalizeCandles instead.
        const raw: Candle[] = bars(30).map((c) => ({ ...c, time: c.time / 1000 }));
        raw[12] = { ...raw[12], [field]: bad };
        expect(() => normalizeCandles(raw)).toThrow(`candle 12 has a non-finite ${field}`);
      }
    });
  }

  it("stops the indicators that used to absorb a bad bar", () => {
    const candles = bars(40);
    candles[20] = { ...candles[20], close: Number.NaN };
    // RSI used to count the NaN bar as unchanged and keep printing values;
    // SMA, EMA and ATR turned NaN for good.
    expect(() => rsi(candles)).toThrow(/candle 20 has a non-finite close/);
    expect(() => sma(candles, { period: 5 })).toThrow(/candle 20/);
    expect(() => ema(candles, { period: 5 })).toThrow(/candle 20/);
    expect(() => atr(candles)).toThrow(/candle 20/);
  });

  it("no longer returns an unsorted series for a NaN time", () => {
    const raw: Candle[] = bars(3).map((c) => ({ ...c, time: c.time / 1000 }));
    raw[1] = { ...raw[1], time: Number.NaN };
    expect(() => normalizeCandles(raw)).toThrow(/candle 1 has a non-finite time/);
  });

  it("accepts finite data, including fractional volume", () => {
    const candles = bars(30).map((c) => ({ ...c, volume: 0.25 }));
    expect(ensureNormalized(candles)).toBe(candles);
    expect(() => sma(candles, { period: 5, source: "volume" })).not.toThrow();
  });
});

describe("the data validator reports non-finite values instead of throwing", () => {
  const bad = () => {
    const candles = bars(80);
    candles[40] = { ...candles[40], close: Number.NaN };
    return candles;
  };

  it("validateCandles returns a finding for the bar", () => {
    const result = validateCandles(bad(), { ohlc: true });
    expect(result.valid).toBe(false);
    expect(result.errors.some((f) => f.category === "ohlc" && f.index === 40)).toBe(true);
  });

  it("normalizeAndValidate reports it when asked to validate, and throws otherwise", () => {
    const raw: Candle[] = bad().map((c) => ({ ...c, time: c.time / 1000 }));
    const { validation } = normalizeAndValidate(raw, { ohlc: true });
    expect(validation?.errors.some((f) => f.index === 40)).toBe(true);
    expect(() => normalizeAndValidate(raw)).toThrow(/candle 40 has a non-finite close/);
  });
});

describe("entry points that never normalized also check", () => {
  const candles = bars(60);
  candles[30] = { ...candles[30], close: Number.NaN };
  const always = () => true;

  it.each([
    ["runBacktest", () => runBacktest(candles, always, () => false, { capital: 1000 })],
    [
      "runBacktestScaled",
      () =>
        runBacktestScaled(candles, always, () => false, {
          capital: 1000,
          scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
        }),
    ],
    ["resample", () => resample(candles, "1w")],
    ["calculateScore", () => calculateScore(candles, 40, { signals: [] })],
  ])("%s", (_name, run) => {
    expect(run).toThrow(/candle 30 has a non-finite close/);
  });

  it("streaming inputs", () => {
    const tick = { ...bars(1)[0], close: Number.NaN };
    expect(() => createPipeline({ indicators: [], entry: always }).next(tick)).toThrow(
      /non-finite close/,
    );
    expect(() => createPipeline({ indicators: [], entry: always }).peek(tick)).toThrow(
      /non-finite close/,
    );
    expect(() => createCandleResampler({ targetIntervalMs: 3_600_000 }).addCandle(tick)).toThrow(
      /non-finite close/,
    );
    expect(() => createLiveCandle({ intervalMs: 60_000 }).addCandle(tick)).toThrow(
      /non-finite close/,
    );
    expect(() =>
      createCandleAggregator({ intervalMs: 60_000 }).addTrade({
        time: Date.UTC(2024, 0, 1),
        price: Number.NaN,
        volume: 1,
        side: "buy",
      }),
    ).toThrow(/non-finite/);
  });
});

describe("an array that was already checked", () => {
  it("checks a bar appended to it on the next call", () => {
    // Pushing the latest bar onto the same history and recomputing is how a
    // live series is usually fed.
    const candles = bars(60);
    expect(() => sma(candles, { period: 5 })).not.toThrow();
    candles.push({ ...bars(61)[60], close: Number.NaN });
    expect(() => sma(candles, { period: 5 })).toThrow(/candle 60 has a non-finite close/);
  });

  it("checks a fixed-size rolling window (shift, then push)", () => {
    const candles = bars(60);
    expect(() => sma(candles, { period: 5 })).not.toThrow();
    candles.shift();
    candles.push({ ...bars(61)[60], close: Number.NaN });
    expect(() => sma(candles, { period: 5 })).toThrow(/candle 59 has a non-finite close/);
  });

  it("checks a rolling window updated push-first", () => {
    const candles = bars(60);
    expect(() => sma(candles, { period: 5 })).not.toThrow();
    candles.push({ ...bars(61)[60], close: Number.NaN });
    candles.shift();
    expect(() => sma(candles, { period: 5 })).toThrow(/candle 59 has a non-finite close/);
  });

  it("checks a forming bar replaced with a new object", () => {
    const candles = bars(60);
    expect(() => sma(candles, { period: 5 })).not.toThrow();
    candles[59] = { ...candles[59], close: Number.NaN };
    expect(() => sma(candles, { period: 5 })).toThrow(/candle 59 has a non-finite close/);
  });

  it("rescans a shorter array in full", () => {
    const candles = bars(30);
    expect(() => sma(candles, { period: 5 })).not.toThrow();
    candles.length = 10;
    candles[3] = { ...candles[3], open: Number.NaN };
    expect(() => sma(candles, { period: 5 })).toThrow(/candle 3 has a non-finite open/);
  });
});
