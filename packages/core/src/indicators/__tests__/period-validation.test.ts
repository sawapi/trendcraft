/**
 * Period-option validation across the batch indicators.
 *
 * A period is a bar count used to index candle arrays. Before this suite the
 * batch indicators only checked a lower bound, so a fractional or non-finite
 * period slipped through and changed what the indicator computed without ever
 * failing:
 *
 * - `atr(candles, { period: 14.5 })` never reached its `i === period` seed
 *   branch, so `prevAtr ?? 0` seeded from 0 and the whole series came out
 *   roughly 15x too small.
 * - `cci(candles, { period: 14.5 })` indexed fractional offsets, pushing NaN
 *   into a `Series<number | null>`.
 * - `donchianChannel(candles, { period: NaN })` made the `i < period - 1`
 *   warm-up guard false for every bar, emitting an all-time expanding channel
 *   from bar 0 instead of nulls.
 *
 * The incremental twins already rejected these values, so the two surfaces
 * disagreed on what a valid period was.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { NormalizedCandle, Result, TrendCraftError } from "../../types";
import { adaptiveBollinger } from "../adaptive/adaptive-bollinger";
import { adaptiveMa } from "../adaptive/adaptive-ma";
import { adaptiveRsi } from "../adaptive/adaptive-rsi";
import { adaptiveStochastics } from "../adaptive/adaptive-stochastics";
import { roofingFilter } from "../filter/roofing-filter";
import { superSmoother } from "../filter/super-smoother";
import {
  createAroon,
  createAtr,
  createBollingerBands,
  createBreakOfStructure,
  createCci,
  createChoppinessIndex,
  createCmo,
  createDonchianChannel,
  createDpo,
  createFibonacciRetracement,
  createHighestLowest,
  createHistoricalVolatility,
  createLiquiditySweep,
  createMfi,
  createRoc,
  createRsi,
  createStandardDeviation,
  createStochastics,
  createSwingPoints,
  createUlcerIndex,
  createWilliamsR,
} from "../incremental";
import { adxr } from "../momentum/adxr";
import { aroon } from "../momentum/aroon";
import { awesomeOscillator } from "../momentum/awesome-oscillator";
import { balanceOfPower } from "../momentum/balance-of-power";
import { cci } from "../momentum/cci";
import { cmo } from "../momentum/cmo";
import { coppockCurve } from "../momentum/coppock-curve";
import { dmi } from "../momentum/dmi";
import { dpo } from "../momentum/dpo";
import { imi } from "../momentum/imi";
import { macd } from "../momentum/macd";
import { massIndex } from "../momentum/mass-index";
import { ppo } from "../momentum/ppo";
import { qstick } from "../momentum/qstick";
import { roc } from "../momentum/roc";
import { rsi } from "../momentum/rsi";
import { stochRsi } from "../momentum/stoch-rsi";
import { stochastics } from "../momentum/stochastics";
import { trix } from "../momentum/trix";
import { tsi } from "../momentum/tsi";
import { ultimateOscillator } from "../momentum/ultimate-oscillator";
import { williamsR } from "../momentum/williams-r";
import { breakOfStructure } from "../price/break-of-structure";
import { fractals } from "../price/fractals";
import { highest, highestLowest, lowest } from "../price/highest-lowest";
import { returns } from "../price/returns";
import { swingPoints } from "../price/swing-points";
import { benchmarkRS } from "../relative-strength/benchmark-rs";
import { rankByRS } from "../relative-strength/multi-rs";
import {
  aroonSafe,
  atrSafe,
  bollingerBandsSafe,
  cciSafe,
  donchianChannelSafe,
  dpoSafe,
  highestLowestSafe,
  mfiSafe,
  rocSafe,
  rsiSafe,
  smaSafe,
  stochasticsSafe,
  volumeMaSafe,
  williamsRSafe,
} from "../safe";
import { liquiditySweep } from "../smc/liquidity-sweep";
import { orderBlock } from "../smc/order-block";
import { ichimoku } from "../trend/ichimoku";
import { linearRegression } from "../trend/linear-regression";
import { schaffTrendCycle } from "../trend/schaff-trend-cycle";
import { supertrend } from "../trend/supertrend";
import { vortex } from "../trend/vortex";
import { atr } from "../volatility/atr";
import { atrStops } from "../volatility/atr-stops";
import { bollingerBands } from "../volatility/bollinger-bands";
import { chandelierExit } from "../volatility/chandelier-exit";
import { choppinessIndex } from "../volatility/choppiness-index";
import { donchianChannel } from "../volatility/donchian-channel";
import { garmanKlass } from "../volatility/garman-klass";
import { historicalVolatility } from "../volatility/historical-volatility";
import { keltnerChannel } from "../volatility/keltner-channel";
import { standardDeviation } from "../volatility/standard-deviation";
import { ulcerIndex } from "../volatility/ulcer-index";
import { cmf } from "../volume/cmf";
import { easeOfMovement } from "../volume/ease-of-movement";
import { elderForceIndex } from "../volume/elder-force-index";
import { klinger } from "../volume/klinger";
import { mfi } from "../volume/mfi";
import { volumeAnomaly } from "../volume/volume-anomaly";
import { volumeMa } from "../volume/volume-ma";

const candles: NormalizedCandle[] = Array.from({ length: 40 }, (_, i) => {
  const close = 100 + Math.sin(i / 3) * 5 + i * 0.2;
  return {
    time: 1700000000000 + i * 86400000,
    open: close - 0.4,
    high: close + 1.1,
    low: close - 1.2,
    close,
    volume: 1000 + i * 10,
  };
});

interface Target {
  /** Name used in test titles */
  name: string;
  /** Message prefix the indicator uses for this option */
  label: string;
  /** Smallest accepted value */
  min: number;
  /** Invoke the batch indicator with the given value for the option */
  run: (period: number) => unknown;
  /** Invoke the incremental twin, when one exists */
  runIncremental?: (period: number) => unknown;
  /**
   * True when the option has no default, so omitting it reaches the guard as
   * `undefined`. Everywhere else `undefined` legitimately selects the default.
   */
  optionIsRequired?: boolean;
}

