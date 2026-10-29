import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { superSmoother } from "../filter/super-smoother";
import {
  createCci,
  createDonchianChannel,
  createHighestLowest,
  createRoc,
  createStandardDeviation,
  createSuperSmoother,
  createWilliamsR,
} from "../incremental";
import { cci } from "../momentum/cci";
import { roc } from "../momentum/roc";
import { williamsR } from "../momentum/williams-r";
import { highestLowest } from "../price/highest-lowest";
import { donchianChannel } from "../volatility/donchian-channel";
import { standardDeviation } from "../volatility/standard-deviation";

const candles: NormalizedCandle[] = Array.from({ length: 80 }, (_, i) => {
  const close = 100 + Math.sin(i / 4) * 5 + i * 0.1;
  return {
    time: Date.UTC(2024, 0, 1) + i * 86_400_000,
    open: close - 0.5,
    high: close + 1 + (i % 3) * 0.2,
    low: close - 1 - (i % 2) * 0.3,
    close,
    volume: 1000 + i,
  };
});

type Stream = { next(c: NormalizedCandle): { value: unknown } };
const stream = (indicator: Stream) => candles.map((c) => indicator.next(c).value);
const values = (series: { value: unknown }[]) => series.map((p) => p.value);

/**
 * Batch and incremental agree on whether `period` has a default, and on its
 * value. Each pair is called with no period on both sides.
 */
describe("default period parity between batch and incremental", () => {
  it.each([
    [
      "donchianChannel (20)",
      () => values(donchianChannel(candles)),
      () => stream(createDonchianChannel()),
    ],
    ["cci (20)", () => values(cci(candles)), () => stream(createCci())],
    ["roc (12)", () => values(roc(candles)), () => stream(createRoc())],
    [
      "standardDeviation (20)",
      () => values(standardDeviation(candles)),
      () => stream(createStandardDeviation()),
    ],
    ["williamsR (14)", () => values(williamsR(candles)), () => stream(createWilliamsR())],
    [
      "superSmoother (10)",
      () => values(superSmoother(candles)),
      () => stream(createSuperSmoother()),
    ],
  ])("%s: both sides default to the same period", (_name, batch, incremental) => {
    const b = batch();
    const inc = incremental();
    expect(inc).toHaveLength(b.length);
    inc.forEach((v, i) => {
      if (typeof v === "number" && typeof b[i] === "number") {
        expect(v).toBeCloseTo(b[i] as number, 8);
      } else {
        expect(v).toEqual(b[i]);
      }
    });
  });

  it("highestLowest requires period on both sides", () => {
    // @ts-expect-error period is required in the batch options
    expect(() => highestLowest(candles, {})).toThrow();
    // @ts-expect-error period is required for a new indicator (JavaScript callers get the runtime error)
    expect(() => createHighestLowest()).toThrow(/required option "period"/);
    // @ts-expect-error likewise with an options object that leaves it out
    expect(() => createHighestLowest({})).toThrow(/required option "period"/);
    expect(() => createHighestLowest({ period: 20 })).not.toThrow();
    // A resume takes period from the snapshot, so it may be left out
    const saved = createHighestLowest({ period: 20 }).getState();
    expect(() => createHighestLowest({}, { fromState: saved })).not.toThrow();
  });
});
