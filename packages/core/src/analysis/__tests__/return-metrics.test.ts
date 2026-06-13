import { describe, expect, it } from "vitest";
import {
  captureRatios,
  commonSenseRatio,
  cpcIndex,
  gainToPainRatio,
  omegaRatio,
  payoffRatioFromReturns,
  percentileLinear,
  profitFactorFromReturns,
  rollingSharpe,
  rollingVolatility,
  tailRatio,
  winRateFromReturns,
} from "../return-metrics";

const MIXED = [0.01, -0.005, 0.008, -0.002];

describe("percentileLinear", () => {
  it("interpolates linearly between order statistics (pandas/numpy default)", () => {
    const v = [0, 1, 2, 3, 4];
    expect(percentileLinear(v, 0.5)).toBe(2);
    expect(percentileLinear(v, 0.25)).toBe(1);
    // pos = 0.1 * 4 = 0.4 -> 0 + 0.4 * (1 - 0) = 0.4
    expect(percentileLinear(v, 0.1)).toBeCloseTo(0.4, 12);
  });

  it("handles empty and singleton arrays", () => {
    expect(Number.isNaN(percentileLinear([], 0.5))).toBe(true);
    expect(percentileLinear([7], 0.95)).toBe(7);
  });
});

describe("omegaRatio", () => {
  it("is the gain area over the loss area at a zero threshold", () => {
    // gains 0.01 + 0.008 = 0.018; losses 0.005 + 0.002 = 0.007
    expect(omegaRatio(MIXED)).toBeCloseTo(0.018 / 0.007, 12);
  });

  it("matches with an explicit annualization=1 threshold", () => {
    expect(omegaRatio(MIXED, { periodsPerYear: 1 })).toBeCloseTo(0.018 / 0.007, 12);
  });

  it("drops below 1 once the threshold exceeds the average gain", () => {
    expect(omegaRatio(MIXED, { periodsPerYear: 1, requiredReturn: 0.009 })).toBeLessThan(1);
  });

  it("returns NaN with fewer than two observations or no downside", () => {
    expect(Number.isNaN(omegaRatio([0.01]))).toBe(true);
    expect(Number.isNaN(omegaRatio([0.01, 0.02]))).toBe(true);
  });

  it("returns NaN for an impossible required return", () => {
    expect(Number.isNaN(omegaRatio(MIXED, { requiredReturn: -1 }))).toBe(true);
  });
});

describe("tailRatio", () => {
  it("is |95th pct| / |5th pct|, linear-interpolated", () => {
    const r = [-0.05, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.1];
    // upper: pos 8.55 -> 0.05 + 0.55*0.05 = 0.0775
    // lower: pos 0.45 -> -0.05 + 0.45*0.03 = -0.0365
    expect(tailRatio(r)).toBeCloseTo(0.0775 / 0.0365, 10);
  });

  it("returns NaN for an empty series", () => {
    expect(Number.isNaN(tailRatio([]))).toBe(true);
  });
});

describe("gainToPainRatio", () => {
  it("is total return over the magnitude of losses", () => {
    // total 0.011; |losses| 0.007
    expect(gainToPainRatio(MIXED)).toBeCloseTo(0.011 / 0.007, 12);
  });

  it("returns NaN when there are no losing periods", () => {
    expect(Number.isNaN(gainToPainRatio([0.01, 0.02]))).toBe(true);
    expect(Number.isNaN(gainToPainRatio([]))).toBe(true);
  });
});

describe("profitFactorFromReturns", () => {
  it("counts zero as a gain and divides gains by loss magnitude", () => {
    expect(profitFactorFromReturns([0.01, 0, -0.005, 0.008, -0.002])).toBeCloseTo(
      0.018 / 0.007,
      12,
    );
  });

  it("is Infinity with gains but no losses, and 0 when everything is flat", () => {
    expect(profitFactorFromReturns([0.01, 0.02])).toBe(Number.POSITIVE_INFINITY);
    expect(profitFactorFromReturns([0, 0, 0])).toBe(0);
  });
});