const TARGETS: Target[] = [
  {
    name: "atr",
    label: "ATR period",
    min: 1,
    run: (p) => atr(candles, { period: p }),
    runIncremental: (p) => createAtr({ period: p }),
  },
  {
    name: "rsi",
    label: "RSI period",
    min: 1,
    run: (p) => rsi(candles, { period: p }),
    runIncremental: (p) => createRsi({ period: p }),
  },
  {
    name: "mfi",
    label: "MFI period",
    min: 1,
    run: (p) => mfi(candles, { period: p }),
    runIncremental: (p) => createMfi({ period: p }),
  },
  {
    name: "cci",
    label: "CCI period",
    min: 1,
    run: (p) => cci(candles, { period: p }),
    runIncremental: (p) => createCci({ period: p }),
  },
  {
    name: "standardDeviation",
    label: "Standard Deviation period",
    min: 1,
    run: (p) => standardDeviation(candles, { period: p }),
    runIncremental: (p) => createStandardDeviation({ period: p }),
  },
  {
    name: "ulcerIndex",
    label: "Ulcer Index period",
    min: 1,
    run: (p) => ulcerIndex(candles, { period: p }),
    runIncremental: (p) => createUlcerIndex({ period: p }),
  },
  {
    name: "historicalVolatility",
    label: "Historical Volatility period",
    min: 2,
    run: (p) => historicalVolatility(candles, { period: p }),
    runIncremental: (p) => createHistoricalVolatility({ period: p }),
  },
  {
    name: "donchianChannel",
    label: "Donchian Channel period",
    min: 1,
    run: (p) => donchianChannel(candles, { period: p }),
    runIncremental: (p) => createDonchianChannel({ period: p }),
  },
  {
    name: "williamsR",
    label: "Williams %R period",
    min: 1,
    run: (p) => williamsR(candles, { period: p }),
    runIncremental: (p) => createWilliamsR({ period: p }),
  },
  {
    name: "highestLowest",
    label: "Period",
    min: 1,
    run: (p) => highestLowest(candles, { period: p }),
    runIncremental: (p) => createHighestLowest({ period: p }),
    optionIsRequired: true,
  },
  {
    name: "highest",
    label: "Period",
    min: 1,
    run: (p) => highest(candles, p),
    optionIsRequired: true,
  },
  {
    name: "lowest",
    label: "Period",
    min: 1,
    run: (p) => lowest(candles, p),
    optionIsRequired: true,
  },
  {
    name: "stochastics (kPeriod)",
    label: "kPeriod",
    min: 1,
    run: (p) => stochastics(candles, { kPeriod: p }),
    runIncremental: (p) => createStochastics({ kPeriod: p }),
  },
  {
    name: "stochastics (dPeriod)",
    label: "dPeriod",
    min: 1,
    run: (p) => stochastics(candles, { dPeriod: p }),
    runIncremental: (p) => createStochastics({ dPeriod: p }),
  },
  {
    name: "stochastics (slowing)",
    label: "slowing",
    min: 1,
    run: (p) => stochastics(candles, { slowing: p }),
    runIncremental: (p) => createStochastics({ slowing: p }),
  },
  {
    // No incremental twin exists for volumeMa.
    name: "volumeMa",
    label: "Volume MA period",
    min: 1,
    run: (p) => volumeMa(candles, { period: p }),
    optionIsRequired: true,
  },
  {
    name: "bollingerBands",
    label: "Bollinger Bands period",
    min: 1,
    run: (p) => bollingerBands(candles, { period: p }),
    runIncremental: (p) => createBollingerBands({ period: p }),
  },
  {
    name: "roc",
    label: "ROC period",
    min: 1,
    run: (p) => roc(candles, { period: p }),
    runIncremental: (p) => createRoc({ period: p }),
  },
  {
    name: "aroon",
    label: "Aroon period",
    min: 1,
    run: (p) => aroon(candles, { period: p }),
    runIncremental: (p) => createAroon({ period: p }),
  },
  {
    name: "choppinessIndex",
    label: "Choppiness Index period",
    min: 2,
    run: (p) => choppinessIndex(candles, { period: p }),
    runIncremental: (p) => createChoppinessIndex({ period: p }),
  },
  {
    name: "dpo",
    label: "DPO period",
    min: 1,
    run: (p) => dpo(candles, { period: p }),
    runIncremental: (p) => createDpo({ period: p }),
  },
  {
    name: "cmo",
    label: "CMO period",
    min: 1,
    run: (p) => cmo(candles, { period: p }),
    runIncremental: (p) => createCmo({ period: p }),
  },
];

