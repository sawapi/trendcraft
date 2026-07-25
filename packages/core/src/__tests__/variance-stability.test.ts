/**
 * Numerical stability of the variance / covariance family.
 *
 * Every statistic here used to be derived from the one-pass shortcuts
 * `Σx²/n − mean²` and `n·Σxy − Σx·Σy`. Both subtract two nearly equal large
 * numbers as soon as the values are large relative to their spread, which is
 * the normal state of affairs for prices quoted in yen, won or rupiah, and for
 * raw share volumes. The failures were not gradual: bands collapsed to zero
 * width, a correlation of −1 was reported as 0, a hedge ratio flipped sign.
 *
 * The shared property tested throughout is scale invariance — shifting a
 * series by a constant must not change its standard deviation, correlation or
 * regression slope — checked at offsets where the one-pass forms break.
 */
import { describe, expect, it } from "vitest";
import { centeredCrossMoments, centeredMoments, slopeOverIndex } from "../core/statistics";
import { pearsonCorrelation } from "../correlation/rolling";
import { createLinearRegression } from "../indicators/incremental/trend/linear-regression";
import { createBollingerBands } from "../indicators/incremental/volatility/bollinger-bands";
import { createHistoricalVolatility } from "../indicators/incremental/volatility/historical-volatility";
import { createStandardDeviation } from "../indicators/incremental/volatility/standard-deviation";
import { createVolumeAnomaly } from "../indicators/incremental/volume/volume-anomaly";
import { linearRegression } from "../indicators/trend/linear-regression";
import { bollingerBands } from "../indicators/volatility/bollinger-bands";
import { historicalVolatility } from "../indicators/volatility/historical-volatility";
import { standardDeviation } from "../indicators/volatility/standard-deviation";
import { volumeAnomaly } from "../indicators/volume/volume-anomaly";
import { olsRegression } from "../pairs/regression";
import type { NormalizedCandle } from "../types";

/** Candles whose close follows `base + amp·sin(i·0.7)` — a quiet market. */
function sineCandles(n: number, base: number, amp = 1, volume = 1_000_000): NormalizedCandle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = base + amp * Math.sin(i * 0.7);
    return {
      time: 1_700_000_000 + i * 86_400,
      open: close,
      high: close,
      low: close,
      close,
      volume,
    };
  });
}

function candlesFromVolumes(volumes: number[]): NormalizedCandle[] {
  return volumes.map((volume, i) => ({
    time: 1_700_000_000 + i * 86_400,
    open: 100,
    high: 100,
    low: 100,
    close: 100,
    volume,
  }));
}

/** Largest relative difference between two aligned numeric series. */
function maxRelErr(actual: (number | null)[], expected: (number | null)[]): number {
  let worst = 0;
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i];
    const a = actual[i];
    if (e === null || a === null) continue;
    const denom = Math.abs(e) > 1e-12 ? Math.abs(e) : 1;
    worst = Math.max(worst, Math.abs(a - e) / denom);
  }
  return worst;
}

const OFFSETS = [1e2, 1e7, 1e8];

describe("centeredMoments / centeredCrossMoments", () => {
  it("are invariant to a constant offset", () => {
    const values = [10, 12, 11, 13, 9];
    const base = centeredMoments(values);
    const shifted = centeredMoments(values.map((v) => v + 1e8));

    expect(shifted.sumSqDev).toBeCloseTo(base.sumSqDev, 10);
    expect(shifted.mean - 1e8).toBeCloseTo(base.mean, 6);
  });

  it("returns zeros for empty input and compares over the common prefix", () => {
    expect(centeredMoments([])).toEqual({ n: 0, mean: 0, sumSqDev: 0 });
    expect(centeredCrossMoments([], [])).toEqual({
      n: 0,
      meanX: 0,
      meanY: 0,
      sxx: 0,
      syy: 0,
      sxy: 0,
    });
    // Extra trailing values in the longer series are ignored.
    expect(centeredCrossMoments([1, 2, 3], [1, 2, 3, 99]).n).toBe(3);
  });

  it("cross moments are invariant to constant offsets in either series", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 5, 4, 5];
    const plain = centeredCrossMoments(x, y);
    const shifted = centeredCrossMoments(
      x.map((v) => v + 1e8),
      y.map((v) => v + 1e8),
    );

    expect(shifted.sxx).toBeCloseTo(plain.sxx, 8);
    expect(shifted.sxy).toBeCloseTo(plain.sxy, 8);
    expect(shifted.syy).toBeCloseTo(plain.syy, 8);
  });

  it("slopeOverIndex recovers an exact linear slope at any level", () => {
    for (const base of [0, 1e3, 1e12]) {
      const values = Array.from({ length: 30 }, (_, i) => base + i * 7);
      expect(slopeOverIndex(values)).toBeCloseTo(7, 6);
    }
    expect(slopeOverIndex([5])).toBe(0);
    expect(slopeOverIndex([])).toBe(0);
  });
});

