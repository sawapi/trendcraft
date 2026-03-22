import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { candleFormer } from "../candle-former";
import { candleFormerBearish, candleFormerBullish } from "../conditions";
import { trainCandleFormer } from "../train";
import type { CandleFormerConfig } from "../types";
import { DEFAULT_CONFIG } from "../types";

const SMALL_CONFIG: Partial<CandleFormerConfig> = {
  seqLen: 4,
  embedDim: 8,
  numHeads: 2,
  mlpDim: 16,
};

function generateCandles(n: number, seed = 42): NormalizedCandle[] {
  let price = 100;
  const candles: NormalizedCandle[] = [];
  let state = seed;
  const nextRand = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };

  for (let i = 0; i < n; i++) {
    const r = nextRand();
    const trend = Math.sin(i / 10) > 0 ? 1 : -1;
    const change = trend * (r * 3 + 0.5);
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + r * 2;
    const low = Math.min(open, close) - r * 2;
    candles.push({
      time: i * 86400000,
      open,
      high,
      low,
      close,
      volume: 1000 + Math.floor(r * 5000),
    });
    price = close;
  }
  return candles;
}

describe("candleFormer indicator", () => {
  const candles = generateCandles(100);
  const { weights } = trainCandleFormer(candles, {
    epochs: 5,
    ...SMALL_CONFIG,
    batchSize: 16,
    seed: 42,
  });

  it("returns Series with correct length", () => {
    const predictions = candleFormer(candles.slice(0, 20), { weights });
    expect(predictions).toHaveLength(20);
  });

  it("each prediction has valid structure", () => {
    const predictions = candleFormer(candles.slice(0, 10), { weights });
    for (const p of predictions) {
      expect(p.time).toBeTypeOf("number");
      expect(["bullish", "bearish", "neutral"]).toContain(p.value.direction);
      expect(p.value.confidence).toBeGreaterThanOrEqual(0);
      expect(p.value.confidence).toBeLessThanOrEqual(100);

      const { probabilities } = p.value;
      expect(probabilities.bullish).toBeGreaterThanOrEqual(0);
      expect(probabilities.bearish).toBeGreaterThanOrEqual(0);
      expect(probabilities.neutral).toBeGreaterThanOrEqual(0);

      const sum = probabilities.bullish + probabilities.bearish + probabilities.neutral;
      expect(sum).toBeCloseTo(1, 5);

      expect(p.value.token).toBeDefined();
      expect(p.value.token.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns empty array for empty input", () => {
    const predictions = candleFormer([], { weights });
    expect(predictions).toEqual([]);
  });

  it("handles raw candle input (normalization)", () => {
    const rawCandles = candles.slice(0, 10).map((c) => ({
      ...c,
      time: new Date(c.time).toISOString(),
    }));
    const predictions = candleFormer(rawCandles as any, { weights });
    expect(predictions).toHaveLength(10);
  });
});

describe("candleFormerBullish / candleFormerBearish conditions", () => {
  const candles = generateCandles(100);
  const { weights } = trainCandleFormer(candles, {
    epochs: 5,
    ...SMALL_CONFIG,
    batchSize: 16,
    seed: 42,
  });

  it("candleFormerBullish returns PresetCondition", () => {
    const condition = candleFormerBullish(weights, 30);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("candleFormerBullish");
    expect(condition.evaluate).toBeTypeOf("function");
  });

  it("candleFormerBearish returns PresetCondition", () => {
    const condition = candleFormerBearish(weights, 30);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("candleFormerBearish");
  });

  it("condition evaluates without error", () => {
    const condition = candleFormerBullish(weights, 30);
    const indicators: Record<string, unknown> = {};
    const result = condition.evaluate(indicators, candles[10], 10, candles);
    expect(typeof result).toBe("boolean");
  });

  it("condition caches predictions", () => {
    const condition = candleFormerBullish(weights, 30);
    const indicators: Record<string, unknown> = {};

    // First call populates cache
    condition.evaluate(indicators, candles[10], 10, candles);
    expect(indicators.candleFormer_predictions).toBeDefined();

    // Second call should reuse cache
    const cached = indicators.candleFormer_predictions;
    condition.evaluate(indicators, candles[11], 11, candles);
    expect(indicators.candleFormer_predictions).toBe(cached);
  });

  it("bullish and bearish are mutually exclusive at same candle", () => {
    const bullish = candleFormerBullish(weights, 0);
    const bearish = candleFormerBearish(weights, 0);
    const indicators: Record<string, unknown> = {};

    // At confidence=0, at least one should match
    // but not both (they check different directions)
    let bothTrue = 0;
    for (let i = 0; i < candles.length; i++) {
      const b = bullish.evaluate(indicators, candles[i], i, candles);
      const s = bearish.evaluate(indicators, candles[i], i, candles);
      if (b && s) bothTrue++;
    }
    // Bullish and bearish should never both be true
    expect(bothTrue).toBe(0);
  });
});