/**
 * Values with no integer representation. `undefined` is deliberately absent:
 * for every option that declares a default it means "use the default", so it
 * is only invalid for the handful of required options covered separately.
 */
const nonIntegerValues = (min: number): Array<[string, number]> => [
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  [`fractional (${min + 0.5})`, min + 0.5],
  [`fractional (${min + 1.5})`, min + 1.5],
];

/**
 * Values that compare below the minimum. `null` is here because it is what
 * `JSON.stringify` turns `NaN` and `Infinity` into, and it numerically
 * coerces to 0.
 */
const belowMinValues = (min: number): Array<[string, number]> => [
  ["-Infinity", Number.NEGATIVE_INFINITY],
  [`min - 1 (${min - 1})`, min - 1],
  ["0", 0],
  ["-0", -0],
  ["-1", -1],
  ["Number.MIN_VALUE", Number.MIN_VALUE],
  ["null", null as unknown as number],
];

describe("period option validation (batch indicators)", () => {
  for (const target of TARGETS) {
    describe(target.name, () => {
      for (const [name, value] of nonIntegerValues(target.min)) {
        it(`rejects ${name} as a non-integer`, () => {
          expect(() => target.run(value)).toThrow(`${target.label} must be an integer`);
        });
      }

      for (const [name, value] of belowMinValues(target.min)) {
        it(`rejects ${name} as below the minimum`, () => {
          expect(() => target.run(value)).toThrow(`${target.label} must be at least ${target.min}`);
        });
      }

      it("accepts the minimum and the next integer", () => {
        expect(() => target.run(target.min)).not.toThrow();
        expect(() => target.run(target.min + 1)).not.toThrow();
      });

      if (target.optionIsRequired) {
        it("rejects undefined, since this option has no default", () => {
          expect(() => target.run(undefined as unknown as number)).toThrow(
            `${target.label} must be an integer`,
          );
        });
      } else {
        it("treats undefined as a request for the default", () => {
          expect(() => target.run(undefined as unknown as number)).not.toThrow();
        });
      }
    });
  }

  it("accepts a huge integer period (only integrality is validated, not magnitude)", () => {
    expect(() => rsi(candles, { period: Number.MAX_SAFE_INTEGER })).not.toThrow();
    const series = rsi(candles, { period: Number.MAX_SAFE_INTEGER });
    expect(series.every((point) => point.value === null)).toBe(true);
  });
});

