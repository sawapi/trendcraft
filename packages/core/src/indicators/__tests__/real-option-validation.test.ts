/**
 * Real-valued option validation across the batch indicators and their
 * incremental counterparts.
 *
 * A guard such as `if (multiplier <= 0) throw ...` is false for `NaN`, and
 * `Infinity` passes any lower bound, so before this suite every real-valued
 * option accepted both: `bollingerBands(candles, { stdDev: NaN })` returned
 * NaN bands and `srZones(candles, { restarts: Infinity })` never returned.
 * About half of these options had no domain check at all either, so
 * `t3(candles, { vFactor: -1 })` or `cci(candles, { constant: 0 })` ran on.
 * TA-Lib rejects a non-finite or out-of-range real option with TA_BAD_PARAM;
 * these indicators now do the same.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { adaptiveBollinger } from "../adaptive/adaptive-bollinger";
import { adaptiveMa } from "../adaptive/adaptive-ma";
import {
  createAlma,
  createAnchoredVwap,
  createAtrStops,
  createBollingerBands,
  createCci,
  createChandelierExit,
  createEmv,
  createEwmaVolatility,
  createFairValueGap,
  createGapAnalysis,
  createGarmanKlass,
  createHistoricalVolatility,
  createHurst,
  createKeltnerChannel,
  createLiquiditySweep,
  createMcGinleyDynamic,
  createNvi,
  createOpeningRange,
  createParabolicSar,
  createSupertrend,
  createT3,
  createVolumeAnomaly,
  createVolumeTrend,
  createVsa,
  createWeisWave,
  createZigzag,
} from "../incremental";
import { cci } from "../momentum/cci";
import { hurst } from "../momentum/hurst";
import { alma } from "../moving-average/alma";
import { mcginleyDynamic } from "../moving-average/mcginley-dynamic";
import { t3 } from "../moving-average/t3";
import { fairValueGap } from "../price/fair-value-gap";
import { gapAnalysis } from "../price/gap-analysis";
import { openingRange } from "../price/opening-range";
import { srZones } from "../price/sr-zones";
import { zigzag } from "../price/zigzag";
import { baumWelch } from "../regime/hmm-core";
import { fitHmm, hmmRegimes } from "../regime/hmm-regimes";
import { benchmarkRS, isOutperforming } from "../relative-strength/benchmark-rs";
import { filterByRSPercentile } from "../relative-strength/multi-rs";
import { sessionStats } from "../session/session-stats";
import { liquiditySweep } from "../smc/liquidity-sweep";
import { orderBlock } from "../smc/order-block";
import { parabolicSar } from "../trend/parabolic-sar";
import { schaffTrendCycle } from "../trend/schaff-trend-cycle";
import { supertrend } from "../trend/supertrend";
import { atrStops } from "../volatility/atr-stops";
import { bollingerBands } from "../volatility/bollinger-bands";
import { chandelierExit } from "../volatility/chandelier-exit";
import { ewmaVolatility, garch } from "../volatility/garch";
import { garmanKlass } from "../volatility/garman-klass";
import { historicalVolatility } from "../volatility/historical-volatility";
import { keltnerChannel } from "../volatility/keltner-channel";
import { anchoredVwap } from "../volume/anchored-vwap";
import { easeOfMovement } from "../volume/ease-of-movement";
import { marketProfile } from "../volume/market-profile";
import { nvi } from "../volume/nvi";
import { volumeAnomaly } from "../volume/volume-anomaly";
import { volumeProfile, volumeProfileSeries } from "../volume/volume-profile";
import { volumeTrend } from "../volume/volume-trend";
import { weisWave } from "../volume/weis-wave";
import { vsa } from "../wyckoff/vsa";
import { wyckoffPhases } from "../wyckoff/wyckoff-phases";

const candles: NormalizedCandle[] = Array.from({ length: 60 }, (_, i) => {
  const close = 100 + Math.sin(i / 3) * 5 + i * 0.2;
  return {
    time: 1700000000000 + i * 3600000,
    open: close - 0.4,
    high: close + 1.1,
    low: close - 1.2,
    close,
    volume: 1000 + (i % 7) * 50,
  };
});

const returns = candles.slice(1).map((c, i) => Math.log(c.close / candles[i].close));

/** The domain an option must lie in, beyond being finite. */
type Rule = "positive" | "nonNegative" | "unit" | "finite";

type Target = [fn: string, label: string, rule: Rule, run: (value: number) => unknown];

