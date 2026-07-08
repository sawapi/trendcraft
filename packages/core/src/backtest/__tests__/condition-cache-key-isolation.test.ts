/**
 * Condition cache-key isolation.
 *
 * Every cached condition series must key on ALL parameters that influence its
 * values. A key that omits a parameter lets two conditions that differ only in
 * that parameter share one cached series — whichever evaluates first poisons
 * the other, both within a run (shared `indicators` object / `and()` combos)
 * and across runs sharing an `IndicatorCache` (gridSearch sweeps silently
 * return identical results for every value of the omitted parameter).
 *
 * Each test evaluates two conditions differing only in one parameter, in
 * poisoning order (the other condition first), and asserts the second matches
 * its fresh-cache ground truth.
 */
import { describe, expect, it } from "vitest";
import { atrPercentSeries } from "../../indicators/volatility/atr-filter";
import { volatilityRegime } from "../../indicators/volatility/regime";
import { candleFormerBullish } from "../../ml/conditions";
import { trainCandleFormer } from "../../ml/train";
import type { CandleFormerWeights } from "../../ml/types";
import type { NormalizedCandle } from "../../types";
import { bollingerBreakout } from "../conditions/bollinger";
import { perfectOrderBullishConfirmed } from "../conditions/po-enhanced";
import { atrPercentAbove, regimeIs } from "../conditions/volatility";
import { volumeExtreme } from "../conditions/volume-anomaly-profile";

/** Deterministic seeded PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateCandles(n: number, seed: number): NormalizedCandle[] {
  const rng = mulberry32(seed);
  const candles: NormalizedCandle[] = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    const change = (rng() - 0.49) * 3;
    const open = price;
    const close = Math.max(price + change, 1);
    candles.push({
      time: 1700000000000 + i * 86400000,
      open,
      high: Math.max(open, close) + rng() * 2,
      low: Math.max(Math.min(open, close) - rng() * 2, 0.5),
      close,
      volume: 1000 + Math.floor(rng() * 5000),
    });
    price = close;
  }
  return candles;
}

/** Evaluate a preset condition across all bars against a shared indicators object. */
function evaluateAll(
  condition: {
    evaluate: (
      i: Record<string, unknown>,
      c: NormalizedCandle,
      x: number,
      a: NormalizedCandle[],
    ) => boolean;
  },
  indicators: Record<string, unknown>,
  candles: NormalizedCandle[],
): boolean[] {
  return candles.map((c, i) => condition.evaluate(indicators, c, i, candles));
}