/**
 * The remaining batch indicators bounded their bar-count options from below
 * only, so a fractional or non-finite value ran on and either crashed with an
 * unrelated TypeError (`swingPoints({ leftBars: 1.5 })` indexed a fractional
 * offset) or quietly computed a different indicator. Each option here now goes
 * through `assertPeriod`; this table pins the integer half of that check, which
 * is the part that changed.
 */
const INTEGER_ONLY_TARGETS: Array<[fn: string, label: string, run: (period: number) => unknown]> = [
  [
    "adaptiveBollinger",
    "Adaptive Bollinger period",
    (p) => adaptiveBollinger(candles, { period: p }),
  ],
  ["adaptiveMa", "Adaptive MA erPeriod", (p) => adaptiveMa(candles, { erPeriod: p })],
  ["adaptiveRsi", "Adaptive RSI minPeriod", (p) => adaptiveRsi(candles, { minPeriod: p })],
  [
    "adaptiveStochastics",
    "Adaptive Stochastics minPeriod",
    (p) => adaptiveStochastics(candles, { minPeriod: p }),
  ],
  [
    "roofingFilter",
    "Roofing filter highPassPeriod",
    (p) => roofingFilter(candles, { highPassPeriod: p }),
  ],
  [
    "roofingFilter",
    "Roofing filter lowPassPeriod",
    (p) => roofingFilter(candles, { lowPassPeriod: p }),
  ],
  ["superSmoother", "Super Smoother period", (p) => superSmoother(candles, { period: p })],
  ["adxr", "ADXR period", (p) => adxr(candles, { period: p })],
  [
    "awesomeOscillator",
    "Awesome Oscillator fastPeriod",
    (p) => awesomeOscillator(candles, { fastPeriod: p }),
  ],
  [
    "awesomeOscillator",
    "Awesome Oscillator slowPeriod",
    (p) => awesomeOscillator(candles, { slowPeriod: p }),
  ],
  ["balanceOfPower", "BOP smooth period", (p) => balanceOfPower(candles, { smoothPeriod: p })],
  ["coppockCurve", "Coppock Curve wmaPeriod", (p) => coppockCurve(candles, { wmaPeriod: p })],
  [
    "coppockCurve",
    "Coppock Curve longRocPeriod",
    (p) => coppockCurve(candles, { longRocPeriod: p }),
  ],
  [
    "coppockCurve",
    "Coppock Curve shortRocPeriod",
    (p) => coppockCurve(candles, { shortRocPeriod: p }),
  ],
  ["dmi", "DMI period", (p) => dmi(candles, { period: p })],
  ["dmi", "DMI adxPeriod", (p) => dmi(candles, { adxPeriod: p })],
  ["imi", "IMI period", (p) => imi(candles, { period: p })],
  ["macd", "MACD fastPeriod", (p) => macd(candles, { fastPeriod: p })],
  ["macd", "MACD slowPeriod", (p) => macd(candles, { slowPeriod: p })],
  ["macd", "MACD signalPeriod", (p) => macd(candles, { signalPeriod: p })],
  ["massIndex", "Mass Index emaPeriod", (p) => massIndex(candles, { emaPeriod: p })],
  ["massIndex", "Mass Index sumPeriod", (p) => massIndex(candles, { sumPeriod: p })],
  ["ppo", "PPO fastPeriod", (p) => ppo(candles, { fastPeriod: p })],
  ["ppo", "PPO slowPeriod", (p) => ppo(candles, { slowPeriod: p })],
  ["ppo", "PPO signalPeriod", (p) => ppo(candles, { signalPeriod: p })],
  ["qstick", "QStick period", (p) => qstick(candles, { period: p })],
  ["stochRsi", "RSI period", (p) => stochRsi(candles, { rsiPeriod: p })],
  ["stochRsi", "Stoch period", (p) => stochRsi(candles, { stochPeriod: p })],
  ["stochRsi", "K period", (p) => stochRsi(candles, { kPeriod: p })],
  ["stochRsi", "D period", (p) => stochRsi(candles, { dPeriod: p })],
  ["trix", "TRIX period", (p) => trix(candles, { period: p })],
  ["trix", "TRIX signal period", (p) => trix(candles, { signalPeriod: p })],
  ["tsi", "TSI longPeriod", (p) => tsi(candles, { longPeriod: p })],
  ["tsi", "TSI shortPeriod", (p) => tsi(candles, { shortPeriod: p })],
  ["tsi", "TSI signalPeriod", (p) => tsi(candles, { signalPeriod: p })],
  [
    "ultimateOscillator",
    "Ultimate Oscillator period1",
    (p) => ultimateOscillator(candles, { period1: p }),
  ],
  [
    "ultimateOscillator",
    "Ultimate Oscillator period2",
    (p) => ultimateOscillator(candles, { period2: p }),
  ],
  [
    "ultimateOscillator",
    "Ultimate Oscillator period3",
    (p) => ultimateOscillator(candles, { period3: p }),
  ],
  ["breakOfStructure", "swingPeriod", (p) => breakOfStructure(candles, { swingPeriod: p })],
  ["fractals", "Fractals period", (p) => fractals(candles, { period: p })],
  ["returns", "Returns period", (p) => returns(candles, { period: p })],
  ["swingPoints", "leftBars", (p) => swingPoints(candles, { leftBars: p })],
  ["swingPoints", "rightBars", (p) => swingPoints(candles, { rightBars: p })],
  ["liquiditySweep", "swingPeriod", (p) => liquiditySweep(candles, { swingPeriod: p })],
  ["liquiditySweep", "maxRecoveryBars", (p) => liquiditySweep(candles, { maxRecoveryBars: p })],
  ["liquiditySweep", "maxTrackedSweeps", (p) => liquiditySweep(candles, { maxTrackedSweeps: p })],
  ["orderBlock", "swingPeriod", (p) => orderBlock(candles, { swingPeriod: p })],
  ["orderBlock", "volumePeriod", (p) => orderBlock(candles, { volumePeriod: p })],
  ["orderBlock", "maxActiveOBs", (p) => orderBlock(candles, { maxActiveOBs: p })],
  ["orderBlock", "maxBarsActive", (p) => orderBlock(candles, { maxBarsActive: p })],
  ["ichimoku", "Ichimoku tenkanPeriod", (p) => ichimoku(candles, { tenkanPeriod: p })],
  ["ichimoku", "Ichimoku kijunPeriod", (p) => ichimoku(candles, { kijunPeriod: p })],
  ["ichimoku", "Ichimoku senkouBPeriod", (p) => ichimoku(candles, { senkouBPeriod: p })],
  ["ichimoku", "Ichimoku displacement", (p) => ichimoku(candles, { displacement: p })],
  ["linearRegression", "Linear Regression period", (p) => linearRegression(candles, { period: p })],
  [
    "schaffTrendCycle",
    "Schaff Trend Cycle fastPeriod",
    (p) => schaffTrendCycle(candles, { fastPeriod: p }),
  ],
  [
    "schaffTrendCycle",
    "Schaff Trend Cycle slowPeriod",
    (p) => schaffTrendCycle(candles, { slowPeriod: p }),
  ],
  [
    "schaffTrendCycle",
    "Schaff Trend Cycle cyclePeriod",
    (p) => schaffTrendCycle(candles, { cyclePeriod: p }),
  ],
  ["supertrend", "Supertrend period", (p) => supertrend(candles, { period: p })],
  ["vortex", "Vortex period", (p) => vortex(candles, { period: p })],
  ["atrStops", "ATR Stops period", (p) => atrStops(candles, { period: p })],
  ["chandelierExit", "Chandelier Exit period", (p) => chandelierExit(candles, { period: p })],
  ["chandelierExit", "Chandelier Exit lookback", (p) => chandelierExit(candles, { lookback: p })],
  ["garmanKlass", "Garman-Klass period", (p) => garmanKlass(candles, { period: p })],
  [
    "keltnerChannel",
    "Keltner Channel EMA period",
    (p) => keltnerChannel(candles, { emaPeriod: p }),
  ],
  [
    "keltnerChannel",
    "Keltner Channel ATR period",
    (p) => keltnerChannel(candles, { atrPeriod: p }),
  ],
  ["cmf", "CMF period", (p) => cmf(candles, { period: p })],
  ["easeOfMovement", "EMV period", (p) => easeOfMovement(candles, { period: p })],
  [
    "elderForceIndex",
    "Elder Force Index shortPeriod",
    (p) => elderForceIndex(candles, { shortPeriod: p }),
  ],
  [
    "elderForceIndex",
    "Elder Force Index longPeriod",
    (p) => elderForceIndex(candles, { longPeriod: p }),
  ],
  ["klinger", "Klinger shortPeriod", (p) => klinger(candles, { shortPeriod: p })],
  ["klinger", "Klinger longPeriod", (p) => klinger(candles, { longPeriod: p })],
  ["klinger", "Klinger signalPeriod", (p) => klinger(candles, { signalPeriod: p })],
  ["volumeAnomaly", "Volume anomaly period", (p) => volumeAnomaly(candles, { period: p })],
  ["benchmarkRS", "RS period", (p) => benchmarkRS(candles, candles, { period: p })],
  [
    "rankByRS",
    "RS period",
    (p) =>
      rankByRS(
        new Map([
          ["A", candles],
          ["B", candles],
        ]),
        { period: p },
      ),
  ],
];