const TARGETS: Target[] = [
  // Positive multipliers, factors and thresholds
  ["cci", "CCI constant", "positive", (v) => cci(candles, { constant: v })],
  [
    "supertrend",
    "Supertrend multiplier",
    "positive",
    (v) => supertrend(candles, { multiplier: v }),
  ],
  ["parabolicSar", "Parabolic SAR step", "positive", (v) => parabolicSar(candles, { step: v })],
  ["parabolicSar", "Parabolic SAR max", "positive", (v) => parabolicSar(candles, { max: v })],
  [
    "bollingerBands",
    "Standard deviation multiplier",
    "positive",
    (v) => bollingerBands(candles, { stdDev: v }),
  ],
  [
    "atrStops",
    "ATR Stops stopMultiplier",
    "positive",
    (v) => atrStops(candles, { stopMultiplier: v }),
  ],
  [
    "atrStops",
    "ATR Stops takeProfitMultiplier",
    "positive",
    (v) => atrStops(candles, { takeProfitMultiplier: v }),
  ],
  [
    "keltnerChannel",
    "Keltner Channel multiplier",
    "positive",
    (v) => keltnerChannel(candles, { multiplier: v }),
  ],
  [
    "chandelierExit",
    "Chandelier Exit multiplier",
    "positive",
    (v) => chandelierExit(candles, { multiplier: v }),
  ],
  [
    "garmanKlass",
    "Garman-Klass annualFactor",
    "positive",
    (v) => garmanKlass(candles, { annualFactor: v }),
  ],
  [
    "historicalVolatility",
    "Historical Volatility annualFactor",
    "positive",
    (v) => historicalVolatility(candles, { annualFactor: v }),
  ],
  ["zigzag", "Zigzag deviation", "positive", (v) => zigzag(candles, { deviation: v })],
  ["zigzag", "Zigzag atrMultiplier", "positive", (v) => zigzag(candles, { atrMultiplier: v })],
  [
    "openingRange",
    "Opening Range minutes",
    "positive",
    (v) => openingRange(candles, { minutes: v }),
  ],
  ["srZones", "S/R zones zoneWidth", "positive", (v) => srZones(candles, { zoneWidth: v })],
  ["mcginleyDynamic", "McGinley Dynamic k", "positive", (v) => mcginleyDynamic(candles, { k: v })],
  ["alma", "ALMA sigma", "positive", (v) => alma(candles, { sigma: v })],
  ["vsa", "VSA highVolumeThreshold", "positive", (v) => vsa(candles, { highVolumeThreshold: v })],
  ["vsa", "VSA lowVolumeThreshold", "positive", (v) => vsa(candles, { lowVolumeThreshold: v })],
  ["vsa", "VSA wideSpreadThreshold", "positive", (v) => vsa(candles, { wideSpreadThreshold: v })],
  [
    "vsa",
    "VSA narrowSpreadThreshold",
    "positive",
    (v) => vsa(candles, { narrowSpreadThreshold: v }),
  ],
  ["nvi", "NVI initialValue", "positive", (v) => nvi(candles, { initialValue: v })],
  [
    "volumeAnomaly",
    "Volume anomaly highThreshold",
    "positive",
    (v) => volumeAnomaly(candles, { highThreshold: v }),
  ],
  [
    "volumeAnomaly",
    "Volume anomaly extremeThreshold",
    "positive",
    (v) => volumeAnomaly(candles, { extremeThreshold: v }),
  ],
  [
    "volumeAnomaly",
    "Volume anomaly zScoreThreshold",
    "positive",
    (v) => volumeAnomaly(candles, { zScoreThreshold: v }),
  ],
  [
    "easeOfMovement",
    "EMV volumeDivisor",
    "positive",
    (v) => easeOfMovement(candles, { volumeDivisor: v }),
  ],
  [
    "adaptiveBollinger",
    "Adaptive Bollinger baseStdDev",
    "positive",
    (v) => adaptiveBollinger(candles, { baseStdDev: v }),
  ],
  [
    "adaptiveMa",
    "Adaptive MA fastConstant",
    "unit",
    (v) => adaptiveMa(candles, { fastConstant: v }),
  ],
  [
    "adaptiveMa",
    "Adaptive MA slowConstant",
    "unit",
    (v) => adaptiveMa(candles, { slowConstant: v }),
  ],
  // Non-negative thresholds (0 means "no minimum")
  [
    "fairValueGap",
    "minGapPercent",
    "nonNegative",
    (v) => fairValueGap(candles, { minGapPercent: v }),
  ],
  [
    "gapAnalysis",
    "Gap Analysis minGapPercent",
    "nonNegative",
    (v) => gapAnalysis(candles, { minGapPercent: v }),
  ],
  [
    "orderBlock",
    "minVolumeRatio",
    "nonNegative",
    (v) => orderBlock(candles, { minVolumeRatio: v }),
  ],
  [
    "liquiditySweep",
    "minSweepDepth",
    "nonNegative",
    (v) => liquiditySweep(candles, { minSweepDepth: v }),
  ],
  [
    "wyckoffPhases",
    "Wyckoff rangeTolerance",
    "nonNegative",
    (v) => wyckoffPhases(candles, { rangeTolerance: v }),
  ],
  ["weisWave", "Weis Wave threshold", "nonNegative", (v) => weisWave(candles, { threshold: v })],
  [
    "marketProfile",
    "Market Profile tickSize",
    "nonNegative",
    (v) => marketProfile(candles, { tickSize: v }),
  ],
  [
    "volumeTrend",
    "Volume Trend minPriceChange",
    "nonNegative",
    (v) => volumeTrend(candles, { minPriceChange: v }),
  ],
  [
    "benchmarkRS",
    "RS flatThreshold",
    "nonNegative",
    (v) => benchmarkRS(candles, candles, { flatThreshold: v }),
  ],
  [
    "adaptiveBollinger",
    "Adaptive Bollinger maxMultiplier",
    "finite",
    (v) => adaptiveBollinger(candles, { maxMultiplier: v }),
  ],
  // Unit-interval weights
  ["t3", "T3 vFactor", "unit", (v) => t3(candles, { vFactor: v })],
  ["alma", "ALMA offset", "unit", (v) => alma(candles, { offset: v })],
  [
    "marketProfile",
    "Market Profile valueAreaPercent",
    "unit",
    (v) => marketProfile(candles, { valueAreaPercent: v }),
  ],
  [
    "volumeProfile",
    "Volume profile valueAreaPercent",
    "unit",
    (v) => volumeProfile(candles, { valueAreaPercent: v }),
  ],
  [
    "volumeProfileSeries",
    "Volume profile valueAreaPercent",
    "unit",
    (v) => volumeProfileSeries(candles, { valueAreaPercent: v }),
  ],
  // Any finite value (the option keeps its own domain check)
  [
    "schaffTrendCycle",
    "Schaff Trend Cycle factor",
    "finite",
    (v) => schaffTrendCycle(candles, { factor: v }),
  ],
  // Incremental counterparts: same labels, same rule
  ["createCci", "CCI constant", "positive", (v) => createCci({ period: 20, constant: v })],
  [
    "createBollingerBands",
    "Standard deviation multiplier",
    "positive",
    (v) => createBollingerBands({ stdDev: v }),
  ],
  [
    "createGarmanKlass",
    "Garman-Klass annualFactor",
    "positive",
    (v) => createGarmanKlass({ annualFactor: v }),
  ],
  [
    "createHistoricalVolatility",
    "Historical Volatility annualFactor",
    "positive",
    (v) => createHistoricalVolatility({ annualFactor: v }),
  ],
  ["createZigzag", "Zigzag atrMultiplier", "positive", (v) => createZigzag({ atrMultiplier: v })],
  [
    "createOpeningRange",
    "Opening Range minutes",
    "positive",
    (v) => createOpeningRange({ minutes: v }),
  ],
  [
    "createVsa",
    "VSA highVolumeThreshold",
    "positive",
    (v) => createVsa({ highVolumeThreshold: v }),
  ],
  ["createNvi", "NVI initialValue", "positive", (v) => createNvi({ initialValue: v })],
  [
    "createVolumeAnomaly",
    "Volume anomaly zScoreThreshold",
    "positive",
    (v) => createVolumeAnomaly({ zScoreThreshold: v }),
  ],
  [
    "createFairValueGap",
    "minGapPercent",
    "nonNegative",
    (v) => createFairValueGap({ minGapPercent: v }),
  ],
  [
    "createGapAnalysis",
    "Gap Analysis minGapPercent",
    "nonNegative",
    (v) => createGapAnalysis({ minGapPercent: v }),
  ],
  [
    "createLiquiditySweep",
    "minSweepDepth",
    "nonNegative",
    (v) => createLiquiditySweep({ minSweepDepth: v }),
  ],
  [
    "createVolumeTrend",
    "Volume Trend minPriceChange",
    "nonNegative",
    (v) => createVolumeTrend({ minPriceChange: v }),
  ],
  ["createT3", "T3 vFactor", "unit", (v) => createT3({ vFactor: v })],
];

