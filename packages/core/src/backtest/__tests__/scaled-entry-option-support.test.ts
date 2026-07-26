import { describe, expect, it } from "vitest";
import type { NormalizedCandle, PresetCondition } from "../../types";
import type { MtfBacktestOptions } from "../engine";
import type { ScaledBacktestOptions } from "../scaled-entry";
import { runBacktestScaled } from "../scaled-entry";

/**
 * Options the multi-tranche path of `runBacktestScaled` implements.
 *
 * Classified against `MtfBacktestOptions` rather than `BacktestOptions`:
 * `fundamentals` and `validateData` live only on the former, and a run that
 * silently drops them is exactly the failure this file guards against.
 */
const IMPLEMENTED_OPTIONS = [
  "capital",
  "commission",
  "commissionRate",
  "slippage",
  "stopLoss",
  "takeProfit",
  "trailingStop",
  "partialTakeProfit",
  "taxRate",
  "fillMode",
  "slTpMode",
  "benchmark",
  "mtfTimeframes",
  "atrRisk",
] as const satisfies readonly (keyof MtfBacktestOptions)[];

/**
 * Options the multi-tranche path does not implement and therefore rejects.
 * Mirrors the list inside `scaled-entry.ts`: this table is the specification,
 * so moving an option between the two lists here is a deliberate act.
 */
const UNSUPPORTED_OPTIONS = [
  "direction",
  "atrTrailingStop",
  "breakevenStop",
  "scaleOut",
  "timeExit",
  "slippageModel",
  "orderType",
  "orderTTL",
  "timeInForce",
  "volumeConstraint",
  "margin",
  "sizing",
  "fundamentals",
  "validateData",
] as const satisfies readonly (keyof MtfBacktestOptions)[];

/**
 * Compile-time exhaustiveness guard: every option `runBacktest` accepts must
 * appear in exactly one of the two tables above. Adding one without deciding
 * whether the multi-tranche engine honors it fails the type check here rather
 * than silently escaping both the runtime rejection and this test file.
 *
 * "Exactly one" needs both directions — an option listed twice would otherwise
 * satisfy the exhaustiveness check while claiming to be both honored and
 * rejected.
 */
type AssertNever<T extends never> = T;

type UnclassifiedOption = Exclude<
  keyof MtfBacktestOptions,
  (typeof IMPLEMENTED_OPTIONS)[number] | (typeof UNSUPPORTED_OPTIONS)[number]
>;
type _EveryBacktestOptionIsClassified = AssertNever<UnclassifiedOption>;

type DoublyClassifiedOption = Extract<
  (typeof IMPLEMENTED_OPTIONS)[number],
  (typeof UNSUPPORTED_OPTIONS)[number]
>;
type _NoBacktestOptionIsClassifiedTwice = AssertNever<DoublyClassifiedOption>;

/**
 * A realistic value for each unsupported option. Typed against
 * `MtfBacktestOptions` so the compiler — not the author — guarantees these are
 * well-formed configs and not shapes that would be rejected for being invalid.
 */
const SAMPLE_UNSUPPORTED_VALUES: Required<
  Pick<MtfBacktestOptions, (typeof UNSUPPORTED_OPTIONS)[number]>
> = {
  direction: "short",
  atrTrailingStop: { multiplier: 2 },
  breakevenStop: { threshold: 5 },
  scaleOut: { levels: [{ threshold: 5, sellPercent: 50 }] },
  timeExit: { maxHoldDays: 10 },
  slippageModel: { type: "fixed", percent: 0.1 },
  orderType: { type: "market" },
  orderTTL: 5,
  timeInForce: "day",
  volumeConstraint: { maxVolumePercent: 10 },
  margin: { leverage: 2, maintenanceMargin: 0.25, marginCallAction: "liquidate" },
  sizing: { method: "fixed-fractional", fractionPercent: 50 },
  fundamentals: [{ time: Date.UTC(2024, 0, 1), per: 15, pbr: 1.2 }],
  validateData: true,
};

const DAY = 24 * 60 * 60 * 1000;

function candles(count: number): NormalizedCandle[] {
  const baseTime = Date.UTC(2024, 0, 1);

  return Array.from({ length: count }, (_, i) => {
    const price = 100 + i;
    return {
      time: baseTime + i * DAY,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000,
    };
  });
}

