import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { openingRange } from "../price/opening-range";
import type { SessionDefinition } from "../session/session-definition";

const MINUTE = 60 * 1000;

/** New York cash session, 09:30-16:00 local. */
const NY_REGULAR: SessionDefinition = {
  name: "regular",
  startHour: 9,
  startMinute: 30,
  endHour: 16,
  endMinute: 0,
  timezone: "America/New_York",
};

/** Runs across midnight, in New York local time. */
const NY_OVERNIGHT: SessionDefinition = {
  name: "overnight",
  startHour: 22,
  startMinute: 0,
  endHour: 6,
  endMinute: 0,
  timezone: "America/New_York",
};

function bar(time: number, high: number, low: number, close = (high + low) / 2): NormalizedCandle {
  return { time, open: close, high, low, close, volume: 1000 };
}

/** 14:30 UTC = 09:30 New York in January (EST). */
function nyOpenUtc(day: number): number {
  return Date.UTC(2024, 0, day, 14, 30);
}

describe("session-anchored opening range", () => {
  it("measures the range from the session open, ignoring pre-market bars", () => {
    const open = nyOpenUtc(2);
    const candles = [
      // Pre-market: a wide bar that must not enter the range.
      bar(open - 60 * MINUTE, 500, 1),
      bar(open, 105, 95),
      bar(open + 10 * MINUTE, 110, 100),
      bar(open + 25 * MINUTE, 108, 102),
      // Past the 30-minute range.
      bar(open + 35 * MINUTE, 120, 118, 119),
    ];

    const result = openingRange(candles, { session: NY_REGULAR, minutes: 30 });

    expect(result[0].value).toEqual({ high: null, low: null, breakout: null });
    // Range builds over the first three in-session bars: high 110, low 95.
    expect(result[3].value.high).toBe(110);
    expect(result[3].value.low).toBe(95);
    // The pre-market 500/1 bar is nowhere in it.
    expect(result[4].value.high).toBe(110);
    expect(result[4].value.breakout).toBe("above");
  });

  it("reports no range for a day whose open was never observed", () => {
    // Data starts 15 minutes into the session. Measuring a fresh 30 minutes
    // from here would quote a range the market never set as the opening one.
    const open = nyOpenUtc(2);
    const candles = [
      bar(open + 15 * MINUTE, 110, 100),
      bar(open + 25 * MINUTE, 115, 105),
      bar(open + 45 * MINUTE, 130, 125, 128),
    ];

    const result = openingRange(candles, { session: NY_REGULAR, minutes: 30 });

    expect(result.every((r) => r.value.high === null)).toBe(true);
    expect(result.every((r) => r.value.breakout === null)).toBe(true);
  });

  it("recovers on the next day, once an open is observed", () => {
    const day1 = nyOpenUtc(2);
    const day2 = nyOpenUtc(3);
    const candles = [
      // Day 1 starts late — no range.
      bar(day1 + 15 * MINUTE, 110, 100),
      bar(day1 + 60 * MINUTE, 130, 125, 128),
      // Day 2 starts at the open.
      bar(day2, 205, 195),
      bar(day2 + 40 * MINUTE, 220, 218, 219),
    ];

    const result = openingRange(candles, { session: NY_REGULAR, minutes: 30 });

    expect(result[0].value.high).toBeNull();
    expect(result[1].value.high).toBeNull();
    expect(result[2].value.high).toBe(205);
    expect(result[3].value.high).toBe(205);
    expect(result[3].value.breakout).toBe("above");
  });

  it("restarts the range each session day", () => {
    const day1 = nyOpenUtc(2);
    const day2 = nyOpenUtc(3);
    const candles = [
      bar(day1, 105, 95),
      bar(day1 + 60 * MINUTE, 150, 140, 145),
      bar(day2, 205, 195),
      bar(day2 + 60 * MINUTE, 250, 240, 245),
    ];

    const result = openingRange(candles, { session: NY_REGULAR, minutes: 30 });

    expect(result[1].value.high).toBe(105);
    // Day 2's range is its own, not day 1's carried forward.
    expect(result[3].value.high).toBe(205);
    expect(result[3].value.low).toBe(195);
  });

  it("reports null outside the session", () => {
    const open = nyOpenUtc(2);
    const candles = [
      bar(open, 105, 95),
      bar(open + 40 * MINUTE, 110, 100, 108),
      // 21:00 UTC = 16:00 New York — the session has closed.
      bar(Date.UTC(2024, 0, 2, 21, 30), 200, 190, 195),
    ];

    const result = openingRange(candles, { session: NY_REGULAR, minutes: 30 });

    expect(result[1].value.high).toBe(105);
    expect(result[2].value).toEqual({ high: null, low: null, breakout: null });
  });

  it("detects a breakout below the range", () => {
    const open = nyOpenUtc(2);
    const candles = [bar(open, 105, 95), bar(open + 40 * MINUTE, 94, 90, 92)];

    const result = openingRange(candles, { session: NY_REGULAR, minutes: 30 });

    expect(result[1].value.breakout).toBe("below");
  });

  it("measures a session that crosses midnight from its own open", () => {
    // 03:00 UTC = 22:00 New York, the session open.
    const open = Date.UTC(2024, 0, 3, 3, 0);
    const candles = [
      bar(open, 105, 95),
      bar(open + 20 * MINUTE, 108, 98),
      // 05:00 UTC = midnight local — well past the 30-minute range, and not a
      // new session.
      bar(open + 120 * MINUTE, 120, 118, 119),
    ];

    const result = openingRange(candles, { session: NY_OVERNIGHT, minutes: 30 });

    expect(result[1].value.high).toBe(108);
    expect(result[2].value.high).toBe(108);
    expect(result[2].value.breakout).toBe("above");
  });

  it("leaves the default behavior untouched when no session is given", () => {
    const open = nyOpenUtc(2);
    const candles = [bar(open, 105, 95), bar(open + 40 * MINUTE, 110, 100, 108)];

    expect(openingRange(candles)).toEqual(openingRange(candles, { sessionResetPeriod: "day" }));
  });

  it("rejects a reset period that contradicts the session", () => {
    const candles = [bar(nyOpenUtc(2), 105, 95)];

    expect(() => openingRange(candles, { session: NY_REGULAR, sessionResetPeriod: 78 })).toThrow(
      /cannot be combined with `session`/,
    );
  });

  describe("a range window no bar can fall into", () => {
    // `minutes` of zero, negative or NaN leaves the range unformed. Reporting
    // the untouched sentinels would emit ±Infinity as a price level and make
    // every close a breakout "above" it.
    const open = nyOpenUtc(2);
    const candles = [bar(open, 105, 95), bar(open + 40 * MINUTE, 110, 100, 108)];

    for (const minutes of [0, -5, Number.NaN]) {
      it(`reports no range for minutes: ${minutes}`, () => {
        const result = openingRange(candles, { session: NY_REGULAR, minutes });

        for (const point of result) {
          expect(point.value).toEqual({ high: null, low: null, breakout: null });
        }
      });

      it(`matches the non-session path for minutes: ${minutes}`, () => {
        const withSession = openingRange(candles, { session: NY_REGULAR, minutes });
        const withoutSession = openingRange(candles, { minutes });

        expect(withSession.map((p) => p.value)).toEqual(withoutSession.map((p) => p.value));
      });
    }
  });
});
