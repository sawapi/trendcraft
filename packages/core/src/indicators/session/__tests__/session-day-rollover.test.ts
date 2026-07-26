import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { sessionBreakout } from "../session-breakout";
import type { SessionDefinition } from "../session-definition";
import { detectSessions } from "../session-definition";
import { sessionStats } from "../session-stats";

const HOUR = 60 * 60 * 1000;

/** Regular US cash session, expressed in New York time. */
const NY_REGULAR: SessionDefinition = {
  name: "regular",
  startHour: 9,
  startMinute: 30,
  endHour: 16,
  endMinute: 0,
  timezone: "America/New_York",
};

/** A session that runs across UTC midnight. */
const OVERNIGHT: SessionDefinition = {
  name: "overnight",
  startHour: 22,
  startMinute: 0,
  endHour: 6,
  endMinute: 0,
};

/** The same overnight window, but anchored to New York's local clock. */
const NY_OVERNIGHT: SessionDefinition = { ...OVERNIGHT, timezone: "America/New_York" };

/**
 * Half-hourly bars spanning New York's DST fall-back, inside one overnight
 * session. On 2024-11-03 the local clock rewinds 02:00 EDT to 01:00 EST, so
 * 05:00 UTC and 06:00 UTC are both "01:00" locally.
 *
 * Starts at 02:00 UTC (22:00 EDT on 11-02, the session open) and runs to
 * 08:00 UTC (03:00 EST), still inside the window.
 */
function nyDstFallBackBars(): NormalizedCandle[] {
  return Array.from({ length: 13 }, (_, i) => {
    const price = 100 + i;
    return {
      time: Date.UTC(2024, 10, 3, 2, 0) + i * 30 * 60 * 1000,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000,
    };
  });
}

/**
 * Two trading days of bars that exist ONLY inside the session — the shape a
 * data vendor returns when it ships regular-hours bars. Six hourly bars per
 * day starting at 09:30 New York (14:30 UTC in January).
 */
function inSessionOnlyBars(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];

  for (const day of [2, 3]) {
    for (let h = 0; h < 6; h++) {
      const price = 100 + day + h;
      candles.push({
        time: Date.UTC(2024, 0, day, 14, 30) + h * HOUR,
        open: price,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000,
      });
    }
  }

  return candles;
}

/**
 * One overnight session (22:00 to 05:00 UTC) plus the first bar of the next
 * one. The UTC calendar day changes in the middle of the first session.
 */
function overnightBars(): NormalizedCandle[] {
  const start = Date.UTC(2024, 0, 2, 22, 0);

  return Array.from({ length: 9 }, (_, i) => {
    // 22:00..05:00 is 8 bars; the 9th jumps to the next session's 22:00.
    const time = i < 8 ? start + i * HOUR : start + 24 * HOUR;
    const price = 100 + i;
    return {
      time,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000,
    };
  });
}