const enterAt1: PresetCondition = {
  type: "preset",
  name: "enterAt1",
  evaluate: (_indicators, _candle, index) => index === 1,
};

const neverExit: PresetCondition = {
  type: "preset",
  name: "neverExit",
  evaluate: () => false,
};

function runWith(extra: Record<string, unknown>, tranches = 2) {
  return runBacktestScaled(candles(30), enterAt1, neverExit, {
    capital: 100000,
    scaledEntry: { tranches, strategy: "equal", intervalType: "signal" },
    ...extra,
  } as ScaledBacktestOptions);
}

describe("runBacktestScaled option support", () => {
  describe("options the multi-tranche path does not implement", () => {
    for (const key of UNSUPPORTED_OPTIONS) {
      it(`rejects ${key} instead of ignoring it`, () => {
        expect(() => runWith({ [key]: SAMPLE_UNSUPPORTED_VALUES[key] })).toThrow(
          new RegExp(`does not implement.*\\b${key}\\b`),
        );
      });
    }

    it("names every offending option in one message", () => {
      expect(() =>
        runWith({
          direction: SAMPLE_UNSUPPORTED_VALUES.direction,
          margin: SAMPLE_UNSUPPORTED_VALUES.margin,
          sizing: SAMPLE_UNSUPPORTED_VALUES.sizing,
        }),
      ).toThrow(/does not implement direction, margin, sizing\b/);
    });

    it("ignores keys that are present but undefined", () => {
      expect(() => runWith({ direction: undefined, margin: undefined })).not.toThrow();
    });
  });

  describe("options the multi-tranche path implements", () => {
    for (const key of IMPLEMENTED_OPTIONS) {
      it(`accepts ${key}`, () => {
        // `capital` is already set by the base options; the rest only need to
        // be present, since the assertion here is that they are not rejected.
        expect(() => runWith({ [key]: key === "capital" ? 100000 : undefined })).not.toThrow();
      });
    }
  });

  describe("single-tranche runs are unaffected", () => {
    it("honors an unsupported option when tranches is 1", () => {
      // With one tranche the run is delegated to runBacktest, which implements
      // every option — so rejecting there would break working callers.
      const short = runWith({ direction: "short" }, 1);
      const long = runWith({}, 1);

      expect(short.tradeCount).toBe(1);
      expect(long.tradeCount).toBe(1);
      // Prices rise over the window, so the two directions cannot agree.
      expect(short.totalReturnPercent).not.toBeCloseTo(long.totalReturnPercent, 6);
    });

    it("rejects the same option once tranches reaches 2", () => {
      expect(() => runWith({ direction: "short" }, 2)).toThrow(/does not implement direction/);
    });

    it("still validates data when asked to, unlike the multi-tranche path", () => {
      const broken = candles(30);
      // high < low: the validator's OHLC consistency check must reject this.
      broken[10] = { ...broken[10], high: 50, low: 200 };

      // Annotated rather than cast: `validateData` has to actually be part of
      // ScaledBacktestOptions for this to compile.
      const options: ScaledBacktestOptions = {
        capital: 100000,
        validateData: true,
        scaledEntry: { tranches: 1, strategy: "equal", intervalType: "signal" },
      };

      expect(() => runBacktestScaled(broken, enterAt1, neverExit, options)).toThrow(
        /Data validation failed/,
      );
    });
  });

  describe("type surface", () => {
    it("accepts every rejectable option at the type level, because one tranche honors them", () => {
      // The rejection depends on scaledEntry.tranches, a value rather than a
      // type. Omitting these keys from ScaledBacktestOptions would forbid them
      // for the single-tranche calls that do support them — this compiles, and
      // must keep compiling, for the documented workaround to be usable from
      // TypeScript. Every key the runtime check can reject is spread in, so a
      // key missing from the type fails the build rather than this assertion.
      const options: ScaledBacktestOptions = {
        capital: 100000,
        ...SAMPLE_UNSUPPORTED_VALUES,
        scaledEntry: { tranches: 1, strategy: "equal", intervalType: "signal" },
      };

      expect(options.direction).toBe("short");
      expect(options.fundamentals).toHaveLength(1);
      expect(options.validateData).toBe(true);
    });
  });
});
