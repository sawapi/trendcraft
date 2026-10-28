import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as conditions from "../backtest/conditions";
import { accountEquity, updateMarginState } from "../backtest/margin";
import { getPrice } from "../core/normalize";
import { resample } from "../core/resample";
import {
  alma,
  anchoredWalkForwardAnalysis,
  applyEquityCurveFilter,
  atrBasedSize,
  batchBacktest,
  bollingerBands,
  calculateAtrStop,
  calculateAtrTakeProfit,
  calculateAtrTrailingStop,
  calculateVaR,
  cci,
  cmo,
  connorsRsi,
  coppockCurve,
  cumulativeReturns,
  dema,
  dpo,
  ema,
  emaRibbon,
  eventStudy,
  ewmaVolatilityFromCandles,
  frama,
  generateNarrative,
  hasRecentSweepSignal,
  highestLowest,
  historicalVolatility,
  hma,
  hurst,
  incremental,
  kama,
  kst,
  linearRegression,
  macd,
  mcginleyDynamic,
  perfectOrder,
  perfectOrderEnhanced,
  pivotPoints,
  ppo,
  projectPatternOutcome,
  recommendedAtrMultiplier,
  returns,
  riskBasedSize,
  roc,
  rollingVaR,
  roofingFilter,
  rotateStrategies,
  rsi,
  runBacktest,
  runBacktestScaled,
  runMonteCarloSimulation,
  safe,
  schaffTrendCycle,
  scoreStrength,
  seriesToCandles,
  sma,
  standardDeviation,
  stochRsi,
  superSmoother,
  t3,
  tema,
  tsi,
  ulcerIndex,
  volumeMa,
  vwma,
  walkForwardAnalysis,
  weisWave,
  wma,
  zlema,
} from "../index";
import { getSourcePrice } from "../indicators/incremental/utils";
import { combinationSearch } from "../optimization/combination-search";
import { gridSearch } from "../optimization/grid-search";
import { checkConstraint } from "../optimization/metrics";
import { paretoOptimization } from "../optimization/pareto";
import { createManagedSession } from "../streaming/position-manager/managed-session";
import { createPositionTracker } from "../streaming/position-manager/position-tracker";
import type { NormalizedCandle } from "../types";

// An option that takes one of a fixed set of keywords used to end in a
// `default` branch that quietly picked a fallback, so a misspelt keyword
// returned a result for a setting nobody asked for: an unknown price `source`
// read the close. These options are now rejected on entry, whatever the data.

const none: NormalizedCandle[] = [];
const candle: NormalizedCandle = { time: 0, open: 1, high: 3, low: 0.5, close: 2, volume: 10 };
const SOURCES = '"open", "high", "low", "close", "hl2", "hlc3", "ohlc4", "volume"';

