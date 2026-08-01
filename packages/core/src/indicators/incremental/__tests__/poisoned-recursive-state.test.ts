/**
 * A recursive accumulator that has gone non-finite must not come back from
 * JSON as a plausible number.
 *
 * A bad tick — a zero price, a negative one — can push a recursive indicator's
 * running value to `Infinity` or `NaN`. While the indicator keeps running that
 * is obvious: the output is non-finite too. It does not survive persistence,
 * though. `JSON.stringify` writes both as `null`, and arithmetic on the
 * revived `null` coerces it to 0, so the resumed indicator emits numbers that
 * look like data while its uninterrupted twin emits nothing usable.
 *
 * Resuming from such a snapshot is now refused. The companion fix is to stop
 * producing the non-finite value in the first place where the batch indicator
 * already does — see the Ewma section below.
 */
import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { logReturnOrZero } from "../../../utils/statistics";
import { ewmaVolatilityFromCandles } from "../../volatility/garch";
import { createMcGinleyDynamic } from "../moving-average/mcginley-dynamic";
import { deserializeIndicatorSnapshot } from "../state-contract";
import { createEwmaVolatility } from "../volatility/ewma-volatility";

const DAY = 86_400_000;
const START = 1_700_000_000_000;

function candle(i: number, close: number): NormalizedCandle {
  return {
    time: START + i * DAY,
    open: close,
    high: close + 1,
    low: Math.max(0, close - 1),
    close,
    volume: 1000,
  };
}

/** Persist a snapshot the way a caller would. */
function throughJson<T>(snapshot: T): T {
  return JSON.parse(JSON.stringify(snapshot)) as T;
}

/** A rising series with one zero-price tick at `badIdx`. */
function seriesWithBadTick(length: number, badIdx: number): NormalizedCandle[] {
  const out: NormalizedCandle[] = [];
  for (let i = 0; i < length; i++) {
    out.push(candle(i, i === badIdx ? 0 : 100 + i * 0.5));
  }
  return out;
}

describe("logReturnOrZero — the rule both forms share", () => {
  it("returns a finite number for every pair of prices", () => {
    const MIN = Number.MIN_VALUE;
    const MAX = Number.MAX_VALUE;
    const prices = [
      0,
      -1,
      MIN,
      1e-300,
      0.5,
      100,
      1e300,
      MAX,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
    ];
    for (const previous of prices) {
      for (const current of prices) {
        const value = logReturnOrZero(previous, current);
        expect({ previous, current, finite: Number.isFinite(value) }).toEqual({
          previous,
          current,
          finite: true,
        });
      }
    }
  });

  it("returns 0 when the ratio itself overflows or flushes to zero", () => {
    // Both prices are usable; their quotient is not.
    expect(Number.MAX_VALUE / Number.MIN_VALUE).toBe(Number.POSITIVE_INFINITY);
    expect(Number.MIN_VALUE / Number.MAX_VALUE).toBe(0);
    expect(logReturnOrZero(Number.MIN_VALUE, Number.MAX_VALUE)).toBe(0);
    expect(logReturnOrZero(Number.MAX_VALUE, Number.MIN_VALUE)).toBe(0);
  });

  it("still computes ordinary returns", () => {
    expect(logReturnOrZero(100, 101)).toBeCloseTo(Math.log(1.01), 15);
    expect(logReturnOrZero(101, 100)).toBeCloseTo(-Math.log(1.01), 15);
    expect(logReturnOrZero(100, 100)).toBe(0);
  });
});