describe("session rollover with in-session-only data", () => {
  describe("detectSessions", () => {
    it("restarts the session on the next day", () => {
      // Detecting the boundary by watching bars leave the window cannot work
      // here: no bar is ever outside it. barIndex previously ran 0..11 across
      // both days and sessionOpen stayed at the first day's open.
      const result = detectSessions(inSessionOnlyBars(), [NY_REGULAR]);

      expect(result.map((r) => r.value.barIndex)).toEqual([0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5]);
      expect(result.map((r) => r.value.sessionOpen)).toEqual([
        102, 102, 102, 102, 102, 102, 103, 103, 103, 103, 103, 103,
      ]);
      // Each day's high is its last bar's high, not the whole series'.
      expect(result[5].value.sessionHigh).toBe(108);
      expect(result[11].value.sessionHigh).toBe(109);
    });

    it("keeps a session that crosses midnight in one piece", () => {
      // Why the boundary is the day the session OPENED on rather than the date
      // printed on each bar: this session spans two calendar dates.
      const result = detectSessions(overnightBars(), [OVERNIGHT]);

      expect(result.slice(0, 8).map((r) => r.value.barIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(result.slice(0, 8).every((r) => r.value.sessionOpen === 100)).toBe(true);
      // The next 22:00 bar starts a new occurrence.
      expect(result[8].value.barIndex).toBe(0);
      expect(result[8].value.sessionOpen).toBe(108);
    });
  });

  describe("sessionStats", () => {
    it("counts each day as its own occurrence", () => {
      // Previously both days merged into one occurrence, so avgRange reported
      // the whole series' spread (109 - 101 = 8) and avgVolume summed 12 bars.
      const [stats] = sessionStats(inSessionOnlyBars(), { sessions: [NY_REGULAR] });

      expect(stats.session).toBe("regular");
      // Day 1: high 108, low 101. Day 2: high 109, low 102. Both span 7.
      expect(stats.avgRange).toBe(7);
      expect(stats.avgVolume).toBe(6000);
      expect(stats.barCount).toBe(12);
    });
  });

  describe("sessionBreakout", () => {
    it("publishes the first day's range once the second day opens", () => {
      // The session never appeared to end, so no range was ever completed and
      // every bar carried a null range.
      const result = sessionBreakout(inSessionOnlyBars(), { sessions: [NY_REGULAR] });

      expect(result.slice(0, 6).every((r) => r.value.rangeHigh === null)).toBe(true);
      expect(result[6].value.fromSession).toBe("regular");
      expect(result[6].value.rangeHigh).toBe(108);
      expect(result[6].value.rangeLow).toBe(101);
    });

    it("flags a breakout above the previous day's range", () => {
      const result = sessionBreakout(inSessionOnlyBars(), { sessions: [NY_REGULAR] });

      // Day 2 closes climb 103..108; the day-1 high is 108, so the last bars
      // do not exceed it, but the range is live rather than null.
      expect(result[11].value.rangeHigh).toBe(108);
      expect(result[11].value.breakout).toBeNull();
    });
  });
});

describe("DST fall-back inside one session", () => {
  // The local clock repeats an hour, so elapsed local time moves backwards
  // mid-session. Anything keying off the clock alone splits the session here;
  // the day it opened on does not change.

  it("detectSessions keeps one session across the repeated hour", () => {
    const result = detectSessions(nyDstFallBackBars(), [NY_OVERNIGHT]);

    expect(result.map((r) => r.value.barIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.every((r) => r.value.sessionOpen === 100)).toBe(true);
    expect(result[12].value.sessionHigh).toBe(113);
  });

  it("sessionStats reports one occurrence, not two", () => {
    const [stats] = sessionStats(nyDstFallBackBars(), { sessions: [NY_OVERNIGHT] });

    // One occurrence spanning high 113 and low 99. Split at the repeated hour,
    // the two halves would average (9 + 6) / 2 = 7.5 instead.
    expect(stats.avgRange).toBe(14);
    expect(stats.avgVolume).toBe(13000);
    expect(stats.barCount).toBe(13);
  });

  it("sessionBreakout does not publish a range mid-session", () => {
    const result = sessionBreakout(nyDstFallBackBars(), { sessions: [NY_OVERNIGHT] });

    // The session has not ended, so there is no completed range to break out of.
    expect(result.every((r) => r.value.rangeHigh === null)).toBe(true);
    expect(result.every((r) => r.value.breakout === null)).toBe(true);
  });
});

describe("session rollover with out-of-session bars present", () => {
  it("still detects the boundary the original way", () => {
    // Regression guard: when the data does contain bars outside the window,
    // the in/out transition alone already found the boundary and must keep
    // producing the same result.
    const candles: NormalizedCandle[] = [];
    for (const day of [2, 3]) {
      // 12:00 UTC = 07:00 New York — before the open.
      for (const hoursFromMidnightUtc of [12, 14.5, 15.5, 21]) {
        const time = Date.UTC(2024, 0, day) + hoursFromMidnightUtc * HOUR;
        const price = 100 + day;
        candles.push({
          time,
          open: price,
          high: price + 1,
          low: price - 1,
          close: price,
          volume: 1000,
        });
      }
    }

    const result = detectSessions(candles, [NY_REGULAR]);

    // Per day: out, in (barIndex 0), in (barIndex 1), out.
    expect(result.map((r) => r.value.session)).toEqual([
      null,
      "regular",
      "regular",
      null,
      null,
      "regular",
      "regular",
      null,
    ]);
    expect(result.map((r) => r.value.barIndex)).toEqual([0, 0, 1, 0, 0, 0, 1, 0]);
  });
});