const SOURCE_TARGETS: [fn: string, label: string, run: (v: unknown) => unknown][] = [
  ["alma", "ALMA source", (v) => alma(none, { source: v } as never)],
  ["bollingerBands", "Bollinger Bands source", (v) => bollingerBands(none, { source: v } as never)],
  ["cci", "CCI source", (v) => cci(none, { source: v } as never)],
  ["cmo", "CMO source", (v) => cmo(none, { source: v } as never)],
  ["connorsRsi", "Connors RSI source", (v) => connorsRsi(none, { source: v } as never)],
  ["coppockCurve", "Coppock Curve source", (v) => coppockCurve(none, { source: v } as never)],
  ["dema", "DEMA source", (v) => dema(none, { source: v } as never)],
  ["dpo", "DPO source", (v) => dpo(none, { source: v } as never)],
  ["ema", "EMA source", (v) => ema(none, { period: 5, source: v } as never)],
  ["emaRibbon", "EMA Ribbon source", (v) => emaRibbon(none, { source: v } as never)],
  [
    "ewmaVolatilityFromCandles",
    "EWMA source",
    (v) => ewmaVolatilityFromCandles(none, { source: v } as never),
  ],
  ["frama", "FRAMA source", (v) => frama(none, { source: v } as never)],
  [
    "highestLowest",
    "highestLowest source",
    (v) => highestLowest(none, { period: 5, source: v } as never),
  ],
  [
    "historicalVolatility",
    "Historical Volatility source",
    (v) => historicalVolatility(none, { source: v } as never),
  ],
  ["hma", "HMA source", (v) => hma(none, { source: v } as never)],
  ["hurst", "Hurst source", (v) => hurst(none, { source: v } as never)],
  ["kama", "KAMA source", (v) => kama(none, { source: v } as never)],
  ["kst", "KST source", (v) => kst(none, { source: v } as never)],
  [
    "linearRegression",
    "Linear Regression source",
    (v) => linearRegression(none, { source: v } as never),
  ],
  ["macd", "MACD source", (v) => macd(none, { source: v } as never)],
  [
    "mcginleyDynamic",
    "McGinley Dynamic source",
    (v) => mcginleyDynamic(none, { source: v } as never),
  ],
  ["perfectOrder", "perfectOrder source", (v) => perfectOrder(none, { source: v } as never)],
  [
    "perfectOrderEnhanced",
    "perfectOrderEnhanced source",
    (v) => perfectOrderEnhanced(none, { source: v } as never),
  ],
  ["ppo", "PPO source", (v) => ppo(none, { source: v } as never)],
  ["roc", "ROC source", (v) => roc(none, { source: v } as never)],
  ["roofingFilter", "Roofing filter source", (v) => roofingFilter(none, { source: v } as never)],
  ["rsi", "RSI source", (v) => rsi(none, { source: v } as never)],
  [
    "schaffTrendCycle",
    "Schaff Trend Cycle source",
    (v) => schaffTrendCycle(none, { source: v } as never),
  ],
  ["sma", "SMA source", (v) => sma(none, { period: 5, source: v } as never)],
  [
    "standardDeviation",
    "Standard Deviation source",
    (v) => standardDeviation(none, { source: v } as never),
  ],
  ["stochRsi", "Stoch RSI source", (v) => stochRsi(none, { source: v } as never)],
  [
    "superSmoother",
    "Super Smoother source",
    (v) => superSmoother(none, { period: 5, source: v } as never),
  ],
  ["t3", "T3 source", (v) => t3(none, { source: v } as never)],
  ["tema", "TEMA source", (v) => tema(none, { source: v } as never)],
  ["tsi", "TSI source", (v) => tsi(none, { source: v } as never)],
  ["ulcerIndex", "Ulcer Index source", (v) => ulcerIndex(none, { source: v } as never)],
  ["vwma", "VWMA source", (v) => vwma(none, { period: 5, source: v } as never)],
  ["wma", "WMA source", (v) => wma(none, { period: 5, source: v } as never)],
  ["zlema", "ZLEMA source", (v) => zlema(none, { source: v } as never)],
  ["createAlma", "ALMA source", (v) => incremental.createAlma({ source: v } as never)],
  [
    "createBollingerBands",
    "Bollinger Bands source",
    (v) => incremental.createBollingerBands({ source: v } as never),
  ],
  ["createCci", "CCI source", (v) => incremental.createCci({ period: 5, source: v } as never)],
  ["createCmo", "CMO source", (v) => incremental.createCmo({ source: v } as never)],
  [
    "createConnorsRsi",
    "Connors RSI source",
    (v) => incremental.createConnorsRsi({ source: v } as never),
  ],
  [
    "createCoppockCurve",
    "Coppock Curve source",
    (v) => incremental.createCoppockCurve({ source: v } as never),
  ],
  ["createDema", "DEMA source", (v) => incremental.createDema({ source: v } as never)],
  ["createDpo", "DPO source", (v) => incremental.createDpo({ source: v } as never)],
  ["createEma", "EMA source", (v) => incremental.createEma({ period: 5, source: v } as never)],
  [
    "createEmaRibbon",
    "EMA Ribbon source",
    (v) => incremental.createEmaRibbon({ source: v } as never),
  ],
  [
    "createEwmaVolatility",
    "EWMA source",
    (v) => incremental.createEwmaVolatility({ source: v } as never),
  ],
  ["createFrama", "FRAMA source", (v) => incremental.createFrama({ source: v } as never)],
  [
    "createHistoricalVolatility",
    "Historical Volatility source",
    (v) => incremental.createHistoricalVolatility({ source: v } as never),
  ],
  ["createHma", "HMA source", (v) => incremental.createHma({ source: v } as never)],
  ["createHurst", "Hurst source", (v) => incremental.createHurst({ source: v } as never)],
  ["createKama", "KAMA source", (v) => incremental.createKama({ source: v } as never)],
  ["createKst", "KST source", (v) => incremental.createKst({ source: v } as never)],
  [
    "createLinearRegression",
    "Linear Regression source",
    (v) => incremental.createLinearRegression({ source: v } as never),
  ],
  ["createMacd", "MACD source", (v) => incremental.createMacd({ source: v } as never)],
  [
    "createMcGinleyDynamic",
    "McGinley Dynamic source",
    (v) => incremental.createMcGinleyDynamic({ source: v } as never),
  ],
  ["createPpo", "PPO source", (v) => incremental.createPpo({ source: v } as never)],
  ["createRoc", "ROC source", (v) => incremental.createRoc({ period: 5, source: v } as never)],
  [
    "createRoofingFilter",
    "Roofing filter source",
    (v) => incremental.createRoofingFilter({ source: v } as never),
  ],
  ["createRsi", "RSI source", (v) => incremental.createRsi({ source: v } as never)],
  ["createSma", "SMA source", (v) => incremental.createSma({ period: 5, source: v } as never)],
  [
    "createStandardDeviation",
    "Standard Deviation source",
    (v) => incremental.createStandardDeviation({ period: 5, source: v } as never),
  ],
  ["createStc", "Schaff Trend Cycle source", (v) => incremental.createStc({ source: v } as never)],
  ["createStochRsi", "Stoch RSI source", (v) => incremental.createStochRsi({ source: v } as never)],
  [
    "createSuperSmoother",
    "Super Smoother source",
    (v) => incremental.createSuperSmoother({ period: 5, source: v } as never),
  ],
  ["createT3", "T3 source", (v) => incremental.createT3({ source: v } as never)],
  ["createTema", "TEMA source", (v) => incremental.createTema({ source: v } as never)],
  ["createTsi", "TSI source", (v) => incremental.createTsi({ source: v } as never)],
  [
    "createUlcerIndex",
    "Ulcer Index source",
    (v) => incremental.createUlcerIndex({ source: v } as never),
  ],
  ["createVwma", "VWMA source", (v) => incremental.createVwma({ period: 5, source: v } as never)],
  ["createWma", "WMA source", (v) => incremental.createWma({ period: 5, source: v } as never)],
  ["createZlema", "ZLEMA source", (v) => incremental.createZlema({ source: v } as never)],
];

