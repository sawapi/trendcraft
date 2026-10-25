/**
 * `wallClock` reads an epoch time's calendar in an IANA zone; the
 * format helpers built on it label the same instant identically whatever
 * zone the browser is in.
 */

import { describe, expect, it } from "vitest";
import {
  autoFormatTime,
  formatCrosshairTime,
  formatShortDate,
  formatShortTime,
} from "../core/format";
import { isValidTimeZone, wallClock } from "../core/time-zone";

const iso = (d: Date) => d.toISOString().slice(0, 16);

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

  it("reads the browser's local zone when no zone is given", () => {
    const t = Date.UTC(2024, 6, 1, 13, 45);
    const local = new Date(t);
    const d = wallClock(t);
    expect([d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()]).toEqual([
      local.getFullYear(),
      local.getMonth(),
      local.getDate(),
      local.getHours(),
    ]);
  });

  it("tells known zone names from unknown ones", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
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

  it("labels the axis in the given zone", () => {
    expect(formatShortTime(t, "America/New_York")).toBe("15:55");
    expect(formatShortDate(t, null, "Asia/Tokyo")).toBe("Nov 27");
    // After a session gap from 14:55Z: the date anchor is read in the zone.
    const prev = t - 6 * 3_600_000;
    expect(autoFormatTime(t, prev, 300_000, "UTC")).toBe("Nov 26 20:55");
    expect(autoFormatTime(t, prev, 300_000, "Asia/Tokyo")).toBe("Nov 27 05:55");
  });
});
