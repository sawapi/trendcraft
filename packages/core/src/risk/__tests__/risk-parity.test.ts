import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../core/random";
import { correlationAdjustedSize, riskParityAllocation } from "../risk-parity";

describe("riskParityAllocation", () => {
  it("should assign inverse-vol-like weights to uncorrelated assets", () => {
    // Asset A: low volatility, Asset B: high volatility (2x)
    const n = 200;
    const returnsA: number[] = [];
    const returnsB: number[] = [];

    // Deterministic, uncorrelated returns
    for (let i = 0; i < n; i++) {
      // Use sin/cos to create uncorrelated series
      returnsA.push(Math.sin(i * 0.1) * 0.01);
      returnsB.push(Math.cos(i * 0.3) * 0.02); // 2x volatility
    }

    const result = riskParityAllocation({ A: returnsA, B: returnsB });

    // Higher volatility asset should get lower weight
    expect(result.weights.A).toBeGreaterThan(result.weights.B);

    // Weights should sum to 1
    const totalWeight = Object.values(result.weights).reduce((s, w) => s + w, 0);
    expect(totalWeight).toBeCloseTo(1, 8);
  });

  it("should produce approximately equal risk contributions", () => {
    const n = 300;
    const returnsA: number[] = [];
    const returnsB: number[] = [];
    const returnsC: number[] = [];

    for (let i = 0; i < n; i++) {
      returnsA.push(Math.sin(i * 0.07) * 0.015);
      returnsB.push(Math.cos(i * 0.13) * 0.025);
      returnsC.push(Math.sin(i * 0.23 + 1) * 0.01);
    }

    const result = riskParityAllocation({
      A: returnsA,
      B: returnsB,
      C: returnsC,
    });

    const rcs = Object.values(result.riskContributions);
    const target = 1 / 3;

    // Risk contributions should be approximately equal
    for (const rc of rcs) {
      expect(rc).toBeCloseTo(target, 1);
    }
  });

  it("should return equal weights for identical assets", () => {
    const returns = Array.from({ length: 100 }, (_, i) => Math.sin(i * 0.1) * 0.01);

    const result = riskParityAllocation({
      A: [...returns],
      B: [...returns],
    });

    expect(result.weights.A).toBeCloseTo(0.5, 2);
    expect(result.weights.B).toBeCloseTo(0.5, 2);
  });

  it("should return 100% weight for single asset", () => {
    const returns = Array.from({ length: 100 }, (_, i) => i * 0.001);
    const result = riskParityAllocation({ SPY: returns });

    expect(result.weights.SPY).toBe(1);
    expect(result.riskContributions.SPY).toBe(1);
    expect(result.correlationMatrix).toEqual([[1]]);
  });

  it("should return positive portfolio volatility", () => {
    const n = 100;
    const returnsA = Array.from({ length: n }, (_, i) => Math.sin(i * 0.1) * 0.02);
    const returnsB = Array.from({ length: n }, (_, i) => Math.cos(i * 0.15) * 0.015);

    const result = riskParityAllocation({ A: returnsA, B: returnsB });
    expect(result.portfolioVolatility).toBeGreaterThan(0);
  });

  it("should include correlation matrix of correct dimensions", () => {
    const n = 100;
    const series: Record<string, number[]> = {};
    for (let a = 0; a < 3; a++) {
      series[`asset${a}`] = Array.from(
        { length: n },
        (_, i) => Math.sin(i * (0.1 + a * 0.05)) * 0.01,
      );
    }

    const result = riskParityAllocation(series);
    expect(result.correlationMatrix.length).toBe(3);
    expect(result.correlationMatrix[0].length).toBe(3);

    // Diagonal should be 1
    for (let i = 0; i < 3; i++) {
      expect(result.correlationMatrix[i][i]).toBeCloseTo(1, 5);
    }

    // Symmetric
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        expect(result.correlationMatrix[i][j]).toBeCloseTo(result.correlationMatrix[j][i], 10);
      }
    }
  });
});

