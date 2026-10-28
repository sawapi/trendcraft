import { describe, expect, it } from "vitest";
import { at, stepCandles } from "../../backtest/__tests__/step-candles";
import { runBacktest } from "../../backtest/engine";
import { US_EQUITY_CALENDAR } from "../../calendar";
import { ewmaVolatility, ewmaVolatilityFromCandles } from "../../indicators/volatility/garch";
import { volatilityRegime } from "../../indicators/volatility/regime";
import { calculateSharpeRatio } from "../../optimization/metrics";
import { ulcerPerformanceIndex } from "../../risk/drawdown-analysis";
import { calculateMetricsFromReturns } from "../../risk/stress-test";
import { backtestByRegime } from "../backtest-by-regime";
import {
  captureRatios,
  omegaRatio,
  rollingSharpe,
  rollingVolatility,
  sharpeFromReturns,
  sortinoFromReturns,
} from "../return-metrics";
import { calculateRuntimeMetrics } from "../runtime-metrics";
import { report } from "../tearsheet";

// An invalid annualisation option is rejected whatever the data: a zero
// `periodsPerYear` used to scale every ratio to 0, a negative one turned it
// into NaN, and a fractional window returned all NaN, writing its values to
// keys such as "0.5" instead.

const CANDLES = stepCandles([
  { price: 100, bars: 5 },
  { price: 110, bars: 5 },
]);
const RESULT = runBacktest(CANDLES, at(1), at(8), { capital: 100_000 });
const REGIMES = CANDLES.map((c) => ({ time: c.time, value: { regime: 0, label: "s0" } }));
const RETURNS = [0.01, -0.005, 0.008, -0.002];
// Two trades spanning a usable stretch of time, so the option is only the
// fallback rate.
const TRADES = runBacktest(
  stepCandles([
    { price: 100, bars: 10 },
    { price: 110, bars: 10 },
    { price: 95, bars: 10 },
    { price: 120, bars: 10 },
  ]),
  at(5, 25),
  at(15, 38),
  { capital: 100_000 },
).trades;

const PERIODS_PER_YEAR: [string, (ppy: number, returns: number[]) => unknown][] = [
  ["omegaRatio", (ppy, r) => omegaRatio(r, { periodsPerYear: ppy })],
  ["sharpeFromReturns", (ppy, r) => sharpeFromReturns(r, { periodsPerYear: ppy })],
  ["sortinoFromReturns", (ppy, r) => sortinoFromReturns(r, { periodsPerYear: ppy })],
  ["rollingSharpe", (ppy, r) => rollingSharpe(r, { window: 2, periodsPerYear: ppy })],
  ["rollingVolatility", (ppy, r) => rollingVolatility(r, { window: 2, periodsPerYear: ppy })],
  ["captureRatios", (ppy, r) => captureRatios(r, r, ppy)],
  ["calculateSharpeRatio", (ppy, r) => calculateSharpeRatio(r, 0, ppy)],
  [
    "report",
    (ppy, r) => report(RESULT, { candles: r.length === 0 ? [] : CANDLES, periodsPerYear: ppy }),
  ],
  [
    "backtestByRegime",
    (ppy, r) =>
      backtestByRegime(RESULT, {
        candles: r.length === 0 ? [] : CANDLES,
        regimes: r.length === 0 ? [] : REGIMES,
        periodsPerYear: ppy,
      }),
  ],
];

const INVALID_PERIODS_PER_YEAR = [0, -252, Number.NaN, Number.POSITIVE_INFINITY];

describe("periodsPerYear validation", () => {
  for (const [name, call] of PERIODS_PER_YEAR) {
    for (const ppy of INVALID_PERIODS_PER_YEAR) {
      it(`${name} rejects periodsPerYear ${ppy}`, () => {
        expect(() => call(ppy, RETURNS)).toThrow(
          new RegExp(`${name} periodsPerYear must be (positive|a finite number)`),
        );
      });
    }

    it(`${name} rejects an invalid periodsPerYear even with no data`, () => {
      expect(() => call(0, [])).toThrow(/periodsPerYear must be positive/);
    });

    it(`${name} accepts a fractional periodsPerYear`, () => {
      // periodsPerYearFromSpan measures a real-valued rate, e.g. 251.7.
      expect(() => call(251.7, RETURNS)).not.toThrow();
    });
  }
});

