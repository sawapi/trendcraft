/**
 * Snapshot sentinels have to survive being persisted.
 *
 * Both indicators here mark "this bar produced no usable value" inside their
 * window buffer. The marker used to be `NaN`, which `JSON.stringify` writes as
 * `null` — so a snapshot that went to disk and came back had ordinary null
 * slots where the resume path was looking for NaN. The resumed indicator then
 * reported a number on bars where an uninterrupted run reported nothing,
 * which is the worst shape for this failure: no error, no gap, just a
 * confident wrong value.
 *
 * The state-contract suite passed snapshots by reference, so it never saw any
 * of this; it now round-trips every snapshot through JSON.
 */
import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { createGarmanKlass } from "../volatility/garman-klass";
import { createEmv } from "../volume/ease-of-movement";

const DAY = 86_400_000;
const START = 1_700_000_000_000;

/** Persist a snapshot the way a caller would. */
function throughJson<T>(snapshot: T): T {
  return JSON.parse(JSON.stringify(snapshot)) as T;
}

function candle(i: number, close: number, opts: Partial<NormalizedCandle> = {}): NormalizedCandle {
  return {
    time: START + i * DAY,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
    ...opts,
  };
}

/**
 * A stream with one bar the given estimator cannot use. What makes a bar
 * unusable differs by estimator — ease-of-movement needs a range and some
 * volume, Garman-Klass needs strictly positive prices — so the fixture takes
 * the marker-triggering shape rather than assuming one serves both.
 */
function streamWithUnusableBar(
  length: number,
  flatIndex: number,
  unusable: (close: number) => Partial<NormalizedCandle>,
): NormalizedCandle[] {
  return Array.from({ length }, (_, i) => {
    const close = 100 + Math.sin(i / 3) * 5;
    return i === flatIndex ? candle(i, close, unusable(close)) : candle(i, close);
  });
}

/** No range and no volume: ease-of-movement's box ratio is undefined. */
const NO_RANGE_NO_VOLUME = (close: number) => ({ high: close, low: close, volume: 0 });

/** A non-positive low: Garman-Klass's log terms are undefined. */
const NON_POSITIVE_LOW = () => ({ low: 0 });

/** Values from an uninterrupted run, and from one resumed at `splitIdx`. */
function twinAndResumed<T>(
  create: (fromState?: unknown) => { next(c: NormalizedCandle): { value: T }; getState(): unknown },
  candles: NormalizedCandle[],
  splitIdx: number,
): { twin: T[]; resumed: T[] } {
  const uninterrupted = create();
  const twin = candles.map((c) => uninterrupted.next(c).value);

  const first = create();
  for (let i = 0; i < splitIdx; i++) first.next(candles[i]);
  const second = create(throughJson(first.getState()));
  const resumed = candles.slice(splitIdx).map((c) => second.next(c).value);

  return { twin: twin.slice(splitIdx), resumed };
}

describe("easeOfMovement keeps its null-slot marker across a persisted snapshot", () => {
  const candles = streamWithUnusableBar(40, 18, NO_RANGE_NO_VOLUME);
  const period = 14;

  it("emits null on the same bars as an uninterrupted run", () => {
    const { twin, resumed } = twinAndResumed<number | null>(
      (fromState) =>
        createEmv({ period }, fromState ? { fromState: fromState as never } : undefined),
      candles,
      20,
    );

    // The unusable bar sits inside the resumed window, so both runs must
    // withhold output until it leaves. Before, the resumed one produced
    // numbers there.
    expect(resumed.filter((v) => v === null).length).toBeGreaterThan(0);
    expect(resumed).toEqual(twin);
  });

  it("does not report itself warmed up while an unusable bar is in the window", () => {
    const first = createEmv({ period });
    for (let i = 0; i < 20; i++) first.next(candles[i]);
    const resumed = createEmv({}, { fromState: throughJson(first.getState()) });

    expect(resumed.isWarmedUp).toBe(false);
  });
});

describe("garmanKlass keeps its invalid-candle marker across a persisted snapshot", () => {
  const candles = streamWithUnusableBar(40, 18, NON_POSITIVE_LOW);
  const period = 10;

  it("emits null on the same bars as an uninterrupted run", () => {
    const { twin, resumed } = twinAndResumed<number | null>(
      (fromState) =>
        createGarmanKlass({ period }, fromState ? { fromState: fromState as never } : undefined),
      candles,
      20,
    );

    expect(resumed.filter((v) => v === null).length).toBeGreaterThan(0);
    expect(resumed).toEqual(twin);
  });
});