describe("price source validation", () => {
  for (const [fn, label, run] of SOURCE_TARGETS) {
    it(`${fn} rejects an unknown source with no data`, () => {
      expect(() => run("hcl3")).toThrow(`${label} must be one of ${SOURCES}, got "hcl3"`);
    });
  }

  it("covers every function that reads a source", () => {
    expect(SOURCE_TARGETS.length).toBe(75);
  });

  it("highestLowest rejects an empty string rather than falling back to high/low", () => {
    expect(() => highestLowest(none, { period: 5, source: "" as never })).toThrow(
      "highestLowest source must be one of",
    );
  });

  it("still accepts every known source", () => {
    for (const source of [
      "open",
      "high",
      "low",
      "close",
      "hl2",
      "hlc3",
      "ohlc4",
      "volume",
    ] as const) {
      expect(() => sma([candle, candle], { period: 1, source })).not.toThrow();
      expect(() => incremental.createSma({ period: 1, source }).next(candle)).not.toThrow();
    }
  });

  it("getPrice and getSourcePrice no longer read the close for an unknown source", () => {
    expect(() => getPrice(candle, "hcl3" as never)).toThrow("getPrice source must be one of");
    expect(() => getSourcePrice(candle, "hcl3" as never)).toThrow(
      "getSourcePrice source must be one of",
    );
  });

  it("Safe API classifies an unknown source as INVALID_PARAMETER", () => {
    const result = safe.smaSafe(none, { period: 5, source: "hcl3" as never });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_PARAMETER");
  });
});