describe("integer check on the remaining bar-count options", () => {
  for (const [fn, label, run] of INTEGER_ONLY_TARGETS) {
    for (const [name, value] of nonIntegerValues(2)) {
      it(`${fn}: ${label} rejects ${name}`, () => {
        expect(() => run(value)).toThrow(`${label} must be an integer`);
      });
    }
  }
});

/**
 * The incremental twins of the swing-based indicators had the same bound-only
 * guards. `createSwingPoints({ leftBars: 1.5 })` crashed with a RangeError
 * (`Invalid array length`), which the Safe API cannot classify as a bad
 * parameter; the others accepted the value. Both surfaces now share the rule.
 */
const INCREMENTAL_INTEGER_TARGETS: Array<
  [fn: string, label: string, run: (period: number) => unknown]
> = [
  ["createSwingPoints", "leftBars", (p) => createSwingPoints({ leftBars: p })],
  ["createSwingPoints", "rightBars", (p) => createSwingPoints({ rightBars: p })],
  ["createFibonacciRetracement", "leftBars", (p) => createFibonacciRetracement({ leftBars: p })],
  ["createBreakOfStructure", "swingPeriod", (p) => createBreakOfStructure({ swingPeriod: p })],
  ["createLiquiditySweep", "swingPeriod", (p) => createLiquiditySweep({ swingPeriod: p })],
  ["createLiquiditySweep", "maxRecoveryBars", (p) => createLiquiditySweep({ maxRecoveryBars: p })],
  [
    "createLiquiditySweep",
    "maxTrackedSweeps",
    (p) => createLiquiditySweep({ maxTrackedSweeps: p }),
  ],
];

