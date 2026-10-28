import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { createOpeningRange, createTwap } from "../incremental";
import { openingRange } from "../price/opening-range";
import { vwapSafe } from "../safe";
import { volatilityRegime } from "../volatility/regime";
import { marketProfile } from "../volume/market-profile";
import { twap } from "../volume/twap";
import { vwap } from "../volume/vwap";

// A reset option is a keyword or a bar count. An unknown keyword used to
// match neither branch, so the indicator silently never reset and averaged
// across every session in the input.

const HOUR = 3_600_000;
const candles: NormalizedCandle[] = Array.from({ length: 30 }, (_, i) => ({
  time: Date.UTC(2024, 0, 2) + i * HOUR,
  open: 100 + i,
  high: 101 + i,
  low: 99 + i,
  close: 100 + i,
  volume: 1000,
}));

type Call = (value: unknown, data: NormalizedCandle[]) => unknown;

const RESET: [label: string, keywords: string, call: Call][] = [
  ["VWAP resetPeriod", '"session", "rolling"', (v, d) => vwap(d, { resetPeriod: v as "session" })],
  [
    "TWAP sessionResetPeriod",
    '"session"',
    (v, d) => twap(d, { sessionResetPeriod: v as "session" }),
  ],
  [
    "TWAP sessionResetPeriod",
    '"session"',
    (v) => createTwap({ sessionResetPeriod: v as "session" }),
  ],
  [
    "Opening Range sessionResetPeriod",
    '"day"',
    (v, d) => openingRange(d, { sessionResetPeriod: v as "day" }),
  ],
  [
    "Opening Range sessionResetPeriod",
    '"day"',
    (v) => createOpeningRange({ sessionResetPeriod: v as "day" }),
  ],
  [
    "Market Profile sessionResetPeriod",
    '"session"',
    (v, d) => marketProfile(d, { sessionResetPeriod: v as "session" }),
  ],
];

describe("reset option validation", () => {
  for (const [label, keywords, call] of RESET) {
    for (const [v, shown] of [
      ["week", '"week"'],
      ["Session", '"Session"'],
      ["", '""'],
      [null, "null"],
      [true, "true"],
      // These used to print misleadingly or, for BigInt, throw a TypeError
      // from JSON.stringify in place of the validation message.
      [10n, "10n"],
      [Symbol("week"), "Symbol(week)"],
      [new Number(5), "[object Number]"],
      [() => "session", "a function"],
    ] as const) {
      it(`${label} rejects ${shown}`, () => {
        expect(() => call(v, candles)).toThrow(
          `${label} must be one of ${keywords} or a bar count, got ${shown}`,
        );
      });
    }

    it(`${label} rejects an unknown keyword even with no data`, () => {
      expect(() => call("week", [])).toThrow(`${label} must be one of`);
    });

    it(`${label} still rejects a fractional bar count`, () => {
      expect(() => call(2.5, candles)).toThrow(`${label} must be an integer`);
    });

    for (const v of [...keywords.split(", ").map((k) => JSON.parse(k)), 5]) {
      it(`${label} accepts ${JSON.stringify(v)}`, () => {
        expect(() => call(v, candles)).not.toThrow();
      });
    }
  }

  it("Safe API classifies an unknown keyword as INVALID_PARAMETER", () => {
    const result = vwapSafe(candles, { resetPeriod: "week" as "session" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_PARAMETER");
  });

  it("Safe API classifies a BigInt as INVALID_PARAMETER", () => {
    const result = vwapSafe(candles, { resetPeriod: 10n as unknown as "session" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_PARAMETER");
  });

  it("rejects an unknown keyword when resuming from a saved state", () => {
    const twapState = createTwap().getState();
    const orState = createOpeningRange().getState();
    const bad = <T extends { meta: { params: object } }>(s: T): T => ({
      ...s,
      meta: { ...s.meta, params: { ...s.meta.params, sessionResetPeriod: "week" } },
    });
    expect(() => createTwap({}, { fromState: bad(twapState) })).toThrow(
      'TWAP sessionResetPeriod must be one of "session" or a bar count, got "week"',
    );
    expect(() => createOpeningRange({}, { fromState: bad(orState) })).toThrow(
      'Opening Range sessionResetPeriod must be one of "day" or a bar count, got "week"',
    );
  });
});

// These periods used to reach their check only through atr() and
// bollingerBands(), so empty input returned [] for any value, and
// lookbackPeriod, used only by the regime's own helpers, was never checked.
describe("volatilityRegime period validation", () => {
  for (const key of ["atrPeriod", "bbPeriod", "lookbackPeriod"] as const) {
    for (const data of [candles, []]) {
      it(`${key} rejects 2.5 and 0 with ${data.length} candles`, () => {
        expect(() => volatilityRegime(data, { [key]: 2.5 })).toThrow(
          `volatilityRegime ${key} must be an integer`,
        );
        expect(() => volatilityRegime(data, { [key]: 0 })).toThrow(
          `volatilityRegime ${key} must be at least 1`,
        );
      });
    }
  }
});
