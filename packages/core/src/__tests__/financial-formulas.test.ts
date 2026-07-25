/**
 * Three formula corrections whose common trait is that the wrong answer looked
 * plausible: a risk measure that moved risk the wrong way, an overfitting
 * defence that switched itself off, and a screening ratio an order of
 * magnitude away from the number its name denotes.
 */
import { describe, expect, it } from "vitest";
import { kurtosis, skewness } from "../core/statistics";
import { calculateMAR } from "../optimization/metrics";
import { calculateVaR } from "../risk/var";
import {
  deflatedSharpeFromReturns,
  expectedMaxSharpe,
  perReturnSharpe,
  probabilisticSharpe,
} from "../scoring/deflated-sharpe";

/** Deterministic uniform generator. */
function makeRng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };
}

/** Approximate standard normal by summing twelve uniforms. */
function makeGauss(rnd: () => number): () => number {
  return () => {
    let s = 0;
    for (let i = 0; i < 12; i++) s += rnd();
    return s - 6;
  };
}

/** Returns with a mild skew of the given sign — the regime CF is valid in. */
function skewedReturns(sign: -1 | 1, n = 200_000): number[] {
  const rnd = makeRng(12345);
  const gauss = makeGauss(rnd);
  return Array.from({ length: n }, () => {
    const base = gauss() * 0.008 + 0.0005;
    return rnd() < 0.05 ? base + sign * 0.012 : base;
  });
}

describe("Cornish-Fisher VaR responds to skew in the right direction", () => {
  it("raises VaR above the parametric figure for negatively skewed returns", () => {
    const returns = skewedReturns(-1);
    expect(skewness(returns)).toBeLessThan(0);

    for (const confidence of [0.95, 0.99]) {
      const parametric = calculateVaR(returns, { confidence, method: "parametric" });
      const cornishFisher = calculateVaR(returns, { confidence, method: "cornishFisher" });

      // A left tail fatter than the normal one means more risk, not less. The
      // expansion used to be evaluated at the positive quantile, where the
      // skew term — even in z — kept its sign and pulled VaR down instead.
      expect(cornishFisher.var).toBeGreaterThan(parametric.var);
    }
  });

  it("lowers VaR below the parametric figure for positively skewed returns", () => {
    const returns = skewedReturns(1);
    expect(skewness(returns)).toBeGreaterThan(0);

    const parametric = calculateVaR(returns, { confidence: 0.95, method: "parametric" });
    const cornishFisher = calculateVaR(returns, { confidence: 0.95, method: "cornishFisher" });

    expect(cornishFisher.var).toBeLessThan(parametric.var);
  });

  it("keeps the hybrid CVaR at least as large as its own VaR", () => {
    const returns = skewedReturns(-1);
    const result = calculateVaR(returns, { confidence: 0.95, method: "cornishFisher" });

    expect(kurtosis(returns)).toBeLessThan(1); // mild enough for the expansion
    expect(result.cvar).toBeGreaterThanOrEqual(result.var);
  });
});

describe("deflated Sharpe survives a non-finite trial", () => {
  const rnd = makeRng(99);
  const gauss = makeGauss(rnd);
  const observed = Array.from({ length: 250 }, () => gauss() * 0.01 + 0.0008);
  const finiteTrials = Array.from({ length: 50 }, (_, i) => 0.02 + (i % 7) * 0.01);

  it("still deflates when one trial has zero variance", () => {
    // A grid trial with a single trade has no variance, and perReturnSharpe
    // reports Infinity for it by design.
    expect(perReturnSharpe([0.05])).toBe(Number.POSITIVE_INFINITY);

    const clean = deflatedSharpeFromReturns(observed, finiteTrials);
    const withInfinity = deflatedSharpeFromReturns(observed, [
      ...finiteTrials,
      Number.POSITIVE_INFINITY,
    ]);
    // No trials means no selection to deflate against, so this is the same
    // statistic with the deflation switched off — the honest reference, since
    // it carries the same non-normality adjustment as the deflated figures.
    const undeflated = deflatedSharpeFromReturns(observed, []);

    // The deflation used to vanish: the variance went NaN, the benchmark fell
    // back to 0, and the DSR became a plain PSR — reading as a credible edge
    // precisely when it was meant to warn about overfitting.
    expect(clean).toBeLessThan(undeflated);
    expect(withInfinity).toBeLessThan(undeflated);
    // Still deflated by the spread of the finite trials, and marginally more
    // so than the 50-trial run: the extra trial was a search that happened,
    // so it counts towards `trials` even though its Sharpe is not a number
    // the spread can be measured from.
    expect(withInfinity).toBeLessThan(clean);
    expect(undeflated - withInfinity).toBeGreaterThan((undeflated - clean) * 0.9);
  });

  it("reports an undefined result when too few trials are finite to measure a spread", () => {
    // Three searches happened; two of them cannot contribute a magnitude. That
    // leaves the spread unknown, which is not the same as knowing there was no
    // selection — answering 0 there would switch the deflation back off.
    expect(
      deflatedSharpeFromReturns(observed, [
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        0.1,
      ]),
    ).toBeNaN();
  });

  it("propagates a NaN trial rather than counting it as a search", () => {
    // NaN is not something perReturnSharpe emits — it means the caller handed
    // over a broken trial, and reporting a confident number from it would be
    // worse than reporting nothing.
    expect(deflatedSharpeFromReturns(observed, [0.1, 0.2, Number.NaN])).toBeNaN();
  });

  it("does not deflate when there was no selection", () => {
    // With no trials, or one, nothing was chosen between: the result is the
    // probabilistic Sharpe against a zero benchmark, up to the non-normality
    // adjustment both share.
    const undeflated = deflatedSharpeFromReturns(observed, []);
    expect(deflatedSharpeFromReturns(observed, [0.1])).toBeCloseTo(undeflated, 10);
    expect(undeflated).toBeCloseTo(
      probabilisticSharpe(perReturnSharpe(observed), 0, observed.length),
      2,
    );
  });

  it("propagates a NaN variance instead of reporting no selection", () => {
    expect(expectedMaxSharpe(50, Number.NaN)).toBeNaN();
    // A genuine absence of spread still means "no selection".
    expect(expectedMaxSharpe(50, 0)).toBe(0);
    expect(expectedMaxSharpe(1, 0.5)).toBe(0);
  });
});

describe("MAR ratio is annualized return over max drawdown", () => {
  it("returns the canonical ratio, twelve times the old monthly form", () => {
    // 10% over one year against a 5% drawdown is a MAR of 2, not 0.1667.
    expect(calculateMAR(10, 252, 5)).toBeCloseTo(2, 6);
  });

  it("orders strategies the way the annualized ratio does", () => {
    // Both over two years. Averaging is linear in total return while
    // compounding is concave, so the two forms genuinely disagree here:
    // by the old monthly form A led (300/24)/50 = 0.250 against B's
    // (200/24)/36 = 0.231, while on compounded annual return B leads
    // 73.2/36 = 2.03 against A's 100/50 = 2.00. This is not a rescaling —
    // the ranking flips, and a grid search would pick the other strategy.
    const a = calculateMAR(300, 504, 50);
    const b = calculateMAR(200, 504, 36);

    expect(a).toBeCloseTo(2.0, 2);
    expect(b).toBeCloseTo(2.03, 2);
    expect(b).toBeGreaterThan(a);
  });
});
