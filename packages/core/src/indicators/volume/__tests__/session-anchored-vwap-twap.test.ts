import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import type { SessionDefinition } from "../../session/session-definition";
import { twap } from "../twap";
import { vwap } from "../vwap";

/** New York cash session, 09:30-16:00 local. */
const NY_REGULAR: SessionDefinition = {
  name: "regular",
  startHour: 9,
  startMinute: 30,
  endHour: 16,
  endMinute: 0,
  timezone: "America/New_York",
};

/** Tokyo-style session with a lunch break. */
const WITH_LUNCH: SessionDefinition = {
  name: "tokyo",
  startHour: 9,
  startMinute: 0,
  endHour: 15,
  endMinute: 0,
  breaks: [{ startHour: 11, startMinute: 30, endHour: 12, endMinute: 30 }],
  timezone: "Asia/Tokyo",
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

function bar(time: number, price: number, volume = 1000): NormalizedCandle {
  return { time, open: price, high: price, low: price, close: price, volume };
}

/**
 * Two New York trading days including pre- and post-market bars, so the
 * session boundary is genuinely narrower than the calendar day.
 *
 * Per day (UTC, January so New York is EST = UTC-5):
 *   12:00 pre-market, 14:30 open, 17:00 midday, 20:30 close-ish, 22:00 post
 */
function twoDaysWithExtendedHours(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];

  for (const [dayIndex, day] of [2, 3].entries()) {
    const base = 100 + dayIndex * 100;
    candles.push(bar(Date.UTC(2024, 0, day, 12, 0), base + 1)); // pre-market
    candles.push(bar(Date.UTC(2024, 0, day, 14, 30), base + 10)); // 09:30 open
    candles.push(bar(Date.UTC(2024, 0, day, 17, 0), base + 20)); // 12:00
    candles.push(bar(Date.UTC(2024, 0, day, 20, 30), base + 30)); // 15:30
    candles.push(bar(Date.UTC(2024, 0, day, 22, 0), base + 99)); // post-market
  }

  return candles;
}

describe("session-anchored VWAP", () => {
  it("excludes bars outside the session and restarts each day", () => {
    const result = vwap(twoDaysWithExtendedHours(), { session: NY_REGULAR });

    // Pre- and post-market bars contribute nothing and report nothing.
    expect(result[0].value.vwap).toBeNull();
    expect(result[4].value.vwap).toBeNull();
    expect(result[5].value.vwap).toBeNull();
    expect(result[9].value.vwap).toBeNull();

    // Day 1, in-session: 110, then (110+120)/2, then (110+120+130)/3.
    expect(result[1].value.vwap).toBeCloseTo(110, 10);
    expect(result[2].value.vwap).toBeCloseTo(115, 10);
    expect(result[3].value.vwap).toBeCloseTo(120, 10);

    // Day 2 starts over rather than carrying day 1 forward.
    expect(result[6].value.vwap).toBeCloseTo(210, 10);
    expect(result[7].value.vwap).toBeCloseTo(215, 10);
    expect(result[8].value.vwap).toBeCloseTo(220, 10);
  });

  it("differs from the UTC-midnight default, which folds in extended hours", () => {
    const candles = twoDaysWithExtendedHours();
    const withSession = vwap(candles, { session: NY_REGULAR });
    const utcDefault = vwap(candles);

    // The default averages the pre-market bar into the day and never resets at
    // the session open, so the two disagree on the same bar.
    expect(utcDefault[3].value.vwap).not.toBeCloseTo(withSession[3].value.vwap as number, 6);
    // 22:00 UTC is still 17:00 in New York — the same calendar day for the
    // default, which therefore reports a value where the session reports none.
    expect(utcDefault[4].value.vwap).not.toBeNull();
    expect(withSession[4].value.vwap).toBeNull();
  });

  it("weights by volume within the session", () => {
    const candles = [
      bar(Date.UTC(2024, 0, 2, 14, 30), 100, 1),
      bar(Date.UTC(2024, 0, 2, 15, 30), 200, 3),
    ];
    const result = vwap(candles, { session: NY_REGULAR });

    // (100*1 + 200*3) / 4
    expect(result[1].value.vwap).toBeCloseTo(175, 10);
  });

  it("pauses through a lunch break without restarting", () => {
    // 00:00 UTC = 09:00 Tokyo. The break runs 11:30-12:30 local.
    const candles = [
      bar(Date.UTC(2024, 0, 2, 0, 0), 100), // 09:00
      bar(Date.UTC(2024, 0, 2, 2, 0), 200), // 11:00
      bar(Date.UTC(2024, 0, 2, 3, 0), 999), // 12:00 — inside the break
      bar(Date.UTC(2024, 0, 2, 4, 0), 300), // 13:00
    ];
    const result = vwap(candles, { session: WITH_LUNCH });

    expect(result[1].value.vwap).toBeCloseTo(150, 10);
    // The break bar reports nothing and must not enter the average.
    expect(result[2].value.vwap).toBeNull();
    // Resumes from the pre-break totals: (100 + 200 + 300) / 3.
    expect(result[3].value.vwap).toBeCloseTo(200, 10);
  });

  it("keeps one average across midnight", () => {
    // 03:00 UTC = 22:00 New York (session open), 08:00 UTC = 03:00 next day.
    const candles = [bar(Date.UTC(2024, 0, 3, 3, 0), 100), bar(Date.UTC(2024, 0, 3, 8, 0), 200)];
    const result = vwap(candles, { session: NY_OVERNIGHT });

    expect(result[0].value.vwap).toBeCloseTo(100, 10);
    // Same session — averaged together, not restarted at 00:00.
    expect(result[1].value.vwap).toBeCloseTo(150, 10);
  });

  it("keeps one average across a DST fall-back", () => {
    // 2024-11-03: New York rewinds 02:00 EDT to 01:00 EST. Both bars are
    // inside the session that opened at 22:00 on 11-02.
    const candles = [
      bar(Date.UTC(2024, 10, 3, 5, 30), 100), // 01:30 EDT
      bar(Date.UTC(2024, 10, 3, 6, 30), 200), // 01:30 EST, an hour later
    ];
    const result = vwap(candles, { session: NY_OVERNIGHT });

    expect(result[1].value.vwap).toBeCloseTo(150, 10);
  });

  it("leaves the default behavior untouched when no session is given", () => {
    const candles = twoDaysWithExtendedHours();

    expect(vwap(candles)).toEqual(vwap(candles, { resetPeriod: "session" }));
  });

  it("rejects a reset period that contradicts the session", () => {
    const candles = twoDaysWithExtendedHours();

    expect(() => vwap(candles, { session: NY_REGULAR, resetPeriod: "rolling", period: 3 })).toThrow(
      /cannot be combined with `session`/,
    );
    expect(() => vwap(candles, { session: NY_REGULAR, resetPeriod: 5 })).toThrow(
      /cannot be combined with `session`/,
    );
  });

  it("still emits bands inside the session", () => {
    const candles = [
      bar(Date.UTC(2024, 0, 2, 14, 30), 100),
      bar(Date.UTC(2024, 0, 2, 15, 30), 200),
    ];
    const result = vwap(candles, { session: NY_REGULAR, bandMultipliers: [2] });

    expect(result[1].value.upper).not.toBeNull();
    expect(result[1].value.bands).toHaveLength(1);
    // Out-of-session bars carry the same shape as a warm-up bar: no bands.
    const outside = vwap([bar(Date.UTC(2024, 0, 2, 12, 0), 100)], {
      session: NY_REGULAR,
      bandMultipliers: [2],
    });
    expect(outside[0].value).toEqual({ vwap: null, upper: null, lower: null });
  });
});