describe("calculateRuntimeMetrics annualizationFactor validation", () => {
  for (const factor of INVALID_PERIODS_PER_YEAR) {
    for (const [desc, trades] of [
      ["no trades", []],
      ["trades with a usable span", TRADES],
    ] as const) {
      it(`rejects ${factor} with ${desc}`, () => {
        expect(() => calculateRuntimeMetrics([...trades], { annualizationFactor: factor })).toThrow(
          /calculateRuntimeMetrics annualizationFactor must be (positive|a finite number)/,
        );
      });
    }
  }

  it("names the calendar when the calendar supplies the rate", () => {
    expect(() =>
      calculateRuntimeMetrics(TRADES, {
        calendar: { ...US_EQUITY_CALENDAR, tradingDaysPerYear: 0 },
      }),
    ).toThrow(/calculateRuntimeMetrics calendar tradingDaysPerYear must be positive/);
  });

  it("uses trades that span a usable stretch of time", () => {
    expect(TRADES.length).toBeGreaterThan(1);
    expect(TRADES[TRADES.length - 1].exitTime).toBeGreaterThan(TRADES[0].entryTime);
  });

  it("accepts a valid factor", () => {
    expect(() => calculateRuntimeMetrics(TRADES, { annualizationFactor: 251.7 })).not.toThrow();
  });
});

const WINDOW: [string, (window: number) => unknown][] = [
  ["rollingSharpe window", (w) => rollingSharpe(RETURNS, { window: w })],
  ["rollingVolatility window", (w) => rollingVolatility(RETURNS, { window: w })],
  ["report rollingWindow", (w) => report(RESULT, { candles: CANDLES, rollingWindow: w })],
];

describe("rolling window validation", () => {
  for (const [label, call] of WINDOW) {
    for (const w of [0, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      it(`${label} rejects ${w}`, () => {
        expect(() => call(w)).toThrow(new RegExp(`${label} must be (at least 1|an integer)`));
      });
    }

    it(`${label} accepts 1`, () => {
      expect(() => call(1)).not.toThrow();
    });
  }
});

// These read the rate through annualizationFactor, which validates it, but
// used to return before reaching it on empty, short or flat input.
const EARLY_RETURN: [string, () => unknown][] = [
  ["ewmaVolatility with no returns", () => ewmaVolatility([], { periodsPerYear: 0 })],
  [
    "ewmaVolatilityFromCandles with one candle",
    () => ewmaVolatilityFromCandles(CANDLES.slice(0, 1), { periodsPerYear: 0 }),
  ],
  ["volatilityRegime with no candles", () => volatilityRegime([], { periodsPerYear: 0 })],
  [
    "calculateMetricsFromReturns with no returns",
    () => calculateMetricsFromReturns([], { periodsPerYear: 0 }),
  ],
  [
    "calculateMetricsFromReturns with flat returns",
    () => calculateMetricsFromReturns([0, 0, 0], { periodsPerYear: 0 }),
  ],
  [
    "ulcerPerformanceIndex with one point",
    () => ulcerPerformanceIndex([100], 0, { periodsPerYear: 0 }),
  ],
  [
    "ulcerPerformanceIndex with no drawdown",
    () => ulcerPerformanceIndex([100, 101, 102], 0, { periodsPerYear: 0 }),
  ],
];

describe("annualizationFactor callers validate before returning early", () => {
  for (const [desc, call] of EARLY_RETURN) {
    it(`${desc} rejects periodsPerYear 0`, () => {
      expect(call).toThrow(/periodsPerYear must be positive/);
    });
  }

  it("ewmaVolatilityFromCandles with one candle rejects an invalid lambda", () => {
    expect(() => ewmaVolatilityFromCandles(CANDLES.slice(0, 1), { lambda: 2 })).toThrow(
      /EWMA lambda must be between 0 and 1/,
    );
  });
});