describe("correlationAdjustedSize", () => {
  it("should return full size when no existing holdings", () => {
    const currentReturns = Array.from({ length: 50 }, (_, i) => i * 0.001);
    const result = correlationAdjustedSize(currentReturns, [], {
      baseSize: 10000,
    });

    expect(result.adjustedSize).toBe(10000);
    expect(result.sizeFactor).toBe(1);
    expect(result.averageCorrelation).toBe(0);
  });

  it("should reduce size for highly correlated asset", () => {
    const n = 100;
    const returns = Array.from({ length: n }, (_, i) => Math.sin(i * 0.1) * 0.02);
    // Identical returns => correlation = 1
    const result = correlationAdjustedSize(returns, [returns], {
      baseSize: 10000,
    });

    expect(result.sizeFactor).toBeCloseTo(0.25, 2); // minSizeFactor
    expect(result.adjustedSize).toBeCloseTo(2500, -1);
    expect(result.averageCorrelation).toBeCloseTo(1, 1);
  });

  it("should keep full size for uncorrelated asset", () => {
    const n = 200;
    // sin and cos with different frequencies are nearly uncorrelated
    const currentReturns = Array.from({ length: n }, (_, i) => Math.sin(i * 0.1) * 0.02);
    const existingReturns = Array.from({ length: n }, (_, i) => Math.cos(i * 1.7) * 0.02);

    const result = correlationAdjustedSize(currentReturns, [existingReturns], {
      baseSize: 10000,
      lowCorrelationThreshold: 0.3,
    });

    // Correlation should be near 0 => sizeFactor near 1
    expect(result.averageCorrelation).toBeLessThan(0.3);
    expect(result.sizeFactor).toBeCloseTo(1, 1);
    expect(result.adjustedSize).toBeGreaterThan(9000);
  });

  it("should linearly interpolate between thresholds", () => {
    // Construct returns with known moderate correlation (~0.5)
    const n = 1000;
    const base = Array.from({ length: n }, (_, i) => Math.sin(i * 0.1) * 0.02);
    // Use independent noise with a small fraction of the base to get ~0.5 correlation
    const noise = Array.from({ length: n }, (_, i) => Math.cos(i * 1.7 + 3.14) * 0.02);
    const mixed = base.map((v, i) => v * 0.5 + noise[i] * 0.866);

    const result = correlationAdjustedSize(mixed, [base], {
      baseSize: 10000,
      lowCorrelationThreshold: 0.2,
      highCorrelationThreshold: 0.8,
      minSizeFactor: 0.25,
    });

    // Should be somewhere between min and 1
    expect(result.sizeFactor).toBeGreaterThanOrEqual(0.25);
    expect(result.sizeFactor).toBeLessThanOrEqual(1);
    // Verify it is not at the extremes (the interpolation is working)
    expect(result.averageCorrelation).toBeGreaterThan(0.1);
    expect(result.averageCorrelation).toBeLessThan(0.9);
  });

  it("should respect custom minSizeFactor", () => {
    const n = 100;
    const returns = Array.from({ length: n }, (_, i) => Math.sin(i * 0.1) * 0.02);

    const result = correlationAdjustedSize(returns, [returns], {
      baseSize: 10000,
      minSizeFactor: 0.5,
    });

    expect(result.sizeFactor).toBeCloseTo(0.5, 2);
    expect(result.adjustedSize).toBeCloseTo(5000, -1);
  });
});

// ---------------------------------------------------------------------------
// Unequal-length return series
//
// Both functions accept series of different lengths. They used to keep the
// LEADING min(length) observations of each, which pairs disjoint calendar
// periods whenever the histories differ in length; the correlation that came
// out was unrelated to the assets, and both risk controls failed in the unsafe
// direction. Alignment is now on the common trailing window.
// ---------------------------------------------------------------------------

function randomReturns(rnd: () => number, length: number, scale = 0.04): number[] {
  return Array.from({ length }, () => (rnd() - 0.5) * scale);
}