const NON_FINITE: Array<[string, number]> = [
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["-Infinity", Number.NEGATIVE_INFINITY],
];

describe("real-valued options reject non-finite values", () => {
  for (const [fn, label, , run] of TARGETS) {
    for (const [name, value] of NON_FINITE) {
      it(`${fn}: ${label} rejects ${name}`, () => {
        expect(() => run(value)).toThrow(`${label} must be a finite number`);
      });
    }
  }
});

describe("real-valued options reject values outside their domain", () => {
  for (const [fn, label, rule, run] of TARGETS) {
    if (rule === "positive") {
      it(`${fn}: ${label} rejects 0 and -1`, () => {
        expect(() => run(0)).toThrow(`${label} must be positive`);
        expect(() => run(-1)).toThrow(`${label} must be positive`);
      });
    } else if (rule === "nonNegative") {
      it(`${fn}: ${label} rejects -1 and accepts 0`, () => {
        expect(() => run(-1)).toThrow(`${label} must be non-negative`);
        expect(() => run(0)).not.toThrow();
      });
    } else if (rule === "unit") {
      it(`${fn}: ${label} rejects -0.1 and 1.1`, () => {
        expect(() => run(-0.1)).toThrow(`${label} must be`);
        expect(() => run(1.1)).toThrow(`${label} must be between 0 and 1`);
      });
    }
  }
});