describe("winRateFromReturns", () => {
  it("excludes zero returns from the denominator", () => {
    expect(winRateFromReturns([0.01, -0.005, 0.008, -0.002, 0])).toBe(0.5);
  });

  it("is 0 when there are no non-zero returns", () => {
    expect(winRateFromReturns([0, 0])).toBe(0);
  });
});

describe("payoffRatioFromReturns", () => {
  it("is mean gain over mean loss magnitude", () => {
    // avgWin 0.009; avgLoss 0.0035
    expect(payoffRatioFromReturns(MIXED)).toBeCloseTo(0.009 / 0.0035, 12);
  });

  it("returns NaN when there are no losing periods", () => {
    expect(Number.isNaN(payoffRatioFromReturns([0.01, 0.02]))).toBe(true);
  });
});

describe("commonSenseRatio & cpcIndex", () => {
  it("compose their documented factors", () => {
    const pf = profitFactorFromReturns(MIXED);
    expect(commonSenseRatio(MIXED)).toBeCloseTo(pf * tailRatio(MIXED), 12);
    expect(cpcIndex(MIXED)).toBeCloseTo(
      pf * winRateFromReturns(MIXED) * payoffRatioFromReturns(MIXED),
      12,
    );
  });
});

describe("rollingSharpe", () => {
  it("emits leading NaN then mean/std per window (un-annualized)", () => {
    const out = rollingSharpe([0.01, 0.02, 0.03], {
      window: 2,
      annualize: false,
    });
    expect(out).toHaveLength(3);
    expect(Number.isNaN(out[0])).toBe(true);
    // window [0.01, 0.02]: mean 0.015, sample std 0.0070710678
    expect(out[1]).toBeCloseTo(0.015 / 0.007071067811865, 9);
    expect(out[2]).toBeCloseTo(0.025 / 0.007071067811865, 9);
  });

  it("annualizes by sqrt(periodsPerYear) by default", () => {
    const plain = rollingSharpe([0.01, 0.02, 0.03], { window: 2, annualize: false });
    const ann = rollingSharpe([0.01, 0.02, 0.03], { window: 2, periodsPerYear: 252 });
    expect(ann[2]).toBeCloseTo(plain[2] * Math.sqrt(252), 9);
  });

  it("rejects a window below 1", () => {
    expect(() => rollingSharpe([0.01], { window: 0 })).toThrow(/window/);
  });

  it("yields NaN for flat (zero-volatility) windows", () => {
    // Constant returns -> every full window has zero sample std -> undefined.
    const out = rollingSharpe([0.01, 0.01, 0.01], { window: 2 });
    expect(Number.isNaN(out[1])).toBe(true);
    expect(Number.isNaN(out[2])).toBe(true);
    // window 1 is always a single-point (zero-variance) window.
    expect(rollingSharpe([0.01, -0.02, 0.03], { window: 1 }).every(Number.isNaN)).toBe(true);
  });
});

describe("rollingVolatility", () => {
  it("is the sample std times sqrt(periodsPerYear) with leading NaN", () => {
    const out = rollingVolatility([0.01, 0.02, 0.03], { window: 2, periodsPerYear: 1 });
    expect(Number.isNaN(out[0])).toBe(true);
    expect(out[1]).toBeCloseTo(0.007071067811865, 9);
  });
});

describe("captureRatios", () => {
  it("divides geometric annualized returns over up/down benchmark periods", () => {
    const strat = [0.01, -0.005, 0.015, -0.01];
    const bench = [0.02, -0.01, 0.03, -0.02];
    const { up, down, ratio } = captureRatios(strat, bench, 1);
    // Strategy captures roughly half of the benchmark in both regimes.
    expect(up).toBeCloseTo(0.5, 2);
    expect(down).toBeCloseTo(0.5, 2);
    expect(ratio).toBeCloseTo(up / down, 12);
  });

  it("throws on a length mismatch", () => {
    expect(() => captureRatios([0.01], [0.01, 0.02])).toThrow(/length/);
  });

  it("yields NaN for a leg with no qualifying benchmark periods", () => {
    // Benchmark never negative -> the down leg is empty.
    const { down } = captureRatios([0.01, 0.02], [0.01, 0.02], 1);
    expect(Number.isNaN(down)).toBe(true);
  });
});