describe("session-anchored TWAP", () => {
  it("excludes bars outside the session and restarts each day", () => {
    const result = twap(twoDaysWithExtendedHours(), { session: NY_REGULAR });

    expect(result[0].value).toBeNull();
    expect(result[4].value).toBeNull();

    expect(result[1].value).toBeCloseTo(110, 10);
    expect(result[2].value).toBeCloseTo(115, 10);
    expect(result[3].value).toBeCloseTo(120, 10);

    expect(result[6].value).toBeCloseTo(210, 10);
    expect(result[8].value).toBeCloseTo(220, 10);
  });

  it("ignores volume, unlike VWAP", () => {
    const candles = [
      bar(Date.UTC(2024, 0, 2, 14, 30), 100, 1),
      bar(Date.UTC(2024, 0, 2, 15, 30), 200, 3),
    ];

    expect(twap(candles, { session: NY_REGULAR })[1].value).toBeCloseTo(150, 10);
    expect(vwap(candles, { session: NY_REGULAR })[1].value.vwap).toBeCloseTo(175, 10);
  });

  it("pauses through a lunch break without restarting", () => {
    const candles = [
      bar(Date.UTC(2024, 0, 2, 0, 0), 100),
      bar(Date.UTC(2024, 0, 2, 2, 0), 200),
      bar(Date.UTC(2024, 0, 2, 3, 0), 999),
      bar(Date.UTC(2024, 0, 2, 4, 0), 300),
    ];
    const result = twap(candles, { session: WITH_LUNCH });

    expect(result[2].value).toBeNull();
    expect(result[3].value).toBeCloseTo(200, 10);
  });

  it("keeps one average across midnight and a DST fall-back", () => {
    const acrossMidnight = twap(
      [bar(Date.UTC(2024, 0, 3, 3, 0), 100), bar(Date.UTC(2024, 0, 3, 8, 0), 200)],
      { session: NY_OVERNIGHT },
    );
    expect(acrossMidnight[1].value).toBeCloseTo(150, 10);

    const acrossDst = twap(
      [bar(Date.UTC(2024, 10, 3, 5, 30), 100), bar(Date.UTC(2024, 10, 3, 6, 30), 200)],
      { session: NY_OVERNIGHT },
    );
    expect(acrossDst[1].value).toBeCloseTo(150, 10);
  });

  it("leaves the default behavior untouched when no session is given", () => {
    const candles = twoDaysWithExtendedHours();

    expect(twap(candles)).toEqual(twap(candles, { sessionResetPeriod: "session" }));
  });

  it("rejects a reset period that contradicts the session", () => {
    expect(() =>
      twap(twoDaysWithExtendedHours(), { session: NY_REGULAR, sessionResetPeriod: 5 }),
    ).toThrow(/cannot be combined with `session`/);
  });
});