describe("count-valued options among them are integers", () => {
  const COUNTS: Array<[fn: string, label: string, min: number, run: (value: number) => unknown]> = [
    ["hurst", "Hurst minWindow", 2, (v) => hurst(candles, { minWindow: v, maxWindow: 40 })],
    ["hurst", "Hurst maxWindow", 2, (v) => hurst(candles, { maxWindow: v })],
    ["srZones", "S/R zones maxIterations", 1, (v) => srZones(candles, { maxIterations: v })],
    ["srZones", "S/R zones restarts", 1, (v) => srZones(candles, { restarts: v })],
    ["fairValueGap", "maxActiveFvgs", 1, (v) => fairValueGap(candles, { maxActiveFvgs: v })],
    [
      "adaptiveBollinger",
      "Adaptive Bollinger kurtosisLookback",
      4,
      (v) => adaptiveBollinger(candles, { kurtosisLookback: v }),
    ],
    ["garch", "GARCH maxIterations", 1, (v) => garch(returns, { maxIterations: v })],
    ["sessionStats", "Session stats lookback", 1, (v) => sessionStats([], { lookback: v })],
    ["hmmRegimes", "HMM numStates", 2, (v) => hmmRegimes([], { numStates: v })],
    ["hmmRegimes", "HMM maxIterations", 1, (v) => hmmRegimes([], { maxIterations: v })],
    ["hmmRegimes", "HMM numRestarts", 1, (v) => hmmRegimes([], { numRestarts: v })],
    [
      "hmmRegimes",
      "HMM volatilityWindow",
      1,
      (v) => hmmRegimes([], { featureOptions: { volatilityWindow: v } }),
    ],
    [
      "fitHmm",
      "HMM returnLookback",
      1,
      (v) => fitHmm([], { featureOptions: { returnLookback: v } }),
    ],
    ["fitHmm", "HMM volumeWindow", 1, (v) => fitHmm([], { featureOptions: { volumeWindow: v } })],
    ["createEwmaVolatility", "EWMA seedSize", 1, (v) => createEwmaVolatility({ seedSize: v })],
    [
      "anchoredVwap",
      "Anchored VWAP bands",
      0,
      (v) => anchoredVwap(candles, { anchorTime: candles[0].time, bands: v }),
    ],
  ];

  for (const [fn, label, min, run] of COUNTS) {
    it(`${fn}: ${label} rejects NaN, Infinity and a fraction`, () => {
      // `srZones({ restarts: Infinity })` used to loop forever.
      expect(() => run(Number.NaN)).toThrow(`${label} must be an integer`);
      expect(() => run(Number.POSITIVE_INFINITY)).toThrow(`${label} must be`);
      expect(() => run(min + 0.5)).toThrow(`${label} must be an integer`);
    });
    it(`${fn}: ${label} rejects ${min - 1}`, () => {
      expect(() => run(min - 1)).toThrow(`${label} must be at least ${min}`);
    });
  }

  it("anchoredVwap: bands above 2 are rejected, matching createAnchoredVwap", () => {
    expect(() => anchoredVwap(candles, { anchorTime: candles[0].time, bands: 3 })).toThrow(
      "Anchored VWAP bands must be between 0 and 2",
    );
  });
});

