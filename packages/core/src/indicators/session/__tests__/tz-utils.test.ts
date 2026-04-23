/**
 * Tests for tz-utils and timezone-aware SessionDefinition.
 */

import { describe, expect, it } from "vitest";
import type { Candle } from "../../../types";
import { detectSessions } from "../session-definition";
import { getTzHourMinute } from "../tz-utils";

describe("getTzHourMinute", () => {
  it("returns UTC hour/minute when timezone is omitted or 'UTC'", () => {
    const t = Date.UTC(2026, 0, 15, 13, 45, 0);
    expect(getTzHourMinute(t)).toEqual({ hour: 13, minute: 45 });
    expect(getTzHourMinute(t, "UTC")).toEqual({ hour: 13, minute: 45 });
  });

  it("converts UTC to America/New_York with EST offset (winter, no DST)", () => {
    // 2026-01-15 14:30 UTC = 09:30 EST
    const t = Date.UTC(2026, 0, 15, 14, 30, 0);
    expect(getTzHourMinute(t, "America/New_York")).toEqual({ hour: 9, minute: 30 });
  });

  it("converts UTC to America/New_York with EDT offset (summer, after DST)", () => {
    // 2026-06-15 13:30 UTC = 09:30 EDT (-4h)
    const t = Date.UTC(2026, 5, 15, 13, 30, 0);
    expect(getTzHourMinute(t, "America/New_York")).toEqual({ hour: 9, minute: 30 });
  });

  it("DST transition: NY 2026-03-08 02:00 → 03:00 local skips an hour", () => {
    // Just before DST: 2026-03-08 06:30 UTC = 01:30 EST
    expect(getTzHourMinute(Date.UTC(2026, 2, 8, 6, 30, 0), "America/New_York")).toEqual({
      hour: 1,
      minute: 30,
    });
    // Just after DST: 2026-03-08 07:30 UTC = 03:30 EDT (skipped 02:xx)
    expect(getTzHourMinute(Date.UTC(2026, 2, 8, 7, 30, 0), "America/New_York")).toEqual({
      hour: 3,
      minute: 30,
    });
  });

  it("Asia/Tokyo is always UTC+9 (no DST)", () => {
    // 2026-01-15 00:00 UTC = 09:00 JST
    expect(getTzHourMinute(Date.UTC(2026, 0, 15, 0, 0, 0), "Asia/Tokyo")).toEqual({
      hour: 9,
      minute: 0,
    });
    // 2026-07-15 00:00 UTC = 09:00 JST (no DST shift)
    expect(getTzHourMinute(Date.UTC(2026, 6, 15, 0, 0, 0), "Asia/Tokyo")).toEqual({
      hour: 9,
      minute: 0,
    });
  });
});

describe("SessionDefinition with timezone (DST awareness)", () => {
  const nyOpen = [
    {
      name: "NY Stock Market",
      // 09:30 - 16:00 ET (DST-aware)
      startHour: 9,
      startMinute: 30,
      endHour: 16,
      endMinute: 0,
      timezone: "America/New_York",
    },
  ];

  function bar(time: number): Candle {
    return { time, open: 100, high: 101, low: 99, close: 100, volume: 100 };
  }

  it("EST (winter): 14:30 UTC = 09:30 ET → in session", () => {
    const candles = [bar(Date.UTC(2026, 0, 15, 14, 30, 0))]; // 09:30 EST
    const info = detectSessions(candles, nyOpen);
    expect(info[0].value.session).toBe("NY Stock Market");
    expect(info[0].value.inSession).toBe(true);
  });

  it("EST (winter): 14:00 UTC = 09:00 ET → out of session (before open)", () => {
    const candles = [bar(Date.UTC(2026, 0, 15, 14, 0, 0))]; // 09:00 EST
    const info = detectSessions(candles, nyOpen);
    expect(info[0].value.session).toBeNull();
  });

  it("EDT (summer): 13:30 UTC = 09:30 EDT → in session (DST-shifted)", () => {
    const candles = [bar(Date.UTC(2026, 5, 15, 13, 30, 0))]; // 09:30 EDT
    const info = detectSessions(candles, nyOpen);
    expect(info[0].value.session).toBe("NY Stock Market");
    expect(info[0].value.inSession).toBe(true);
  });

  it("EDT (summer): 14:30 UTC = 10:30 EDT → in session", () => {
    const candles = [bar(Date.UTC(2026, 5, 15, 14, 30, 0))]; // 10:30 EDT
    const info = detectSessions(candles, nyOpen);
    expect(info[0].value.inSession).toBe(true);
  });
});