describe("correlationAdjustedSize with unequal-length series", () => {
  it("recognizes a holding whose recent history the new position duplicates", () => {
    const rnd = mulberry32(42);
    const holding = randomReturns(rnd, 500);
    // The asset being sized IS the holding's most recent 100 bars.
    const current = holding.slice(-100);

    const result = correlationAdjustedSize(current, [holding], { baseSize: 10000 });

    // Leading alignment compared holding[0..99] (bars -500..-401) against
    // current (bars -100..-1) and reported averageCorrelation 0.0949 =>
    // sizeFactor 1 => full 10,000 on a duplicate exposure.
    expect(result.averageCorrelation).toBeCloseTo(1, 10);
    expect(result.sizeFactor).toBe(0.25);
    expect(result.adjustedSize).toBe(2500);
  });

  it("is unaffected by older history the two series do not share", () => {
    const rnd = mulberry32(1234);
    let banded = 0;
    let atFullSize = 0;
    let atMinSize = 0;
    const runs = 400;

    for (let run = 0; run < runs; run++) {
      const overlap = 30 + Math.floor(rnd() * 120);
      const current = randomReturns(rnd, overlap);
      // A holding that shares its trailing `overlap` bars with `current` to a
      // varying degree, plus older history `current` cannot see.
      const blend = rnd();
      const shared = current.map((v) => v * blend + (rnd() - 0.5) * 0.04 * (1 - blend));
      const older = randomReturns(rnd, 1 + Math.floor(rnd() * 400));
      const holding = [...older, ...shared];

      const withOlder = correlationAdjustedSize(current, [holding], { baseSize: 10000 });
      const trailingOnly = correlationAdjustedSize(current, [shared], { baseSize: 10000 });

      expect(withOlder).toEqual(trailingOnly);

      if (withOlder.sizeFactor === 1) atFullSize++;
      else if (withOlder.sizeFactor === 0.25) atMinSize++;
      else banded++;
    }

    // The invariant is only non-trivial when the correlation actually moves the
    // size factor, so require every branch of the interpolation to be exercised.
    expect(atFullSize).toBeGreaterThan(0);
    expect(atMinSize).toBeGreaterThan(0);
    expect(banded).toBeGreaterThan(0);
    expect(atFullSize + atMinSize + banded).toBe(runs);
  });

  it("excludes holdings it cannot measure instead of counting them as uncorrelated", () => {
    const rnd = mulberry32(7);
    const a = randomReturns(rnd, 100);

    const measured = correlationAdjustedSize(a, [a], { baseSize: 10000 });
    const withEmpty = correlationAdjustedSize(a, [a, []], { baseSize: 10000 });

    // The empty holding used to stay in the denominator: averageCorrelation
    // halved to 0.5 and the position grew from 2,500 to 6,250.
    expect(measured.adjustedSize).toBe(2500);
    expect(withEmpty).toEqual(measured);
  });

  it("returns full size when no holding shares a window with the new position", () => {
    const rnd = mulberry32(8);
    const a = randomReturns(rnd, 100);

    const result = correlationAdjustedSize(a, [[], []], { baseSize: 10000 });

    expect(result.averageCorrelation).toBe(0);
    expect(result.sizeFactor).toBe(1);
    expect(result.adjustedSize).toBe(10000);
  });
});