describe("olsRegression at high value levels", () => {
  // y = 0.5·wiggle + noise, so the true slope is 0.5 regardless of offset.
  function pair(offset: number): { x: number[]; y: number[] } {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 200; i++) {
      const wiggle = Math.sin(i * 0.3) * 10;
      x.push(offset + wiggle);
      y.push(offset + 0.5 * wiggle + Math.cos(i * 1.1) * 0.01);
    }
    return { x, y };
  }

  it("recovers the same slope at every offset and keeps r² in [0, 1]", () => {
    // The fit at offset 0 is the reference: shifting both series by a constant
    // cannot change the slope of the relation between them.
    const { x: x0, y: y0 } = pair(0);
    const reference = olsRegression(x0, y0);
    expect(reference.beta).toBeCloseTo(0.5, 3);

    for (const offset of OFFSETS) {
      const { x, y } = pair(offset);
      const { beta, rSquared } = olsRegression(x, y);

      expect(beta).toBeCloseTo(reference.beta, 6);
      expect(rSquared).toBeGreaterThanOrEqual(0);
      expect(rSquared).toBeLessThanOrEqual(1);
      expect(rSquared).toBeGreaterThan(0.99);
    }
  });

  it("does not flip the hedge ratio when both series sit at 1e8", () => {
    const { x, y } = pair(1e8);
    expect(olsRegression(x, y).beta).toBeGreaterThan(0);
  });
});

describe("pearsonCorrelation at high value levels", () => {
  it("reports −1 for perfectly anti-correlated series at any offset", () => {
    for (const offset of [0, 1e2, 1e6, 1e8]) {
      const x = Array.from({ length: 50 }, (_, i) => offset + i);
      const y = Array.from({ length: 50 }, (_, i) => offset - i);
      expect(pearsonCorrelation(x, y)).toBeCloseTo(-1, 12);
    }
  });

  it("stays inside the documented [-1, 1] range", () => {
    const x = Array.from({ length: 50 }, (_, i) => 100 + i);
    const y = Array.from({ length: 50 }, (_, i) => 100 - i);
    const r = pearsonCorrelation(x, y);
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);
  });
});

describe("bollingerBands at high price levels", () => {
  it("keeps upper === middle + stdDev · standardDeviation() at every price level", () => {
    for (const base of [1e2, 1e7, 1e9]) {
      const candles = sineCandles(600, base);
      const bands = bollingerBands(candles, { period: 20, stdDev: 2 });
      const sd = standardDeviation(candles, { period: 20 });

      // Compared as the bands are built rather than by recovering the standard
      // deviation from `upper - middle`: that subtraction is itself lossy at
      // 1e9. Both sides run the same two-pass arithmetic, so the identity the
      // Bollinger docs state holds exactly.
      let compared = 0;
      for (let i = 0; i < bands.length; i++) {
        const { upper, middle, lower } = bands[i].value;
        const s = sd[i].value;
        if (upper === null || middle === null || lower === null || s === null) continue;
        expect(upper).toBe(middle + 2 * s);
        expect(lower).toBe(middle - 2 * s);
        compared++;
      }
      expect(compared).toBeGreaterThan(500);
    }
  });

  it("does not collapse the bands to zero width at 1e8", () => {
    const bands = bollingerBands(sineCandles(600, 1e8), { period: 20, stdDev: 2 });
    const warmed = bands.filter((b) => b.value.upper !== null);
    const zeroWidth = warmed.filter((b) => (b.value.upper as number) === (b.value.lower as number));

    expect(warmed.length).toBeGreaterThan(0);
    expect(zeroWidth).toHaveLength(0);
  });
});

describe("linearRegression slope accuracy at high price levels", () => {
  // A ramp of exactly 0.5 per bar: the slope is known independently of the
  // implementation, so batch and incremental are each checked against the
  // truth rather than against each other — two implementations sharing one
  // wrong formula would agree perfectly.
  function ramp(base: number, n = 60): NormalizedCandle[] {
    return Array.from({ length: n }, (_, i) => {
      const close = base + i * 0.5;
      return {
        time: 1_700_000_000 + i * 86_400,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1_000_000,
      };
    });
  }

  it("recovers the true slope at every price level, batch and incremental", () => {
    for (const base of [1e2, 1e8, 1e15]) {
      const candles = ramp(base);

      const batch = linearRegression(candles, { period: 14 });
      const lastBatch = batch[batch.length - 1].value;
      expect(lastBatch?.slope).toBeCloseTo(0.5, 6);

      const inc = createLinearRegression({ period: 14 });
      const streamed = candles.map((c) => inc.next(c).value);
      expect(streamed[streamed.length - 1]?.slope).toBeCloseTo(0.5, 6);
    }
  });
});