describe("integer check on the incremental swing-based indicators", () => {
  for (const [fn, label, run] of INCREMENTAL_INTEGER_TARGETS) {
    for (const [name, value] of nonIntegerValues(2)) {
      it(`${fn}: ${label} rejects ${name}`, () => {
        expect(() => run(value)).toThrow(`${label} must be an integer`);
      });
    }
  }
});

describe("period validation agrees with the incremental twin", () => {
  const twins = TARGETS.filter((t) => t.runIncremental !== undefined);

  it("covers every target that has an incremental counterpart", () => {
    expect(twins.length).toBe(TARGETS.length - 3); // highest, lowest, volumeMa have none
  });

  for (const target of twins) {
    // The two surfaces word their errors differently (the incremental engine
    // routes through `requireParam`), so only the accept/reject decision is
    // compared — not the message. Lower bounds are excluded because a few
    // pairs legitimately disagree there for unrelated, pre-existing reasons.
    for (const [name, value] of nonIntegerValues(target.min)) {
      it(`${target.name}: both surfaces reject ${name}`, () => {
        expect(() => target.run(value)).toThrow();
        expect(() => target.runIncremental?.(value)).toThrow();
      });
    }

    it(`${target.name}: both surfaces accept a valid period`, () => {
      expect(() => target.run(target.min + 1)).not.toThrow();
      expect(() => target.runIncremental?.(target.min + 1)).not.toThrow();
    });
  }
});

/**
 * The Safe API turns a thrown error into a typed `Result`, so the error *code*
 * is part of its contract. A rejected period is a bad parameter and must
 * classify as INVALID_PARAMETER — not INDICATOR_ERROR, which is for a failure
 * inside the computation. The classifier previously keyed on "must be at
 * least" and friends only, so the "must be an integer" message fell through.
 */