describe("riskParityAllocation with unequal-length series", () => {
  it("keeps an asset with a shorter history in the portfolio", () => {
    const rnd = mulberry32(99);
    const A = randomReturns(rnd, 500, 0.04);
    const B = randomReturns(rnd, 300, 0.02);

    const result = riskParityAllocation({ A, B });

    // Previously: weights { A: 1, B: 0 }, portfolioVolatility NaN, and a
    // correlation matrix of NaN — B silently dropped out of the portfolio.
    expect(Number.isFinite(result.portfolioVolatility)).toBe(true);
    expect(result.portfolioVolatility).toBeGreaterThan(0);
    expect(result.weights.B).toBeGreaterThan(0);
    expect(result.weights.A + result.weights.B).toBeCloseTo(1, 12);
    for (const row of result.correlationMatrix) {
      for (const v of row) expect(Number.isFinite(v)).toBe(true);
    }

    // Same answer as pre-aligning the longer series by hand.
    expect(result.weights).toEqual(riskParityAllocation({ A: A.slice(-300), B }).weights);
  });

  it("does not depend on the order the assets are listed in", () => {
    const rnd = mulberry32(2024);
    let withFlatAsset = 0;
    let withThreeOrMore = 0;
    const runs = 60;

    for (let run = 0; run < runs; run++) {
      // 2-4 assets, every one with a DIFFERENT history length, so the shortest
      // is never the one that happens to be listed first.
      const count = 2 + (run % 3);
      const lengths = new Set<number>();
      while (lengths.size < count) lengths.add(60 + Math.floor(rnd() * 400));
      const sorted = [...lengths].sort((a, b) => a - b);

      const assets: Record<string, number[]> = {};
      // Every fourth run makes one asset flat, so a zero-variance asset and
      // ragged lengths occur together rather than only apart.
      const flatIdx = run % 4 === 0 ? run % count : -1;
      sorted.forEach((len, i) => {
        assets[`a${i}`] =
          i === flatIdx ? new Array(len).fill(0) : randomReturns(rnd, len, 0.02 + rnd() * 0.04);
      });
      if (flatIdx >= 0) withFlatAsset++;
      if (count >= 3) withThreeOrMore++;

      const forward = riskParityAllocation(assets);
      const reversed = riskParityAllocation(Object.fromEntries(Object.entries(assets).reverse()));

      // Key order decided which series supplied the observation count, so the
      // shorter-first case truncated the longer assets to their OLDEST bars and
      // could even flip the sign of the reported correlation.
      for (const name of Object.keys(assets)) {
        expect(forward.weights[name]).toBeCloseTo(reversed.weights[name], 12);
      }
      expect(forward.portfolioVolatility).toBeCloseTo(reversed.portfolioVolatility, 12);
    }

    expect(withThreeOrMore).toBeGreaterThan(0);
    expect(withFlatAsset).toBeGreaterThan(0);
  });

  it("uses only the shared window when it is a tiny fraction of one history", () => {
    const rnd = mulberry32(6060);
    const short = randomReturns(rnd, 5, 0.04);
    const head = randomReturns(rnd, 10_000, 0.04);
    // `long` shares only its final 5 bars with `short`; 10,000 older bars are
    // history `short` cannot see.
    const long = [...head, ...short.map((v) => v * 0.5)];

    const result = riskParityAllocation({ Short: short, Long: long });
    const preAligned = riskParityAllocation({ Short: short, Long: long.slice(-5) });

    expect(result.weights.Short).toBeCloseTo(preAligned.weights.Short, 12);
    expect(result.weights.Long).toBeCloseTo(preAligned.weights.Long, 12);
    expect(result.correlationMatrix[0][1]).toBeCloseTo(1, 10);
  });

  it("does not invert the correlation of an asset whose old and recent history differ", () => {
    const rnd = mulberry32(4242);
    const B = randomReturns(rnd, 300);
    // A's oldest 300 bars are anti-correlated with B; its newest 300 are
    // correlated with B. Only the newest 300 overlap B in time.
    const older = B.map((v) => -v + (rnd() - 0.5) * 0.004);
    const newer = B.map((v) => v + (rnd() - 0.5) * 0.004);
    const A = [...older, ...newer];

    const shortFirst = riskParityAllocation({ B, A });
    const longFirst = riskParityAllocation({ A, B });

    // Listing the short series first used to truncate A to its OLDEST 300 bars
    // and report correlation -0.99457 with portfolioVolatility 0.000576;
    // listing it second produced NaN and dropped B entirely.
    expect(shortFirst.correlationMatrix[0][1]).toBeCloseTo(0.99446, 5);
    expect(shortFirst.portfolioVolatility).toBeCloseTo(0.011064, 6);
    expect(longFirst.correlationMatrix[0][1]).toBeCloseTo(0.99446, 5);
    expect(longFirst.portfolioVolatility).toBeCloseTo(0.011064, 6);
  });

  it("throws instead of silently zero-weighting an asset with no returns", () => {
    const rnd = mulberry32(11);
    const A = randomReturns(rnd, 100);

    expect(() => riskParityAllocation({ A, B: [] })).toThrow(/share only 0 observation/);
    expect(() => riskParityAllocation({ A, B: [] })).toThrow(/shortest history: "B"/);
    expect(() => riskParityAllocation({ B: [], A })).toThrow(/shortest history: "B"/);
    expect(() => riskParityAllocation({ Solo: [] })).toThrow(/shortest history: "Solo"/);
  });

  it("refuses a shared window too short to estimate a covariance", () => {
    // One asset with a single observation drags the window every OTHER pair is
    // measured over down to one bar, where every deviation from the mean is 0.
    // The covariance matrix is then all zeros — finite, so the non-finite guard
    // does not fire — and the zero-volatility fallback returned naive equal
    // weights { A: 1/3, B: 1/3, OneDayOld: 1/3 } with portfolioVolatility 0,
    // discarding two full histories of real risk.
    const rnd = mulberry32(1);
    const A = randomReturns(rnd, 500);
    const B = randomReturns(rnd, 500);

    expect(() => riskParityAllocation({ A, B, OneDayOld: [0.01] })).toThrow(
      /share only 1 observation\(s\).*shortest history: "OneDayOld" with 1/,
    );
    expect(() => riskParityAllocation({ A: [0.01], B: [0.02] })).toThrow(/at least 2 are needed/);

    // Two observations is the smallest window that carries information, and it
    // must go through.
    const twoBars = riskParityAllocation({ A: A.slice(-2), B: B.slice(-2) });
    expect(Number.isFinite(twoBars.portfolioVolatility)).toBe(true);
    expect(twoBars.weights.A + twoBars.weights.B).toBeCloseTo(1, 12);
  });

  it("throws instead of emitting weights derived from a non-finite covariance", () => {
    const rnd = mulberry32(12);
    const A = randomReturns(rnd, 100);

    for (const poison of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const B = randomReturns(rnd, 100);
      B[50] = poison;
      expect(() => riskParityAllocation({ A, B })).toThrow(/is not finite/);
    }

    // A finite but extreme series overflows the covariance sum rather than the
    // inputs, so the guard has to sit on the result, not on the input.
    const huge = Array.from({ length: 100 }, (_, i) =>
      i % 2 === 0 ? Number.MAX_VALUE : -Number.MAX_VALUE,
    );
    expect(() => riskParityAllocation({ A, Huge: huge })).toThrow(/is not finite/);

    // The single-asset path takes an early return, so it needs the same guard;
    // it used to hand back weights { Solo: 1 } with a NaN portfolioVolatility.
    expect(() => riskParityAllocation({ Solo: [Number.NaN, 1, 2] })).toThrow(/is not finite/);
    expect(() => riskParityAllocation({ Solo: huge })).toThrow(/is not finite/);
  });

  it("returns an empty allocation for an empty portfolio", () => {
    // This used to throw `Cannot read properties of undefined (reading 'length')`.
    const result = riskParityAllocation({});
    expect(result.weights).toEqual({});
    expect(result.riskContributions).toEqual({});
    expect(result.portfolioVolatility).toBe(0);
    expect(result.correlationMatrix).toEqual([]);
  });
});

