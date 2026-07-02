import { describe, expect, it } from "vitest";
import { at, never, stepCandles } from "../../backtest/__tests__/step-candles";
import { runBacktest } from "../../backtest/engine";
import { omegaRatio } from "../return-metrics";
import { report } from "../tearsheet";

// Up, then a drawdown, then recovery — produces winning and losing trades
// and at least one drawdown period.
const CANDLES = stepCandles([
  { price: 100, bars: 10 },
  { price: 110, bars: 10 },
  { price: 95, bars: 10 },
  { price: 120, bars: 10 },
]);
const CAPITAL = 100_000;
// Trade 1: enter @110 (bar 6 fill), exit @95 -> loss. Trade 2: enter @95, exit @120 -> win.
const result = runBacktest(CANDLES, at(5, 25), at(15, 38), { capital: CAPITAL });

describe("report", () => {
  it("mirrors the engine's headline statistics", () => {
    const sheet = report(result, { candles: CANDLES });
    expect(sheet.initialCapital).toBe(CAPITAL);
    expect(sheet.finalCapital).toBe(result.finalCapital);
    expect(sheet.totalReturnPercent).toBe(result.totalReturnPercent);
    expect(sheet.sharpeRatio).toBe(result.sharpeRatio);
    expect(sheet.maxDrawdownPercent).toBe(result.maxDrawdown);
    expect(sheet.profitFactor).toBe(result.profitFactor);
    expect(sheet.tradeCount).toBe(result.tradeCount);
  });

  it("returns daily series that align index-for-index", () => {
    const sheet = report(result, { candles: CANDLES, rollingWindow: 5 });
    const n = CANDLES.length - 1;
    expect(sheet.series.returns).toHaveLength(n);
    expect(sheet.series.equity).toHaveLength(n + 1);
    expect(sheet.series.underwaterPercent).toHaveLength(n + 1);
    expect(sheet.series.rollingSharpe).toHaveLength(n);
    expect(sheet.series.rollingVolatilityPercent).toHaveLength(n);
    expect(sheet.series.equity[0]).toBe(CAPITAL);
  });

  it("keeps the underwater curve non-positive and the ulcer index non-negative", () => {
    const sheet = report(result, { candles: CANDLES });
    for (const dd of sheet.series.underwaterPercent) expect(dd).toBeLessThanOrEqual(1e-9);
    expect(sheet.ulcerIndex).toBeGreaterThanOrEqual(0);
  });

  it("populates the distribution metrics and drawdown summary", () => {
    const sheet = report(result, { candles: CANDLES });
    expect(Number.isFinite(sheet.annualizedVolatilityPercent)).toBe(true);
    expect(sheet.drawdowns.count).toBe(result.drawdownPeriods.length);
    // Both trades win and the strategy is flat (no position, no mark-to-market
    // loss) through the price drop between them, so the faithful equity curve
    // only steps up — there are no losing daily periods. Gain-to-pain and the
    // tail ratio are therefore undefined (NaN); their finite-value paths are
    // covered precisely in return-metrics.test.ts.
    expect(Number.isNaN(sheet.gainToPainRatio)).toBe(true);
    expect(typeof sheet.tailRatio).toBe("number");
    expect(typeof sheet.ulcerPerformanceIndex).toBe("number");
  });

  it("de-annualises riskFree before passing it to omegaRatio", () => {
    const riskFree = 0.04;
    const periodsPerYear = 252;
    const sheet = report(result, { candles: CANDLES, riskFree, periodsPerYear });

    // Same compounding convention rollingSharpe uses (sharpeFromReturns).
    const perPeriodRiskFree = (1 + riskFree) ** (1 / periodsPerYear) - 1;
    const expected = omegaRatio(sheet.series.returns, {
      riskFree: perPeriodRiskFree,
      requiredReturn: 0,
      periodsPerYear,
    });
    const annualThresholdOmega = omegaRatio(sheet.series.returns, {
      riskFree, // the old (broken) behavior: annual rate used per-period
      requiredReturn: 0,
      periodsPerYear,
    });

    expect(Number.isFinite(sheet.omega)).toBe(true);
    expect(sheet.omega).toBe(expected);
    expect(sheet.omega).not.toBe(annualThresholdOmega);
  });

  it("omits capture without a benchmark and computes it with one", () => {
    const noBench = report(result, { candles: CANDLES });
    expect(noBench.capture).toBeNull();

    const benchmark = new Array(CANDLES.length - 1).fill(0.001);
    const withBench = report(result, { candles: CANDLES, benchmarkReturns: benchmark });
    expect(withBench.capture).not.toBeNull();
    expect(typeof withBench.capture?.up).toBe("number");
  });

  it("throws when the benchmark length does not match the daily returns", () => {
    expect(() => report(result, { candles: CANDLES, benchmarkReturns: [0.001, 0.002] })).toThrow(
      /length/,
    );
  });

  it("keeps a no-trade report candle-aligned and flat", () => {
    const flat = runBacktest(CANDLES, never, never, { capital: CAPITAL });
    expect(flat.tradeCount).toBe(0);

    const sheet = report(flat, { candles: CANDLES });
    const n = CANDLES.length - 1;
    expect(sheet.series.returns).toHaveLength(n);
    expect(sheet.series.returns.every((r) => r === 0)).toBe(true);
    expect(sheet.series.equity).toHaveLength(n + 1);
    expect(sheet.series.equity.every((e) => e === CAPITAL)).toBe(true);
    expect(sheet.ulcerIndex).toBe(0);

    // A candle-length benchmark still aligns for the capture ratios.
    const benchmark = new Array(n).fill(0.001);
    expect(() => report(flat, { candles: CANDLES, benchmarkReturns: benchmark })).not.toThrow();
  });
});