describe("incremental ↔ batch parity at high price levels", () => {
  it("standardDeviation matches the batch indicator", () => {
    for (const base of [1e7, 1e8]) {
      const candles = sineCandles(400, base);
      const inc = createStandardDeviation({ period: 20 });
      const streamed = candles.map((c) => inc.next(c).value);

      expect(
        maxRelErr(
          streamed,
          standardDeviation(candles, { period: 20 }).map((p) => p.value),
        ),
      ).toBeLessThan(1e-9);
    }
  });

  it("bollingerBands matches the batch indicator", () => {
    const candles = sineCandles(400, 1e8);
    const inc = createBollingerBands({ period: 20, stdDev: 2 });
    const streamed = candles.map((c) => inc.next(c).value.upper);

    expect(
      maxRelErr(
        streamed,
        bollingerBands(candles, { period: 20, stdDev: 2 }).map((p) => p.value.upper),
      ),
    ).toBeLessThan(1e-9);
  });

  it("linearRegression rSquared matches the batch indicator", () => {
    // Uptrend plus a small sine — r² is meaningful but the window variance is
    // tiny next to the price level.
    const candles = Array.from({ length: 300 }, (_, i) => {
      const close = 1e8 + i * 0.5 + Math.sin(i * 0.7) * 2;
      return {
        time: 1_700_000_000 + i * 86_400,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1_000_000,
      };
    });
    const inc = createLinearRegression({ period: 14 });
    const streamed = candles.map((c) => inc.next(c).value?.rSquared ?? null);
    const batch = linearRegression(candles, { period: 14 }).map((p) => p.value?.rSquared ?? null);

    expect(streamed.filter((v) => v !== null && v > 0).length).toBeGreaterThan(0);
    expect(maxRelErr(streamed, batch)).toBeLessThan(1e-6);
  });

  it("historicalVolatility matches the batch indicator under strong drift", () => {
    // Log returns clustered far from zero relative to their spread — the shape
    // that made the one-pass sample variance report exactly zero.
    const candles = Array.from({ length: 200 }, (_, i) => {
      const close = 100 * 2 ** i * (1 + Math.sin(i * 0.7) * 1e-9);
      return {
        time: 1_700_000_000 + i * 86_400,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1_000_000,
      };
    });
    const inc = createHistoricalVolatility({ period: 20 });
    const streamed = candles.map((c) => inc.next(c).value);
    const batch = historicalVolatility(candles, { period: 20 }).map((p) => p.value);

    expect(streamed.some((v) => v !== null && v > 0)).toBe(true);
    expect(maxRelErr(streamed, batch)).toBeLessThan(1e-6);
  });
});

describe("volumeAnomaly at high volume levels", () => {
  // A genuine ~3.73-sigma outlier riding on a huge base volume.
  const volumes = Array.from({ length: 40 }, (_, i) => 1e12 + (i % 4) - 1.5);
  volumes[volumes.length - 1] = 1e12 + 6;

  it("still flags the outlier in the batch indicator", () => {
    const result = volumeAnomaly(candlesFromVolumes(volumes), { period: 20, useZScore: true });
    const last = result[result.length - 1].value;

    expect(last.zScore).not.toBeNull();
    expect(last.zScore as number).toBeGreaterThan(3);
    expect(last.isAnomaly).toBe(true);
  });

  it("agrees between batch and incremental", () => {
    const candles = candlesFromVolumes(volumes);
    const inc = createVolumeAnomaly({ period: 20, useZScore: true });
    const streamed = candles.map((c) => inc.next(c).value.zScore);
    const batch = volumeAnomaly(candles, { period: 20, useZScore: true }).map(
      (p) => p.value.zScore,
    );

    expect(maxRelErr(streamed, batch)).toBeLessThan(1e-9);
  });
});

describe("snapshot resume carries no drift", () => {
  it("bollingerBands resumed mid-stream matches an uninterrupted run", () => {
    const candles = sineCandles(300, 1e8);
    const uninterrupted = createBollingerBands({ period: 20, stdDev: 2 });
    const expected = candles.map((c) => uninterrupted.next(c).value.upper);

    const first = createBollingerBands({ period: 20, stdDev: 2 });
    for (const c of candles.slice(0, 150)) first.next(c);
    const resumed = createBollingerBands({}, { fromState: first.getState() });
    const after = candles.slice(150).map((c) => resumed.next(c).value.upper);

    expect(maxRelErr(after, expected.slice(150))).toBe(0);
  });

  it("standardDeviation resumed mid-stream matches an uninterrupted run", () => {
    const candles = sineCandles(300, 1e8);
    const uninterrupted = createStandardDeviation({ period: 20 });
    const expected = candles.map((c) => uninterrupted.next(c).value);

    const first = createStandardDeviation({ period: 20 });
    for (const c of candles.slice(0, 150)) first.next(c);
    const resumed = createStandardDeviation({}, { fromState: first.getState() });
    const after = candles.slice(150).map((c) => resumed.next(c).value);

    expect(maxRelErr(after, expected.slice(150))).toBe(0);
  });
});