/**
 * Every file under indicators/ and signals/ that reads a `source` option must
 * check it. A new indicator that forgets would otherwise pass every other
 * test, since a typed caller never passes a bad source.
 */
describe("price source guard inventory", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const READS =
    /\bsource\s*=\s*"[a-z0-9]+"|params\.source\b|options\??\.source\b|const \{[^}]*\bsource\b[^}]*\}\s*=\s*options/;
  const collect = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== "__tests__") collect(full, out);
      } else if (entry.endsWith(".ts")) {
        out.push(full);
      }
    }
    return out;
  };
  const files = ["indicators", "signals"].flatMap((d) => collect(path.join(root, d)));
  const readers = files.filter((f) => READS.test(readFileSync(f, "utf8")));

  it("finds the files it is meant to police", () => {
    expect(readers.length).toBe(75);
  });

  it("finds no source reader without a check", () => {
    const unchecked = readers
      .filter((f) => !readFileSync(f, "utf8").includes("assertPriceSource("))
      .map((f) => path.relative(root, f));
    expect(unchecked).toEqual([]);
  });
});

describe("keyword option validation", () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ ...candle, time: i * 86_400_000 }));
  const sessionOptions = {
    intervalMs: 1000,
    pipeline: {
      indicators: [],
      entry: { type: "preset" as const, name: "never", evaluate: () => false },
      exit: { type: "preset" as const, name: "never", evaluate: () => false },
    },
  };
  const badConstraint = [{ metric: "sharpe", operator: "=>", value: 1 }] as never;
  const factory = () => ({
    entry: { type: "preset" as const, name: "never", evaluate: () => false },
    exit: { type: "preset" as const, name: "never", evaluate: () => false },
  });

  const CASES: [label: string, message: string, run: () => unknown][] = [
    [
      "perfectOrder maType",
      'perfectOrder maType must be one of "sma", "ema", "wma", got "hma"',
      () => perfectOrder(none, { maType: "hma" as never }),
    ],
    [
      "perfectOrderEnhanced maType",
      'perfectOrderEnhanced maType must be one of "sma", "ema", "wma", got "hma"',
      () => perfectOrderEnhanced(none, { enhanced: true, maType: "hma" as never }),
    ],
    [
      "pivotPoints method",
      'pivotPoints method must be one of "standard", "fibonacci", "woodie", "camarilla", "demark", got "wodie"',
      () => pivotPoints(none, { method: "wodie" as never }),
    ],
    [
      "createPivotPoints method",
      'pivotPoints method must be one of "standard", "fibonacci", "woodie", "camarilla", "demark", got "wodie"',
      () => incremental.createPivotPoints({ method: "wodie" as never }),
    ],
    [
      "resample timeframe unit",
      'timeframe unit must be one of "minute", "hour", "day", "week", "month", got "year"',
      () => resample(none, { value: 1, unit: "year" as never }),
    ],
    [
      "resample timeframe shorthand",
      'timeframe must be one of "1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1M", "daily", "weekly", "monthly", got "yearly"',
      () => resample(none, "yearly" as never),
    ],
    [
      "gridSearch constraint operator",
      'gridSearch constraints[0].operator must be one of ">", ">=", "<", "<=", "==", got "=>"',
      () => gridSearch(bars, factory as never, [], { constraints: badConstraint }),
    ],
    [
      "combinationSearch constraint operator",
      'combinationSearch constraints[0].operator must be one of ">", ">=", "<", "<=", "==", got "=>"',
      () => combinationSearch(bars, [], [], { constraints: badConstraint }),
    ],
    [
      "paretoOptimization constraint operator",
      'paretoOptimization constraints[0].operator must be one of ">", ">=", "<", "<=", "==", got "=>"',
      () =>
        paretoOptimization(bars, factory as never, [], {
          objectives: [{ metric: "sharpe", direction: "maximize" }],
          constraints: badConstraint,
        } as never),
    ],
    [
      "checkConstraint operator",
      'constraint operator must be one of ">", ">=", "<", "<=", "==", got "=>"',
      () => checkConstraint(1, "=>" as never, 0),
    ],
    [
      "recommendedAtrMultiplier style",
      'recommendedAtrMultiplier style must be one of "conservative", "moderate", "aggressive", got "bold"',
      () => recommendedAtrMultiplier("bold" as never),
    ],
    [
      "createManagedSession sizing.method",
      'createManagedSession sizing.method must be one of "fixed-fractional", "risk-based", "atr-based", "full-capital", got "kelly"',
      () =>
        createManagedSession(
          sessionOptions,
          {},
          {
            capital: 100_000,
            sizing: { method: "kelly" } as never,
          },
        ),
    ],
  ];

  for (const [label, message, run] of CASES) {
    it(`${label} rejects an unknown keyword`, () => {
      expect(run).toThrow(message);
    });
  }

  it("still accepts every known keyword", () => {
    for (const maType of ["sma", "ema", "wma"] as const) {
      expect(() => perfectOrder(bars, { maType })).not.toThrow();
    }
    for (const method of ["standard", "fibonacci", "woodie", "camarilla", "demark"] as const) {
      expect(() => pivotPoints(bars, { method })).not.toThrow();
      expect(() => incremental.createPivotPoints({ method }).next(candle)).not.toThrow();
    }
    for (const unit of ["minute", "hour", "day", "week", "month"] as const) {
      expect(() => resample(bars, { value: 1, unit })).not.toThrow();
    }
    for (const op of [">", ">=", "<", "<=", "=="] as const) {
      expect(() => checkConstraint(1, op, 0)).not.toThrow();
    }
    for (const style of ["conservative", "moderate", "aggressive"] as const) {
      expect(() => recommendedAtrMultiplier(style)).not.toThrow();
    }
  });
});

