/**
 * Three time-handling defects that shared a failure style: the wrong answer
 * arrived without an error, a warning, or a visibly odd number.
 */
import { describe, expect, it } from "vitest";
import { isNormalized, normalizeCandles } from "../core/normalize";
import { resample } from "../core/resample";
import { vwap } from "../indicators/volume/vwap";
import type { Candle, NormalizedCandle } from "../types";
import { detectGaps } from "../validation/gap-detection";

const DAY_MS = 86_400_000;
const DAY_S = 86_400;
/** 2026-01-05T00:00Z — a Monday, so weekly buckets start cleanly. */
const MONDAY_MS = 1_767_571_200_000;

/** One bar per day at `close`, stamped in whichever unit is asked for. */
function dailyCandles(closes: number[], unit: "s" | "ms"): NormalizedCandle[] {
  const step = unit === "s" ? DAY_S : DAY_MS;
  const start = unit === "s" ? MONDAY_MS / 1000 : MONDAY_MS;
  return closes.map((close, i) => ({
    time: start + i * step,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  }));
}

describe("isNormalized recognises second-stamped candles", () => {
  it("treats epoch seconds as not yet normalized", () => {
    expect(isNormalized(dailyCandles([100], "s"))).toBe(false);
    expect(isNormalized(dailyCandles([100], "ms"))).toBe(true);
    // Empty input has nothing to judge and is left alone.
    expect(isNormalized([])).toBe(true);
  });

  it("converts them, so day buckets advance once a day rather than once every 2.7 years", () => {
    const seconds = dailyCandles([100, 101, 102], "s");
    const converted = normalizeCandles(seconds as unknown as Candle[]);

    expect(converted.map((c) => c.time)).toEqual(
      dailyCandles([100, 101, 102], "ms").map((c) => c.time),
    );
    expect(new Set(converted.map((c) => Math.floor(c.time / DAY_MS))).size).toBe(3);
    // Before the fix all three landed in one bucket, 1970-01-21.
    expect(new Set(seconds.map((c) => Math.floor(c.time / DAY_MS))).size).toBe(1);
  });

  it("resets session VWAP per day for second-stamped input", () => {
    // One bar per day at a flat price, so a session VWAP that resets daily
    // reports that day's price and one that never resets drags the average.
    const closes = [100, 101, 102];
    const fromSeconds = vwap(dailyCandles(closes, "s") as unknown as Candle[], {
      resetPeriod: "session",
    });
    const fromMs = vwap(dailyCandles(closes, "ms"), { resetPeriod: "session" });

    expect(fromSeconds.map((p) => p.value)).toEqual(fromMs.map((p) => p.value));
    expect(fromSeconds.map((p) => p.value.vwap)).toEqual(closes);
  });

  it("is idempotent: normalizing an already-normalized array changes nothing", () => {
    const ms = dailyCandles([100, 101], "ms");
    expect(normalizeCandles(ms as unknown as Candle[]).map((c) => c.time)).toEqual(
      ms.map((c) => c.time),
    );
  });
});

describe("resample honours the value of a multi-week timeframe", () => {
  it("puts adjacent weeks in one bucket for a 2-week timeframe", () => {
    // Four calendar weeks of daily bars, weekdays only.
    const closes: number[] = [];
    const candles: NormalizedCandle[] = [];
    for (let week = 0; week < 4; week++) {
      for (let day = 0; day < 5; day++) {
        const close = 100 + week * 4 + day;
        closes.push(close);
        candles.push({
          time: MONDAY_MS + (week * 7 + day) * DAY_MS,
          open: close,
          high: close,
          low: close,
          close,
          volume: 1000,
        });
      }
    }

    const weekly = resample(candles, { value: 1, unit: "week" });
    const biweekly = resample(candles, { value: 2, unit: "week" });

    expect(weekly).toHaveLength(4);
    // Previously `value` was ignored here and this also returned four.
    expect(biweekly).toHaveLength(2);
    expect(biweekly[0].time).toBe(weekly[0].time);
    expect(biweekly[1].time).toBe(weekly[2].time);
    // Each two-week candle spans both of its weeks.
    expect(biweekly[0].close).toBe(weekly[1].close);
  });
});

describe("weekend gaps are bounded by their duration", () => {
  function fridayToMondayGap(holeDays: number): NormalizedCandle[] {
    // MONDAY_MS is a Monday; bar 4 is the Friday of that week.
    const friday = MONDAY_MS + 4 * DAY_MS;
    const times = [
      MONDAY_MS,
      MONDAY_MS + DAY_MS,
      MONDAY_MS + 2 * DAY_MS,
      MONDAY_MS + 3 * DAY_MS,
      friday,
      friday + holeDays * DAY_MS,
    ];
    return times.map((time) => ({
      time,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1000,
    }));
  }

  it("still ignores a genuine Friday-to-Monday weekend", () => {
    expect(detectGaps(fridayToMondayGap(3), { skipWeekends: true })).toEqual([]);
  });

  it("reports a seventeen-day hole that happens to run Friday to Monday", () => {
    const findings = detectGaps(fridayToMondayGap(17), { skipWeekends: true });

    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe("gap");
    expect(findings[0].message).toContain("17.0d");
  });
});