describe("McGinley Dynamic — poisoned state is refused on resume", () => {
  const period = 14;

  it("refuses a snapshot whose running value went non-finite", () => {
    const candles = seriesWithBadTick(32, 30);
    const live = createMcGinleyDynamic({ period });
    for (const c of candles) live.next(c);

    // The uninterrupted run is visibly broken, which is the point: the value
    // is non-finite rather than a number a caller might trust.
    const uninterrupted = live.next(candle(32, 116)).value;
    expect(Number.isFinite(uninterrupted)).toBe(false);

    // The snapshot carries the non-finite value through JSON now, so the
    // resumed run is refused for the same reason the in-memory one is —
    // refusing is McGinley's own policy, not an artefact of the transport.
    const text = JSON.stringify(live.getState());
    const persisted = JSON.parse(text) as ReturnType<typeof live.getState>;
    const decoded = deserializeIndicatorSnapshot<{ prevMd: number }>(text);
    expect(Number.isNaN(decoded.state.prevMd)).toBe(true);

    expect(() => createMcGinleyDynamic({ period }, { fromState: persisted })).toThrow(
      /re-warm required.*prevMd/s,
    );
    expect(() => createMcGinleyDynamic({ period }, { fromState: live.getState() })).toThrow(
      /re-warm required.*prevMd/s,
    );
  });

  it("refuses a snapshot whose warm-up total went non-finite", () => {
    // Before warm-up completes the recursive state is `sum`, not `prevMd`.
    // An infinite price makes it infinite, JSON makes that null, and
    // `null + price` is a number — so the resumed run seeds its average from
    // a total that lost every bar before the bad tick.
    const live = createMcGinleyDynamic({ period });
    for (let i = 0; i < 5; i++) live.next(candle(i, 100 + i));
    live.next({ ...candle(5, 100), close: Number.POSITIVE_INFINITY });
    for (let i = 6; i < 10; i++) live.next(candle(i, 100 + i));

    const text = JSON.stringify(live.getState());
    const persisted = JSON.parse(text) as ReturnType<typeof live.getState>;
    const decoded = deserializeIndicatorSnapshot<{ sum: number; count: number }>(text);
    expect(decoded.state.sum).toBe(Number.POSITIVE_INFINITY);
    expect(decoded.state.count).toBe(10);

    expect(() => createMcGinleyDynamic({ period }, { fromState: persisted })).toThrow(
      /re-warm required.*sum/s,
    );
  });

  it("resumes a healthy snapshot, before and after warm-up", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 40; i++) candles.push(candle(i, 100 + i * 0.5));

    // Mid warm-up: prevMd is legitimately null and must not be mistaken for
    // a serialized non-finite value.
    const early = createMcGinleyDynamic({ period });
    for (let i = 0; i < period - 1; i++) early.next(candles[i]);
    const earlySnapshot = throughJson(early.getState());
    expect(earlySnapshot.state.prevMd).toBeNull();
    const earlyResumed = createMcGinleyDynamic({ period }, { fromState: earlySnapshot });

    // Warmed up: resume and continue in step with the uninterrupted run.
    const live = createMcGinleyDynamic({ period });
    for (let i = 0; i < 30; i++) live.next(candles[i]);
    const resumed = createMcGinleyDynamic({ period }, { fromState: throughJson(live.getState()) });
    for (let i = 30; i < candles.length; i++) {
      expect(resumed.next(candles[i]).value).toBe(live.next(candles[i]).value);
    }
    expect(earlyResumed.next(candles[period - 1]).value).not.toBeNull();
  });
});