describe("risk-parity degenerate and extreme inputs", () => {
  it("keeps the reported size consistent with the reported factor", () => {
    const rnd = mulberry32(555);
    for (let run = 0; run < 100; run++) {
      const current = randomReturns(rnd, 20 + Math.floor(rnd() * 80));
      const holdings = [randomReturns(rnd, 20 + Math.floor(rnd() * 200))];
      const baseSize = 1000 + Math.floor(rnd() * 50000);
      const r = correlationAdjustedSize(current, holdings, { baseSize });
      expect(r.adjustedSize).toBe(baseSize * r.sizeFactor);
      expect(r.sizeFactor).toBeGreaterThanOrEqual(0.25);
      expect(r.sizeFactor).toBeLessThanOrEqual(1);
    }
  });

  it("keeps weights and risk contributions each summing to 1", () => {
    const rnd = mulberry32(556);
    for (let run = 0; run < 100; run++) {
      const assets: Record<string, number[]> = {};
      const count = 2 + Math.floor(rnd() * 3);
      for (let a = 0; a < count; a++) {
        assets[`asset${a}`] = randomReturns(rnd, 40 + Math.floor(rnd() * 200), 0.01 + rnd() * 0.05);
      }
      const result = riskParityAllocation(assets);
      const wSum = Object.values(result.weights).reduce((s, w) => s + w, 0);
      const rcSum = Object.values(result.riskContributions).reduce((s, w) => s + w, 0);
      expect(wSum).toBeCloseTo(1, 10);
      expect(rcSum).toBeCloseTo(1, 10);
      expect(Number.isFinite(result.portfolioVolatility)).toBe(true);
    }
  });

  it("does not let a one-bar holding dilute the correlation average", () => {
    const rnd = mulberry32(21);
    const current = randomReturns(rnd, 100);

    const measurableOnly = correlationAdjustedSize(current, [current], { baseSize: 10000 });
    const withThinHolding = correlationAdjustedSize(current, [current, [0.5]], {
      baseSize: 10000,
    });

    // `pearsonCorr` returns 0 for a one-observation pair, so the thin holding
    // read as "uncorrelated": the average halved to 0.5 and the position grew
    // from 2,500 to 6,250 — the same dilution as the empty-holding case, one
    // observation further along.
    expect(measurableOnly.adjustedSize).toBe(2500);
    expect(withThinHolding).toEqual(measurableOnly);
  });

  it("returns full size when the only shared window is a single observation", () => {
    expect(correlationAdjustedSize([0.01], [[0.02, 0.03]], { baseSize: 10000 })).toEqual({
      adjustedSize: 10000,
      sizeFactor: 1,
      averageCorrelation: 0,
    });
  });

  it("gives full size when the asset being sized has no returns at all", () => {
    const rnd = mulberry32(557);
    const holding = randomReturns(rnd, 100);
    expect(correlationAdjustedSize([], [holding], { baseSize: 10000 })).toEqual({
      adjustedSize: 10000,
      sizeFactor: 1,
      averageCorrelation: 0,
    });
  });

  it("gives a zero-volatility asset weight 0 without producing NaN", () => {
    // Equal lengths on purpose: this pins behaviour the covariance rewrite
    // could have broken, it does not exercise the alignment change.
    const rnd = mulberry32(13);
    const A = randomReturns(rnd, 100);
    const Flat = new Array(100).fill(0);

    const result = riskParityAllocation({ A, Flat });

    expect(result.weights.Flat).toBe(0);
    expect(result.weights.A).toBe(1);
    expect(Number.isFinite(result.portfolioVolatility)).toBe(true);
  });

  it("treats -0 and denormal returns as the zero-variance series they are", () => {
    const rnd = mulberry32(558);
    const B = randomReturns(rnd, 3, 0.04);
    for (const flat of [
      [-0, 0, -0],
      [Number.MIN_VALUE, 0, Number.MIN_VALUE],
    ]) {
      const result = riskParityAllocation({ A: flat, B });
      expect(result.weights.A).toBe(0);
      expect(result.weights.B).toBe(1);
      expect(Number.isFinite(result.portfolioVolatility)).toBe(true);
    }
  });
});
