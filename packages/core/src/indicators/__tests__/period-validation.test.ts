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
import {
  createAroon,
  createAtr,
  createBollingerBands,
  createCci,
  createChoppinessIndex,
  createCmo,
  createDonchianChannel,
  createDpo,
  createHighestLowest,
  createHistoricalVolatility,
  createMfi,
  createRoc,
  createRsi,
  createStandardDeviation,
  createStochastics,
  createUlcerIndex,
  createWilliamsR,
} from "../incremental";
import { aroon } from "../momentum/aroon";
import { cci } from "../momentum/cci";
import { cmo } from "../momentum/cmo";
import { dpo } from "../momentum/dpo";
import { roc } from "../momentum/roc";
import { rsi } from "../momentum/rsi";
import { stochastics } from "../momentum/stochastics";
import { williamsR } from "../momentum/williams-r";
import { highest, highestLowest, lowest } from "../price/highest-lowest";
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
import { atr } from "../volatility/atr";
import { bollingerBands } from "../volatility/bollinger-bands";
import { choppinessIndex } from "../volatility/choppiness-index";
import { donchianChannel } from "../volatility/donchian-channel";
import { historicalVolatility } from "../volatility/historical-volatility";
import { standardDeviation } from "../volatility/standard-deviation";
import { ulcerIndex } from "../volatility/ulcer-index";
import { mfi } from "../volume/mfi";
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
 * behavioural tests above are. Its job is to keep the remaining population
 * visible and to fail when a new indicator quietly joins it.
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

  /** Files whose period options this change routes through `assertPeriod`. */
  const FIXED_HERE = [
    "momentum/aroon.ts",
    "momentum/cci.ts",
    "momentum/cmo.ts",
    "momentum/dpo.ts",
    "momentum/roc.ts",
    "momentum/rsi.ts",
    "momentum/stochastics.ts",
    "momentum/williams-r.ts",
    "price/highest-lowest.ts",
    "volatility/atr.ts",
    "volatility/bollinger-bands.ts",
    "volatility/choppiness-index.ts",
    "volatility/donchian-channel.ts",
    "volatility/historical-volatility.ts",
    "volatility/standard-deviation.ts",
    "volatility/ulcer-index.ts",
    "volume/mfi.ts",
    "volume/volume-ma.ts",
  ];

  /**
   * Bounded-but-unchecked period options, as `file -> option names`.
   * Shrinking this map is the remaining work; it must never grow.
   */
  const KNOWN_UNVALIDATED: Record<string, string[]> = {
    "adaptive/adaptive-bollinger.ts": ["period"],
    "adaptive/adaptive-ma.ts": ["erPeriod"],
    "adaptive/adaptive-rsi.ts": ["minPeriod"],
    "adaptive/adaptive-stochastics.ts": ["minPeriod"],
    "filter/roofing-filter.ts": ["highPassPeriod", "lowPassPeriod"],
    "filter/super-smoother.ts": ["period"],
    "momentum/adxr.ts": ["period"],
    "momentum/awesome-oscillator.ts": ["fastPeriod", "slowPeriod"],
    "momentum/balance-of-power.ts": ["smoothPeriod"],
    "momentum/coppock-curve.ts": ["longRocPeriod", "shortRocPeriod", "wmaPeriod"],
    "momentum/dmi.ts": ["adxPeriod", "period"],
    "momentum/imi.ts": ["period"],
    "momentum/macd.ts": ["fastPeriod", "signalPeriod", "slowPeriod"],
    "momentum/mass-index.ts": ["emaPeriod", "sumPeriod"],
    "momentum/ppo.ts": ["fastPeriod", "signalPeriod", "slowPeriod"],
    "momentum/qstick.ts": ["period"],
    "momentum/stoch-rsi.ts": ["dPeriod", "kPeriod", "rsiPeriod", "stochPeriod"],
    "momentum/trix.ts": ["period", "signalPeriod"],
    "momentum/tsi.ts": ["longPeriod", "shortPeriod", "signalPeriod"],
    "momentum/ultimate-oscillator.ts": ["period1", "period2", "period3"],
    "price/break-of-structure.ts": ["swingPeriod"],
    "price/fractals.ts": ["period"],
    "price/returns.ts": ["period"],
    "price/swing-points.ts": ["leftBars", "rightBars"],
    "relative-strength/benchmark-rs.ts": ["period"],
    "relative-strength/multi-rs.ts": ["period"],
    "smc/liquidity-sweep.ts": ["maxRecoveryBars", "swingPeriod"],
    "smc/order-block.ts": ["maxBarsActive", "swingPeriod", "volumePeriod"],
    "trend/ichimoku.ts": ["kijunPeriod", "senkouBPeriod", "tenkanPeriod"],
    "trend/linear-regression.ts": ["period"],
    "trend/schaff-trend-cycle.ts": ["cyclePeriod", "fastPeriod", "slowPeriod"],
    "trend/supertrend.ts": ["period"],
    "trend/vortex.ts": ["period"],
    "volatility/atr-stops.ts": ["period"],
    "volatility/chandelier-exit.ts": ["hlLookback", "period"],
    "volatility/garman-klass.ts": ["period"],
    "volatility/keltner-channel.ts": ["atrPeriod", "emaPeriod"],
    "volume/cmf.ts": ["period"],
    "volume/ease-of-movement.ts": ["period"],
    "volume/elder-force-index.ts": ["longPeriod", "shortPeriod"],
    "volume/klinger.ts": ["longPeriod", "shortPeriod", "signalPeriod"],
    "volume/volume-anomaly.ts": ["period"],
  };

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

  it("reports exactly the pinned bounded-but-unchecked options", () => {
    expect(unvalidated).toEqual(KNOWN_UNVALIDATED);
  });

  it("reports none of the options fixed here", () => {
    const regressed = FIXED_HERE.filter((file) => unvalidated[file] !== undefined);
    expect(regressed).toEqual([]);
  });
});