describe("EWMA volatility — a bad tick no longer poisons the recursion", () => {
  const options = { lambda: 0.94, seedSize: 10 };

  it("keeps emitting finite volatility across a zero-price tick", () => {
    const candles = seriesWithBadTick(40, 30);
    const live = createEwmaVolatility(options);
    const values = candles.map((c) => live.next(c).value);

    const emitted = values.slice(options.seedSize).filter((v): v is number => v !== null);
    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("matches the batch indicator bar for bar across that tick", () => {
    const candles = seriesWithBadTick(40, 30);
    const live = createEwmaVolatility(options);
    const liveValues = candles.map((c) => live.next(c).value);

    // Batch emits one entry per return, at candles[i + 1].time.
    const batch = ewmaVolatilityFromCandles(candles, { lambda: options.lambda });
    const batchByTime = new Map(batch.map((p) => [p.time, p.value]));

    // Batch seeds from the first `seedSize` returns with lookahead, so it has
    // values where the live indicator is still gated to null. Compare from the
    // bar the live one starts emitting.
    let compared = 0;
    for (let i = options.seedSize; i < candles.length; i++) {
      const expected = batchByTime.get(candles[i].time);
      expect(liveValues[i]).toBeCloseTo(expected as number, 10);
      compared++;
    }
    expect(compared).toBe(candles.length - options.seedSize);
  });

  it("survives an infinite price, in step with the batch indicator", () => {
    // `Infinity > 0` is true, so a "price is positive" test lets an infinite
    // tick through and `ln(Infinity / price)` poisons the recursion. Both
    // implementations require a usable price, not merely a positive one.
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 30; i++) candles.push(candle(i, 100 + i * 0.5));
    candles[20] = { ...candles[20], close: Number.POSITIVE_INFINITY };

    const live = createEwmaVolatility(options);
    const liveValues = candles.map((c) => live.next(c).value);
    const emitted = liveValues.slice(options.seedSize).filter((v): v is number => v !== null);
    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted.every((v) => Number.isFinite(v))).toBe(true);

    const batchByTime = new Map(
      ewmaVolatilityFromCandles(candles, { lambda: options.lambda }).map((p) => [p.time, p.value]),
    );
    for (let i = options.seedSize; i < candles.length; i++) {
      expect(liveValues[i]).toBeCloseTo(batchByTime.get(candles[i].time) as number, 10);
    }
  });

  it("survives a price jump whose ratio overflows", () => {
    // Neither price is rejected on its own — the quotient is what breaks.
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 30; i++) candles.push(candle(i, 100 + i * 0.5));
    candles[20] = { ...candles[20], close: Number.MIN_VALUE };
    candles[21] = { ...candles[21], close: Number.MAX_VALUE };

    const live = createEwmaVolatility(options);
    const liveValues = candles.map((c) => live.next(c).value);
    const emitted = liveValues.slice(options.seedSize).filter((v): v is number => v !== null);
    expect(emitted.every((v) => Number.isFinite(v))).toBe(true);
    expect(Number.isFinite(live.getState().state.prevVariance as number)).toBe(true);

    const batchByTime = new Map(
      ewmaVolatilityFromCandles(candles, { lambda: options.lambda }).map((p) => [p.time, p.value]),
    );
    for (let i = options.seedSize; i < candles.length; i++) {
      // A return of ln(MIN_VALUE / 100) is around -700, so the volatility here
      // runs to six figures: compare relatively, not to a fixed decimal place.
      const expected = batchByTime.get(candles[i].time) as number;
      const relative = Math.abs((liveValues[i] as number) - expected) / Math.abs(expected);
      expect({ bar: i, withinTolerance: relative < 1e-12 }).toEqual({
        bar: i,
        withinTolerance: true,
      });
    }
  });

  it("stays resumable when the snapshot is taken right after a bad tick", () => {
    // Tolerating a bad tick has to hold across persistence too: the price is
    // not carried into the state as `Infinity`, which JSON would turn into a
    // null the resumed run reads as "no candle seen yet".
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 20; i++) candles.push(candle(i, 100 + i * 0.5));
    candles[19] = { ...candles[19], close: Number.POSITIVE_INFINITY };

    const live = createEwmaVolatility(options);
    for (const c of candles) live.next(c);

    const persisted = throughJson(live.getState());
    expect(persisted.state.prevPrice).toBe(0);
    expect(persisted.state.count).toBe(candles.length);

    const resumed = createEwmaVolatility(options, { fromState: persisted });
    const rest: NormalizedCandle[] = [];
    for (let i = 20; i < 30; i++) rest.push(candle(i, 100 + i * 0.5));
    for (const c of rest) {
      const fromResumed = resumed.next(c).value;
      const uninterrupted = live.next(c).value;
      expect({ time: c.time, value: fromResumed }).toEqual({
        time: c.time,
        value: uninterrupted,
      });
      expect(Number.isFinite(fromResumed as number)).toBe(true);
    }

    // And both agree with the batch indicator over the whole series.
    const all = [...candles, ...rest];
    const batchByTime = new Map(
      ewmaVolatilityFromCandles(all, { lambda: options.lambda }).map((p) => [p.time, p.value]),
    );
    const fresh = createEwmaVolatility(options);
    for (let i = 0; i < all.length; i++) {
      const value = fresh.next(all[i]).value;
      if (i >= options.seedSize) {
        expect(value).toBeCloseTo(batchByTime.get(all[i].time) as number, 10);
      }
    }
  });

  it("refuses a snapshot from a version that stored the bad tick itself", () => {
    // Nothing this version writes can produce it, but a snapshot from before
    // the normalization can: `prevPrice` came back as null with candles
    // already consumed, which would silently drop the next bar's return.
    const live = createEwmaVolatility(options);
    for (let i = 0; i < 20; i++) live.next(candle(i, 100 + i * 0.5));
    const healthy = throughJson(live.getState());
    const legacy = { ...healthy, state: { ...healthy.state, prevPrice: null } };

    expect(() => createEwmaVolatility(options, { fromState: legacy })).toThrow(
      /re-warm required.*prevPrice/s,
    );
  });

  it("refuses a snapshot whose running variance went non-finite", () => {
    // Hand-built: a snapshot that a pre-fix run would have written.
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 20; i++) candles.push(candle(i, 100 + i * 0.5));
    const live = createEwmaVolatility(options);
    for (const c of candles) live.next(c);

    const healthy = throughJson(live.getState());
    const poisoned = {
      ...healthy,
      state: { ...healthy.state, prevVariance: null },
    };

    expect(() => createEwmaVolatility(options, { fromState: poisoned })).toThrow(
      /re-warm required.*prevVariance/s,
    );

    // A seed return that came back as null is refused for the same reason.
    const poisonedSeed = {
      ...healthy,
      state: { ...healthy.state, seedReturns: [0.01, null, 0.02] as unknown as number[] },
    };
    expect(() => createEwmaVolatility(options, { fromState: poisonedSeed })).toThrow(
      /re-warm required.*seedReturns/s,
    );

    // The healthy snapshot still resumes.
    expect(() => createEwmaVolatility(options, { fromState: healthy })).not.toThrow();
  });
});
