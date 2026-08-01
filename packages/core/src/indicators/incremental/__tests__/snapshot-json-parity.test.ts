/**
 * Every incremental indicator must resume the same way from a snapshot object
 * and from that snapshot's JSON.
 *
 * This started as a one-off probe after two indicators were found reviving a
 * poisoned state as plausible numbers. It is a test because the failure is
 * invisible otherwise: the run keeps producing output, it is simply not the
 * output the uninterrupted run produces. Feeding a bad tick is what makes the
 * difference observable, since JSON is only lossy for the values a bad tick
 * creates.
 */
import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import * as incremental from "../index";

/** Only what this harness calls; the registry is heterogeneous by nature. */
type ProbeIndicator = {
  next(candle: NormalizedCandle): { value: unknown };
  getState(): { meta: unknown; state: unknown };
};
type ProbeFactory = (
  options: Record<string, unknown>,
  warmUpOptions?: { fromState?: unknown },
) => ProbeIndicator;

const DAY = 86_400_000;
const START = 1_700_000_000_000;

function candle(i: number, close: number): NormalizedCandle {
  const finite = Number.isFinite(close);
  return {
    time: START + i * DAY,
    open: close,
    high: finite ? close * 1.01 : close,
    low: finite ? close * 0.99 : close,
    close,
    volume: 1000,
  };
}

/** Option bags tried in order; the first one that constructs is used. */
const OPTION_BAGS: Array<Record<string, unknown>> = [
  {},
  { period: 14 },
  { period: 14, signalPeriod: 9 },
  { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  { shortPeriod: 5, longPeriod: 20 },
];

const BAD_TICKS: Array<[string, number]> = [
  ["zero", 0],
  ["negative", -5],
  ["+Infinity", Number.POSITIVE_INFINITY],
  ["-Infinity", Number.NEGATIVE_INFINITY],
  ["NaN", Number.NaN],
];

/** NaN-aware, sign-of-zero-aware structural comparison. */
function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === "number" || typeof b === "number") return Object.is(a, b);
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => sameValue(item, b[i]));
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return Object.is(a, b);
  }
  const aKeys = Object.keys(a as object).sort();
  const bKeys = Object.keys(b as object).sort();
  if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) return false;
  return aKeys.every((k) =>
    sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

function construct(
  factory: ProbeFactory,
): { instance: ProbeIndicator; options: Record<string, unknown> } | null {
  for (const options of OPTION_BAGS) {
    try {
      const instance = factory(options) as Partial<ProbeIndicator> | undefined;
      if (typeof instance?.next === "function" && typeof instance?.getState === "function") {
        return { instance: instance as ProbeIndicator, options };
      }
    } catch {
      // try the next bag
    }
  }
  return null;
}

const factories = Object.entries(incremental)
  .filter(([name, value]) => name.startsWith("create") && typeof value === "function")
  .sort(([a], [b]) => a.localeCompare(b)) as unknown as Array<[string, ProbeFactory]>;

describe("resuming from JSON matches resuming from the object", () => {
  it("covers the whole incremental registry", () => {
    expect(factories.length).toBeGreaterThan(80);
  });

  for (const [name, factory] of factories) {
    it(`${name}`, () => {
      const built = construct(factory);
      if (built === null) return; // needs options this harness does not know

      for (const [label, bad] of BAD_TICKS) {
        for (const snapshotAt of [27, 40]) {
          const candles: NormalizedCandle[] = [];
          for (let i = 0; i < snapshotAt; i++) {
            candles.push(candle(i, i === 25 ? bad : 100 + i * 0.5));
          }

          const live = factory(built.options);
          for (const c of candles) live.next(c);
          const snapshot = live.getState();

          // Resume from the object and from its JSON. Either both work, or
          // both refuse for the same reason — a per-indicator policy is fine,
          // a difference between the two paths is not.
          let fromObject: ProbeIndicator | null = null;
          let objectError: string | null = null;
          try {
            fromObject = factory(built.options, { fromState: snapshot });
          } catch (e) {
            objectError = (e as Error).message;
          }

          let fromJson: ProbeIndicator | null = null;
          let jsonError: string | null = null;
          try {
            fromJson = factory(built.options, {
              fromState: JSON.parse(JSON.stringify(snapshot)),
            });
          } catch (e) {
            jsonError = (e as Error).message;
          }

          const where = `${name} / ${label} / snapshot at ${snapshotAt}`;
          expect({ where, refused: objectError !== null }).toEqual({
            where,
            refused: jsonError !== null,
          });
          if (objectError !== null) {
            expect({ where, message: objectError }).toEqual({ where, message: jsonError });
            continue;
          }

          for (let i = snapshotAt; i < snapshotAt + 5; i++) {
            const c = candle(i, 100 + i * 0.5);
            const expected = live.next(c).value;
            const viaObject = (fromObject as ProbeIndicator).next(c).value;
            const viaJson = (fromJson as ProbeIndicator).next(c).value;
            expect({ where, bar: i, matches: sameValue(viaObject, expected) }).toEqual({
              where,
              bar: i,
              matches: true,
            });
            expect({ where, bar: i, matches: sameValue(viaJson, expected) }).toEqual({
              where,
              bar: i,
              matches: true,
            });
          }
        }
      }
    });
  }
});
