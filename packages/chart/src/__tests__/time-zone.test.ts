/**
 * `wallClock` reads an epoch time's calendar in an IANA zone; the
 * format helpers built on it label the same instant identically whatever
 * zone the browser is in.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  autoFormatTime,
  formatCrosshairTime,
  formatShortDate,
  formatShortTime,
} from "../core/format";
import { fromWallClock, isValidTimeZone, wallClock } from "../core/time-zone";

const iso = (d: Date) => d.toISOString().slice(0, 16);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("wallClock", () => {
  it("reads the zone's wall clock across a DST change", () => {
    // New York: EST (-5) before 2024-03-10 07:00Z, EDT (-4) after.
    expect(iso(wallClock(Date.UTC(2024, 2, 10, 6, 59), "America/New_York"))).toBe(
      "2024-03-10T01:59",
    );
    expect(iso(wallClock(Date.UTC(2024, 2, 10, 7, 0), "America/New_York"))).toBe(
      "2024-03-10T03:00",
    );
  });

  it("reads a transition that is not on a 15-minute boundary (Goose Bay, 1987)", () => {
    // 1987-04-05 04:01Z: -4 → -3. Cached at the bucket start, the first 14
    // minutes after the change read an hour early.
    expect(iso(wallClock(Date.UTC(1987, 3, 5, 4, 0), "America/Goose_Bay"))).toBe(
      "1987-04-05T00:00",
    );
    expect(iso(wallClock(Date.UTC(1987, 3, 5, 4, 1), "America/Goose_Bay"))).toBe(
      "1987-04-05T01:01",
    );
  });

  it("handles half-hour offsets and UTC", () => {
    expect(iso(wallClock(Date.UTC(2024, 0, 1, 0, 0), "Asia/Kolkata"))).toBe("2024-01-01T05:30");
    expect(iso(wallClock(Date.UTC(2024, 0, 1, 23, 59), "UTC"))).toBe("2024-01-01T23:59");
  });

  it("reads UTC when no zone is given, whatever the browser's zone", () => {
    // A browser in New York (UTC-5): before 0.7.0 an omitted zone read the
    // browser's clock, so a daily bar stamped at 00:00 UTC fell on the day before.
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(300);
    const t = Date.UTC(2017, 2, 1);
    expect(iso(wallClock(t))).toBe("2017-03-01T00:00");
    expect(formatCrosshairTime(t, undefined, 86_400_000)).toBe("2017-03-01");
    expect(autoFormatTime(t, null, 86_400_000)).toBe("Mar 1");
    expect(formatShortDate(t)).toBe("Mar 1");
    expect(formatShortTime(Date.UTC(2017, 2, 1, 14, 30))).toBe("14:30");
  });

  it("tells known zone names from unknown ones", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
  });
});

describe("fromWallClock", () => {
  it("finds the instant a zone's wall clock reads", () => {
    expect(fromWallClock(Date.UTC(2026, 0, 1), "Asia/Tokyo")).toBe(Date.UTC(2025, 11, 31, 15));
    expect(fromWallClock(Date.UTC(2026, 0, 1), "America/New_York")).toBe(Date.UTC(2026, 0, 1, 5));
    expect(fromWallClock(Date.UTC(2026, 0, 1))).toBe(Date.UTC(2026, 0, 1));
  });

  it("reads the offset at the answer, not at the guess, across a DST change", () => {
    // 04:00 EDT on 2024-03-10 is 08:00Z. The offset at 04:00Z is still EST
    // (-5), which alone would give 09:00Z.
    expect(fromWallClock(Date.UTC(2024, 2, 10, 4), "America/New_York")).toBe(
      Date.UTC(2024, 2, 10, 8),
    );
  });
});

describe("format helpers in a time zone", () => {
  // 2025-11-26 20:55Z: the bar from the original bug report.
  const t = Date.UTC(2025, 10, 26, 20, 55);

  it("labels the crosshair in the given zone", () => {
    expect(formatCrosshairTime(t, "UTC")).toBe("2025-11-26 20:55");
    expect(formatCrosshairTime(t, "Asia/Tokyo")).toBe("2025-11-27 05:55");
    expect(formatCrosshairTime(t, "America/New_York")).toBe("2025-11-26 15:55");
  });

  it("leaves the hour off the crosshair for daily and coarser bars", () => {
    const day = 86_400_000;
    // A daily bar stamped at 00:00 UTC reads 09:00 in Tokyo: an artifact
    expect(formatCrosshairTime(Date.UTC(2023, 5, 26), "Asia/Tokyo", day)).toBe("2023-06-26");
    expect(formatCrosshairTime(Date.UTC(2024, 2, 1), "America/New_York", day)).toBe("2024-02-29");
    expect(formatCrosshairTime(Date.UTC(2024, 2, 1), "America/New_York", 7 * day)).toBe(
      "2024-02-29",
    );
    // Intraday bars keep it; without a hint the label is as before
    expect(formatCrosshairTime(t, "Asia/Tokyo", 60_000)).toBe("2025-11-27 05:55");
    expect(formatCrosshairTime(Date.UTC(2023, 5, 26), "Asia/Tokyo")).toBe("2023-06-26 09:00");
  });

  it("labels the axis in the given zone", () => {
    expect(formatShortTime(t, "America/New_York")).toBe("15:55");
    expect(formatShortDate(t, null, "Asia/Tokyo")).toBe("Nov 27");
    // After a session gap from 14:55Z: the date anchor is read in the zone.
    const prev = t - 6 * 3_600_000;
    expect(autoFormatTime(t, prev, 300_000, "UTC")).toBe("Nov 26 20:55");
    expect(autoFormatTime(t, prev, 300_000, "Asia/Tokyo")).toBe("Nov 27 05:55");
  });
});