describe("condition cache-key isolation", () => {
  it("bollingerBreakout: stdDev participates in the cache key", () => {
    const candles = generateCandles(120, 7);
    // Ground truth with fresh caches
    const fresh2 = evaluateAll(bollingerBreakout("upper", 20, 2), {}, candles);
    const fresh3 = evaluateAll(bollingerBreakout("upper", 20, 3), {}, candles);
    // 2σ breaks out more often than 3σ — the data must differentiate them
    expect(fresh2).not.toEqual(fresh3);

    // Poisoning order: 2σ first, then 3σ on the SAME indicators object
    const shared: Record<string, unknown> = {};
    evaluateAll(bollingerBreakout("upper", 20, 2), shared, candles);
    const poisoned3 = evaluateAll(bollingerBreakout("upper", 20, 3), shared, candles);
    expect(poisoned3).toEqual(fresh3);
  });

  it("regimeIs: options participate in the module-level cache key", () => {
    const candles = generateCandles(200, 11);
    const custom = { thresholds: { low: 99.9 } };
    const isLow = (r: { value: { regime: string } | null }) =>
      r.value !== null && r.value.regime === "low";
    const truthDefault = volatilityRegime(candles).map(isLow);
    const truthCustom = volatilityRegime(candles, custom).map(isLow);
    // The data must differentiate the two option sets
    expect(truthDefault).not.toEqual(truthCustom);

    // Poisoning order: default options first pins the cache for this array
    evaluateAll(regimeIs("low"), {}, candles);
    const poisonedCustom = evaluateAll(regimeIs("low", custom), {}, candles);
    expect(poisonedCustom).toEqual(truthCustom);
  });

  it("atrPercentAbove: atrPeriod participates in the module-level cache key", () => {
    const candles = generateCandles(200, 13);
    const s5 = atrPercentSeries(candles, 5);
    const s50 = atrPercentSeries(candles, 50);
    // Find a bar where a threshold separates the two periods' answers
    const idx = candles.findIndex((_, i) => {
      const a = s5[i]?.value;
      const b = s50[i]?.value;
      return (
        a !== null && b !== null && a !== undefined && b !== undefined && Math.abs(a - b) > 0.05
      );
    });
    expect(idx).toBeGreaterThan(-1);
    const v5 = s5[idx].value as number;
    const v50 = s50[idx].value as number;
    const threshold = (v5 + v50) / 2;
    const expected50 = v50 >= threshold;

    // Poisoning order: period-5 condition first pins the cache for this array
    atrPercentAbove(threshold, { atrPeriod: 5 }).evaluate({}, candles[idx], idx, candles);
    const poisoned = atrPercentAbove(threshold, { atrPeriod: 50 }).evaluate(
      {},
      candles[idx],
      idx,
      candles,
    );
    expect(poisoned).toBe(expected50);
  });

  it("perfectOrderBullishConfirmed: collapseEps participates in the cache key", () => {
    const candles = generateCandles(150, 17);
    const tight = perfectOrderBullishConfirmed({ collapseEps: 0.003 });
    const loose = perfectOrderBullishConfirmed({ collapseEps: 0.05 });

    const freshLoose = evaluateAll(loose, {}, candles);
    const shared: Record<string, unknown> = {};
    evaluateAll(tight, shared, candles);
    const poisonedLoose = evaluateAll(loose, shared, candles);

    expect(poisonedLoose).toEqual(freshLoose);
    // The two eps values must occupy two distinct cache slots
    const poeKeys = Object.keys(shared).filter((k) => k.startsWith("poe_"));
    expect(poeKeys.length).toBe(2);
  });

  it("volumeExtreme: threshold participates in the cache key", () => {
    // Noisy baseline (alternating 500/1500) keeps the volume z-score below
    // the promotion threshold so the level depends on the ratio alone.
    // Spike bar ratio ≈ 1.95: extreme for threshold 1.5, not for 3.0.
    const candles = generateCandles(31, 19).map((c, i) => ({
      ...c,
      volume: i === 30 ? 2000 : i % 2 === 0 ? 500 : 1500,
    }));
    const shared: Record<string, unknown> = {};
    const hi = volumeExtreme(3.0, 20);
    const lo = volumeExtreme(1.5, 20);

    // Poisoning order: 3.0 first
    const hiResult = hi.evaluate(shared, candles[30], 30, candles);
    const loResult = lo.evaluate(shared, candles[30], 30, candles);
    expect(hiResult).toBe(false);
    expect(loResult).toBe(true);

    // Reverse poisoning order on a fresh (cloned) setup
    const shared2: Record<string, unknown> = {};
    const candles2 = candles.map((c) => ({ ...c }));
    const loFirst = volumeExtreme(1.5, 20).evaluate(shared2, candles2[30], 30, candles2);
    const hiSecond = volumeExtreme(3.0, 20).evaluate(shared2, candles2[30], 30, candles2);
    expect(loFirst).toBe(true);
    expect(hiSecond).toBe(false);
  });

  it("candleFormer conditions: model weights participate in the cache key", () => {
    const candles = generateCandles(60, 23);
    const { weights } = trainCandleFormer(candles, { epochs: 2, seqLen: 8, seed: 42 });
    // Second "model": same shape, output bias forced to always favor bullish
    const weightsB = JSON.parse(JSON.stringify(weights)) as CandleFormerWeights;
    (weightsB as unknown as { outB: number[] }).outB = (
      weightsB as unknown as { outB: number[] }
    ).outB.map((_, i) => (i === 0 ? 50 : -50));

    const condA = candleFormerBullish(weights, 0);
    const condB = candleFormerBullish(weightsB, 0);

    const freshA = evaluateAll(condA, {}, candles);
    const freshB = evaluateAll(condB, {}, candles);
    // The forced-bias model must actually behave differently
    expect(freshB).not.toEqual(freshA);

    const shared: Record<string, unknown> = {};
    evaluateAll(condA, shared, candles);
    const poisonedB = evaluateAll(condB, shared, candles);

    expect(poisonedB).toEqual(freshB);
    const cfKeys = Object.keys(shared).filter((k) => k.startsWith("candleFormer_"));
    expect(cfKeys.length).toBe(2);
  });
});
