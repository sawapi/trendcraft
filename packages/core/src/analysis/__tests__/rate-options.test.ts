import { describe, expect, it } from "vitest";
import { at, stepCandles } from "../../backtest/__tests__/step-candles";
import { runBacktest } from "../../backtest/engine";
import { calculateAllMetrics, calculateSharpeRatio } from "../../optimization/metrics";
import { ulcerPerformanceIndex } from "../../risk/drawdown-analysis";
import { backtestByRegime } from "../backtest-by-regime";
import {
  commonSenseRatio,
  omegaRatio,
  rollingSharpe,
  sharpeFromReturns,
  sortinoFromReturns,
  tailRatio,
} from "../return-metrics";
import { calculateRuntimeMetrics } from "../runtime-metrics";
import { report } from "../tearsheet";

// A rate of -100% or less has no meaning and cannot be de-annualised
// ((1 + r) ** (1 / n) is NaN below -1), and a non-finite one propagates into
// every ratio. Both are rejected whatever the data.

const CANDLES = stepCandles([
  { price: 100, bars: 10 },
  { price: 110, bars: 10 },
  { price: 95, bars: 10 },
  { price: 120, bars: 10 },
]);
const RESULT = runBacktest(CANDLES, at(5, 25), at(15, 38), { capital: 100_000 });
const REGIMES = CANDLES.map((c) => ({ time: c.time, value: { regime: 0, label: "s0" } }));
const RETURNS = [0.01, -0.005, 0.008, -0.002];
const EQUITY = [100, 102, 99, 101, 105];

type Call = (value: number, empty: boolean) => unknown;

const RISK_FREE: [string, Call][] = [
  ["sharpeFromReturns riskFree", (v, e) => sharpeFromReturns(e ? [] : RETURNS, { riskFree: v })],
  ["sortinoFromReturns riskFree", (v, e) => sortinoFromReturns(e ? [] : RETURNS, { riskFree: v })],
  ["rollingSharpe riskFree", (v, e) => rollingSharpe(e ? [] : RETURNS, { window: 2, riskFree: v })],
  ["omegaRatio riskFree", (v, e) => omegaRatio(e ? [] : RETURNS, { riskFree: v })],
  ["calculateSharpeRatio riskFreeRate", (v, e) => calculateSharpeRatio(e ? [] : RETURNS, v)],
  [
    "calculateAllMetrics riskFreeRate",
    (v, e) => calculateAllMetrics(RESULT, e ? [] : CANDLES, { riskFreeRate: v }),
  ],
  [
    "calculateRuntimeMetrics riskFreeRate",
    (v, e) => calculateRuntimeMetrics(e ? [] : RESULT.trades, { riskFreeRate: v }),
  ],
  ["report riskFree", (v, e) => report(RESULT, { candles: e ? [] : CANDLES, riskFree: v })],
  [
    "backtestByRegime riskFree",
    (v, e) =>
      backtestByRegime(RESULT, {
        candles: e ? [] : CANDLES,
        regimes: e ? [] : REGIMES,
        riskFree: v,
      }),
  ],
  ["ulcerPerformanceIndex riskFreeRate", (v, e) => ulcerPerformanceIndex(e ? [] : EQUITY, v)],
];

const REQUIRED_RETURN: [string, Call][] = [
  ["omegaRatio requiredReturn", (v, e) => omegaRatio(e ? [] : RETURNS, { requiredReturn: v })],
  [
    "omegaRatio requiredReturn",
    // periodsPerYear 1 uses the rate as is, without de-annualising it.
    (v, e) => omegaRatio(e ? [] : RETURNS, { requiredReturn: v, periodsPerYear: 1 }),
  ],
  [
    "report requiredReturn",
    (v, e) => report(RESULT, { candles: e ? [] : CANDLES, requiredReturn: v }),
  ],
];

const INVALID_RATES = [-1, -1.5, Number.NaN, Number.POSITIVE_INFINITY];

for (const [group, cases] of [
  ["risk-free rate", RISK_FREE],
  ["required return", REQUIRED_RETURN],
] as const) {
  describe(`${group} validation`, () => {
    for (const [label, call] of cases) {
      for (const v of INVALID_RATES) {
        it(`${label} rejects ${v}`, () => {
          expect(() => call(v, false)).toThrow(
            new RegExp(`${label} must be (greater than -1|a finite number)`),
          );
        });
      }

      it(`${label} rejects an invalid rate even with no data`, () => {
        expect(() => call(-1, true)).toThrow(new RegExp(`${label} must be greater than -1`));
      });

      it(`${label} accepts a negative rate above -1`, () => {
        expect(() => call(-0.005, false)).not.toThrow();
        expect(() => call(0.05, false)).not.toThrow();
      });
    }
  });
}

const CUTOFF: [string, Call][] = [
  ["tailRatio cutoff", (v, e) => tailRatio(e ? [] : RETURNS, v)],
  ["commonSenseRatio cutoff", (v, e) => commonSenseRatio(e ? [] : RETURNS, v)],
];

describe("tail cutoff validation", () => {
  for (const [label, call] of CUTOFF) {
    for (const v of [0.4, 1.01, -0.95, Number.NaN, Number.POSITIVE_INFINITY]) {
      it(`${label} rejects ${v}`, () => {
        expect(() => call(v, false)).toThrow(
          new RegExp(`${label} must be (between 0.5 and 1|a finite number)`),
        );
      });
    }

    it(`${label} rejects an invalid cutoff even with no data`, () => {
      expect(() => call(1.01, true)).toThrow(new RegExp(`${label} must be between 0.5 and 1`));
    });

    for (const v of [0.5, 0.95, 1]) {
      it(`${label} accepts ${v}`, () => {
        expect(() => call(v, false)).not.toThrow();
      });
    }
  }
});