/**
 * Options read as `options?.x ?? default`, which the first inventory did not
 * scan. Each is checked at entry, so empty input (`[]`) cannot skip it.
 */
describe("options read through optional chaining", () => {
  it("garch: tolerance must be positive and finite", () => {
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => garch(returns, { tolerance: v })).toThrow(
        "GARCH tolerance must be a finite number",
      );
    }
    expect(() => garch(returns, { tolerance: -1 })).toThrow("GARCH tolerance must be positive");
  });

  it("EWMA lambda must be strictly between 0 and 1, in both surfaces", () => {
    // RiskMetrics' decay factor: 0.94 for daily data. At 1 the variance never
    // updates; at 0 it is just the last squared return.
    for (const v of [0, 1, -0.5, 1.5]) {
      expect(() => ewmaVolatility(returns, { lambda: v })).toThrow(
        "EWMA lambda must be between 0 and 1 (exclusive)",
      );
      expect(() => createEwmaVolatility({ lambda: v })).toThrow(
        "EWMA lambda must be between 0 and 1 (exclusive)",
      );
    }
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => ewmaVolatility(returns, { lambda: v })).toThrow(
        "EWMA lambda must be a finite number",
      );
      expect(() => createEwmaVolatility({ lambda: v })).toThrow();
    }
    expect(() => ewmaVolatility(returns, { lambda: 0.94 })).not.toThrow();
  });

  it("periodsPerYear must be positive and finite wherever it annualizes", () => {
    for (const v of [0, -252, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => ewmaVolatility(returns, { periodsPerYear: v })).toThrow(
        /periodsPerYear must be/,
      );
      expect(() => garch(returns, { periodsPerYear: v })).toThrow(/periodsPerYear must be/);
    }
  });

  it("HMM tolerance and varianceFloor must be positive; seed an integer", () => {
    expect(() => baumWelch([[0]], { tolerance: Number.NaN })).toThrow(
      "HMM tolerance must be a finite number",
    );
    expect(() => baumWelch([[0]], { tolerance: -1 })).toThrow("HMM tolerance must be positive");
    expect(() => baumWelch([[0]], { varianceFloor: 0 })).toThrow(
      "HMM varianceFloor must be positive",
    );
    expect(() => baumWelch([[0]], { seed: 1.5 })).toThrow("HMM seed must be an integer");
    expect(() => hmmRegimes([], { seed: Number.NaN })).toThrow("HMM seed must be an integer");
  });

  it("srZones seed must be an integer: 42 and 42.9 would seed the same stream", () => {
    expect(() => srZones(candles, { seed: 42.9 })).toThrow("S/R zones seed must be an integer");
    expect(() => srZones(candles, { seed: Number.NaN })).toThrow(
      "S/R zones seed must be an integer",
    );
    expect(() => srZones(candles, { seed: -7 })).not.toThrow();
  });

  it("relative-strength helpers check their threshold parameters", () => {
    expect(() => isOutperforming(candles, candles, 52, Number.NaN)).toThrow(
      "RS minOutperformance must be a finite number",
    );
    const data = new Map([["A", candles]]);
    expect(() => filterByRSPercentile(data, 120)).toThrow(
      "RS minPercentile must be between 0 and 100",
    );
    expect(() => filterByRSPercentile(data, Number.NaN)).toThrow(
      "RS minPercentile must be a finite number",
    );
  });
});

/**
 * Incremental factories that validate through `requireParam`. Its predicates
 * were often bare comparisons (`v > 0`), which reject NaN but let Infinity
 * through, so batch and incremental disagreed. `requireParam` now rejects any
 * non-finite number, and `createMcGinleyDynamic`, which had no check, uses the
 * batch helper.
 */