/**
 * The same bug class read through a bare comparison rather than a switch:
 * `x === "short" ? a : b` sent every unknown value down the `b` branch.
 * `runBacktest` with `direction: "Short"` entered long but computed each
 * trade's return with the short sign.
 */
describe("keyword options read through a comparison", () => {
  const never = { type: "preset" as const, name: "never", evaluate: () => false };
  const bars = Array.from({ length: 30 }, (_, i) => ({ ...candle, time: i * 86_400_000 }));
  const result = runBacktest(none, never, never, { capital: 1000 });
  const bad = "Bogus";

  const CASES: [label: string, run: () => unknown][] = [
    [
      "runBacktest direction",
      () => runBacktest(none, never, never, { capital: 1, direction: bad as never }),
    ],
    [
      "runBacktest fillMode",
      () => runBacktest(none, never, never, { capital: 1, fillMode: bad as never }),
    ],
    [
      "runBacktest slTpMode",
      () => runBacktest(none, never, never, { capital: 1, slTpMode: bad as never }),
    ],
    [
      "runBacktest timeInForce",
      () => runBacktest(none, never, never, { capital: 1, timeInForce: bad as never }),
    ],
    [
      "runBacktest orderType.type",
      () => runBacktest(none, never, never, { capital: 1, orderType: { type: bad } as never }),
    ],
    [
      "runBacktest sizing.method",
      () => runBacktest(none, never, never, { capital: 1, sizing: { method: bad } as never }),
    ],
    [
      "margin.marginCallAction",
      () =>
        runBacktest(none, never, never, {
          capital: 1,
          margin: { leverage: 2, maintenanceMargin: 0.25, marginCallAction: bad as never },
        }),
    ],
    [
      "runBacktestScaled direction",
      () => runBacktestScaled(none, never, never, { capital: 1, direction: bad as never }),
    ],
    [
      "runBacktestScaled scaledEntry.strategy",
      () =>
        runBacktestScaled(none, never, never, {
          capital: 1,
          scaledEntry: { tranches: 3, strategy: bad as never, intervalType: "signal" },
        }),
    ],
    [
      "runBacktestScaled scaledEntry.intervalType",
      () =>
        runBacktestScaled(none, never, never, {
          capital: 1,
          scaledEntry: { tranches: 3, strategy: "equal", intervalType: bad as never },
        }),
    ],
    [
      "batchBacktest allocation",
      () =>
        batchBacktest([{ symbol: "A", candles: none }], never, never, {
          capital: 1,
          allocation: bad as never,
        }),
    ],
    [
      "gridSearch metric",
      () =>
        gridSearch(bars, (() => ({ entry: never, exit: never })) as never, [], {
          metric: bad as never,
        }),
    ],
    [
      "gridSearch constraints[0].metric",
      () =>
        gridSearch(bars, (() => ({ entry: never, exit: never })) as never, [], {
          constraints: [{ metric: bad as never, operator: ">", value: 0 }],
        }),
    ],
    ["combinationSearch metric", () => combinationSearch(bars, [], [], { metric: bad as never })],
    [
      "paretoOptimization objectives[0].direction",
      () =>
        paretoOptimization(bars, (() => ({ entry: never, exit: never })) as never, [], {
          objectives: [{ metric: "maxDrawdown", direction: "minimise" as never }],
        }),
    ],
    [
      "walkForwardAnalysis metric",
      () =>
        walkForwardAnalysis(bars, (() => ({ entry: never, exit: never })) as never, [], {
          metric: bad as never,
        }),
    ],
    [
      "anchoredWalkForwardAnalysis metric",
      () =>
        anchoredWalkForwardAnalysis(bars, (() => ({ entry: never, exit: never })) as never, [], {
          metric: bad,
        } as never),
    ],
    [
      "runMonteCarloSimulation method",
      () => runMonteCarloSimulation(result, { method: bad as never }),
    ],
    ["rotateStrategies rankingMetric", () => rotateStrategies([], { rankingMetric: bad as never })],
    [
      "rotateStrategies allocationMethod",
      () => rotateStrategies([], { allocationMethod: bad as never }),
    ],
    ["applyEquityCurveFilter type", () => applyEquityCurveFilter(result, { type: bad as never })],
    [
      "applyEquityCurveFilter maType",
      () => applyEquityCurveFilter(result, { maType: bad as never }),
    ],
    ["eventStudy baseline", () => eventStudy(none, [], { baseline: bad as never })],
    ["calculateVaR method", () => calculateVaR([], { method: bad as never })],
    ["rollingVaR method", () => rollingVaR([], { method: bad as never })],
    ["Returns type", () => returns(none, { type: bad as never })],
    ["cumulativeReturns type", () => cumulativeReturns(none, bad as never)],
    ["Volume MA type", () => volumeMa(none, { period: 5, type: bad as never })],
    ["Weis Wave method", () => weisWave(none, { method: bad as never })],
    ["seriesToCandles fillMode", () => seriesToCandles([], { fillMode: bad as never })],
    [
      "generateNarrative language",
      () => generateNarrative({} as never, "entry", true, candle, bad as never),
    ],
    [
      "generateNarrative signalType",
      () => generateNarrative({} as never, bad as never, true, candle),
    ],
    [
      "riskBasedSize direction",
      () =>
        riskBasedSize({
          accountSize: 1000,
          entryPrice: 10,
          riskPercent: 1,
          stopLossPrice: 9,
          direction: bad as never,
        }),
    ],
    [
      "atrBasedSize direction",
      () =>
        atrBasedSize({
          accountSize: 1000,
          entryPrice: 10,
          riskPercent: 1,
          atrValue: 1,
          direction: bad as never,
        }),
    ],
    [
      "createPositionTracker direction",
      () => createPositionTracker({ capital: 1000, direction: bad as never }),
    ],
    ["calculateAtrStop direction", () => calculateAtrStop(10, 1, 2, bad as never)],
    ["calculateAtrTakeProfit direction", () => calculateAtrTakeProfit(10, 1, 2, bad as never)],
    ["calculateAtrTrailingStop direction", () => calculateAtrTrailingStop(10, 1, 2, bad as never)],
    ["accountEquity direction", () => accountEquity(100, 100, bad as never)],
    [
      "updateMarginState direction",
      () => updateMarginState({ borrowedAmount: 0 } as never, 100, 100, bad as never),
    ],
    ["bollingerBreakout band", () => conditions.bollingerBreakout(bad as never)],
    ["bollingerTouch band", () => conditions.bollingerTouch(bad as never)],
    ["scoreStrength strength", () => scoreStrength(bad as never, {} as never)],
    ["hasRecentSweepSignal type", () => hasRecentSweepSignal(none, bad as never)],
    ["orderBlockCreated type", () => conditions.orderBlockCreated(bad as never)],
    ["orderBlockMitigated type", () => conditions.orderBlockMitigated(bad as never)],
    ["hasActiveOrderBlocks type", () => conditions.hasActiveOrderBlocks(bad as never)],
    ["liquiditySweepDetected type", () => conditions.liquiditySweepDetected(bad as never)],
    ["liquiditySweepRecovered type", () => conditions.liquiditySweepRecovered(bad as never)],
    ["hasRecentSweeps type", () => conditions.hasRecentSweeps(bad as never)],
    ["sweepDepthAbove type", () => conditions.sweepDepthAbove(1, bad as never)],
    ["timeframe", () => resample(none, "toString" as never)],
    [
      "projectPatternOutcome extractor direction",
      () => projectPatternOutcome(bars, [0], () => ({ time: 0, direction: "short" as never })),
    ],
  ];

  const PERFECT_ORDER_CONDITIONS: Record<string, (options: { maType?: never }) => unknown> = {
    perfectOrderBullish: conditions.perfectOrderBullish,
    perfectOrderBearish: conditions.perfectOrderBearish,
    perfectOrderCollapsed: conditions.perfectOrderCollapsed,
    perfectOrderActiveBullish: conditions.perfectOrderActiveBullish,
    perfectOrderActiveBearish: conditions.perfectOrderActiveBearish,
    perfectOrderBullishConfirmed: conditions.perfectOrderBullishConfirmed,
    perfectOrderBearishConfirmed: conditions.perfectOrderBearishConfirmed,
    perfectOrderConfirmationFormed: conditions.perfectOrderConfirmationFormed,
    perfectOrderBreakdown: conditions.perfectOrderBreakdown,
    perfectOrderMaCollapsed: conditions.perfectOrderMaCollapsed,
    perfectOrderPreBullish: conditions.perfectOrderPreBullish,
    perfectOrderPreBearish: conditions.perfectOrderPreBearish,
    perfectOrderPullbackEntry: conditions.perfectOrderPullbackEntry,
    perfectOrderPullbackSellEntry: conditions.perfectOrderPullbackSellEntry,
    poPlusEntry: conditions.poPlusEntry,
    pbEntry: conditions.pbEntry,
    poPlusPbEntry: conditions.poPlusPbEntry,
  };
  for (const [name, factory] of Object.entries(PERFECT_ORDER_CONDITIONS)) {
    CASES.push([`${name} maType`, () => factory({ maType: "hma" as never })]);
  }

  for (const [label, run] of CASES) {
    it(`${label} rejects an unknown value`, () => {
      expect(run).toThrow(`${label} must be one of`);
    });
  }

  it("still accepts the documented values", () => {
    for (const direction of ["long", "short"] as const) {
      expect(() => runBacktest(bars, never, never, { capital: 1000, direction })).not.toThrow();
      expect(() => calculateAtrStop(10, 1, 2, direction)).not.toThrow();
    }
    expect(() =>
      paretoOptimization(bars, (() => ({ entry: never, exit: never })) as never, [], {
        objectives: [
          { metric: "sharpe", direction: "maximize" },
          { metric: "maxDrawdown", direction: "minimize" },
        ],
      }),
    ).not.toThrow();
    expect(() => resample(bars, "weekly")).not.toThrow();
    expect(() => conditions.orderBlockCreated()).not.toThrow();
  });
});