describe("Safe API classifies a rejected period as INVALID_PARAMETER", () => {
  type SafeCall = (period: number) => Result<unknown, TrendCraftError>;

  const SAFE_TARGETS: Array<[string, SafeCall]> = [
    // sma reaches the message through the moving-average family's own guard,
    // which predates the shared validator — it was misclassified too.
    ["smaSafe", (p) => smaSafe(candles, { period: p })],
    ["rsiSafe", (p) => rsiSafe(candles, { period: p })],
    ["atrSafe", (p) => atrSafe(candles, { period: p })],
    ["mfiSafe", (p) => mfiSafe(candles, { period: p })],
    ["cciSafe", (p) => cciSafe(candles, { period: p })],
    ["rocSafe", (p) => rocSafe(candles, { period: p })],
    ["dpoSafe", (p) => dpoSafe(candles, { period: p })],
    ["aroonSafe", (p) => aroonSafe(candles, { period: p })],
    ["williamsRSafe", (p) => williamsRSafe(candles, { period: p })],
    ["donchianChannelSafe", (p) => donchianChannelSafe(candles, { period: p })],
    ["bollingerBandsSafe", (p) => bollingerBandsSafe(candles, { period: p })],
    ["highestLowestSafe", (p) => highestLowestSafe(candles, { period: p })],
    ["stochasticsSafe", (p) => stochasticsSafe(candles, { kPeriod: p })],
    ["volumeMaSafe", (p) => volumeMaSafe(candles, { period: p })],
  ];

  const codeOf = (result: Result<unknown, TrendCraftError>): string =>
    result.ok ? "ok" : result.error.code;

  for (const [name, call] of SAFE_TARGETS) {
    it(`${name}: fractional and NaN periods are INVALID_PARAMETER`, () => {
      expect(codeOf(call(14.5))).toBe("INVALID_PARAMETER");
      expect(codeOf(call(Number.NaN))).toBe("INVALID_PARAMETER");
      expect(codeOf(call(Number.POSITIVE_INFINITY))).toBe("INVALID_PARAMETER");
    });

    it(`${name}: a below-minimum period stays INVALID_PARAMETER`, () => {
      expect(codeOf(call(0))).toBe("INVALID_PARAMETER");
    });

    it(`${name}: a valid period still succeeds`, () => {
      expect(codeOf(call(3))).toBe("ok");
    });
  }
});

/**
 * Structural inventory: which batch indicators bound a period-like option
 * without ever checking that it is an integer.
 *
 * This is a stocktake, not the primary regression guard — the per-indicator
 * behavioural tests above are. Every bounded option is checked now; its job is
 * to fail when a new indicator bounds a period without checking integrality.
 *
 * Matching is per *option*, not per file: an indicator that validates one of
 * its periods and leaves a second one bare is still reported, which a
 * file-level "does this file mention assertPeriod anywhere" check would miss.
 */
describe("period guard inventory", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const indicatorsRoot = path.resolve(here, "..");

  const NAME_PART =
    "[A-Za-z0-9_]*(?:period|Period|lookback|Lookback|bars|Bars|slowing|Slowing)[A-Za-z0-9_]*";

  /** Period-like identifiers this file compares against a numeric literal. */
  const boundedOptions = (text: string): string[] => [
    ...new Set(
      [...text.matchAll(new RegExp(`(${NAME_PART})\\s*(?:<|<=)\\s*[0-9]`, "g"))].map((m) => m[1]),
    ),
  ];

  /** Identifiers this file checks for integrality, by either route. */
  const integerChecked = (text: string): Set<string> =>
    new Set([
      ...[...text.matchAll(/Number\.isInteger\(\s*([A-Za-z0-9_]+)\s*\)/g)].map((m) => m[1]),
      ...[...text.matchAll(/assertPeriod\(\s*"[^"]*"\s*,\s*([A-Za-z0-9_]+)/g)].map((m) => m[1]),
    ]);

  const collect = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        // `incremental` validates through `requireParam`; `safe` wraps other
        // indicators rather than declaring its own periods.
        if (entry === "__tests__" || entry === "incremental" || entry === "safe") continue;
        collect(full, out);
      } else if (entry.endsWith(".ts")) {
        out.push(full);
      }
    }
    return out;
  };

  const unvalidated: Record<string, string[]> = {};
  for (const file of collect(indicatorsRoot)) {
    const text = readFileSync(file, "utf8");
    const bounded = boundedOptions(text);
    if (bounded.length === 0) continue;
    const checked = integerChecked(text);
    const bare = bounded.filter((name) => !checked.has(name)).sort();
    if (bare.length > 0) unvalidated[path.relative(indicatorsRoot, file)] = bare;
  }

  it("finds no bounded period option without an integer check", () => {
    expect(unvalidated).toEqual({});
  });
});