describe("incremental factories reject non-finite options", () => {
  const FACTORIES: Array<[string, (v: number) => unknown]> = [
    ["createAlma sigma", (v) => createAlma({ sigma: v })],
    ["createAlma offset", (v) => createAlma({ offset: v })],
    ["createMcGinleyDynamic k", (v) => createMcGinleyDynamic({ k: v })],
    ["createSupertrend multiplier", (v) => createSupertrend({ multiplier: v })],
    ["createParabolicSar step", (v) => createParabolicSar({ step: v })],
    ["createParabolicSar max", (v) => createParabolicSar({ max: v })],
    ["createKeltnerChannel multiplier", (v) => createKeltnerChannel({ multiplier: v })],
    ["createAtrStops stopMultiplier", (v) => createAtrStops({ stopMultiplier: v })],
    ["createChandelierExit multiplier", (v) => createChandelierExit({ multiplier: v })],
    ["createHurst minWindow", (v) => createHurst({ minWindow: v })],
    [
      "createAnchoredVwap bands",
      (v) => createAnchoredVwap({ anchorTime: candles[0].time, bands: v }),
    ],
    ["createWeisWave threshold", (v) => createWeisWave({ threshold: v })],
    ["createEmv volumeDivisor", (v) => createEmv({ volumeDivisor: v })],
    ["createZigzag deviation", (v) => createZigzag({ deviation: v })],
  ];

  for (const [name, run] of FACTORIES) {
    it(`${name}: rejects NaN, Infinity and -Infinity`, () => {
      expect(() => run(Number.NaN)).toThrow();
      expect(() => run(Number.POSITIVE_INFINITY)).toThrow();
      expect(() => run(Number.NEGATIVE_INFINITY)).toThrow();
    });
  }

  it("createMcGinleyDynamic: k must be positive, as in the batch indicator", () => {
    expect(() => createMcGinleyDynamic({ k: 0 })).toThrow("McGinley Dynamic k must be positive");
    expect(() => createMcGinleyDynamic({ k: -1 })).toThrow("McGinley Dynamic k must be positive");
  });
});

describe("every default still runs", () => {
  for (const [fn, , , run] of TARGETS) {
    it(`${fn}: still runs with the option left at its default`, () => {
      expect(() => run(undefined as unknown as number)).not.toThrow();
    });
  }
});

/**
 * Structural inventory: real-valued options destructured with a numeric
 * default must be checked in the same file. Period-like names belong to the
 * period inventory in `period-validation.test.ts`.
 */
describe("real-valued option inventory", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const indicatorsRoot = path.resolve(here, "..");
  const PERIOD_LIKE = /(period|Period|lookback|Lookback|bars|Bars|slowing|Slowing)/;

  const collect = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "__tests__" || entry === "incremental") continue;
        collect(full, out);
      } else if (entry.endsWith(".ts") && entry !== "safe.ts") {
        out.push(full);
      }
    }
    return out;
  };

  /** Options that stay unchecked on purpose, with the reason. */
  const ALLOWED: Record<string, string[]> = {
    // Checked together by assertHmmOptions, which the candle-level entry
    // points also call before they return early on empty input.
    "regime/hmm-core.ts": [
      "maxIterations",
      "numRestarts",
      "numStates",
      "seed",
      "tolerance",
      "varianceFloor",
    ],
    // Checked together by assertFeatureOptions, likewise.
    "regime/hmm-features.ts": ["volatilityWindow", "volumeWindow"],
    // A number of levels, checked by the shared assertLevels helper.
    "volume/volume-profile.ts": ["levels"],
  };

  const unchecked: Record<string, string[]> = {};
  for (const file of collect(indicatorsRoot)) {
    const text = readFileSync(file, "utf8");
    const names = new Set<string>();
    for (const m of text.matchAll(/const \{([^}]*)\}\s*=\s*options/g)) {
      for (const part of m[1].split(",")) {
        const match = part.trim().match(/^(\w+)(?:\s*:\s*(\w+))?\s*=\s*-?[0-9.]+$/);
        if (!match) continue;
        const local = match[2] ?? match[1];
        if (!PERIOD_LIKE.test(local)) names.add(local);
      }
    }
    // The adaptive family reads its options one by one: `options.x ?? default`.
    for (const m of text.matchAll(/const (\w+) = options\??\.\w+ \?\? [-0-9.(A-Z]/g)) {
      if (!PERIOD_LIKE.test(m[1])) names.add(m[1]);
    }
    const bare = [...names]
      .filter((name) => !new RegExp(`assert\\w+\\(\\s*"[^"]*",\\s*${name}\\b`).test(text))
      .sort();
    if (bare.length > 0) unchecked[path.relative(indicatorsRoot, file)] = bare;
  }

  it("finds no real-valued option without a check", () => {
    expect(unchecked).toEqual(ALLOWED);
  });
});
