import { describe, expect, it } from "vitest";
import {
  autoFormatPrice,
  autoFormatTime,
  detectPrecision,
  formatShortDate,
  formatShortTime,
  formatVolume,
  pickNiceStep,
} from "../core/format";

describe("autoFormatPrice", () => {
  it("formats high prices with 0 decimals", () => {
    expect(autoFormatPrice(12345)).toBe("12345");
    expect(autoFormatPrice(99999)).toBe("99999");
  });

  it("formats medium prices with 2 decimals", () => {
    expect(autoFormatPrice(234.56)).toBe("234.56");
    expect(autoFormatPrice(100)).toBe("100.00");
  });

  it("formats low prices with 3 decimals", () => {
    expect(autoFormatPrice(1.234)).toBe("1.234");
    expect(autoFormatPrice(5.5)).toBe("5.500");
  });

  it("formats sub-penny with 4 decimals", () => {
    expect(autoFormatPrice(0.0456)).toBe("0.0456");
  });

  it("formats micro prices with 6+ decimals", () => {
    expect(autoFormatPrice(0.000123)).toBe("0.000123");
  });

  it("formats crypto-small with 8 decimals", () => {
    expect(autoFormatPrice(0.00000012)).toBe("0.00000012");
  });

  it("handles NaN and Infinity", () => {
    expect(autoFormatPrice(Number.NaN)).toBe("—");
    expect(autoFormatPrice(Number.POSITIVE_INFINITY)).toBe("—");
    expect(autoFormatPrice(Number.NEGATIVE_INFINITY)).toBe("—");
  });

  it("handles negative prices", () => {
    expect(autoFormatPrice(-50.5)).toBe("-50.500");
  });

  it("handles zero", () => {
    expect(autoFormatPrice(0)).toBe("0");
  });
});

describe("autoFormatTime", () => {
  const day1 = new Date("2026-01-15T00:00:00Z").getTime();
  const day2 = new Date("2026-01-16T00:00:00Z").getTime();
  const day3 = new Date("2026-02-01T00:00:00Z").getTime();
  const year2 = new Date("2027-01-01T00:00:00Z").getTime();
  const intraday1 = new Date("2026-01-15T10:30:00Z").getTime();
  const intraday2 = new Date("2026-01-15T14:00:00Z").getTime();

  it("first label shows date", () => {
    const label = autoFormatTime(day1, null);
    expect(label).toContain("Jan");
    expect(label).toContain("15");
  });

  it("day change shows month + day", () => {
    const label = autoFormatTime(day2, day1);
    expect(label).toContain("16");
  });

  it("month change shows month name", () => {
    const label = autoFormatTime(day3, day2);
    expect(label).toBe("Feb");
  });

  it("year change shows year", () => {
    const label = autoFormatTime(year2, day3);
    expect(label).toBe("2027");
  });

  it("same day shows time (HH:MM format)", () => {
    const label = autoFormatTime(intraday2, intraday1);
    // Timezone-dependent, just verify HH:MM format
    expect(label).toMatch(/^\d{2}:\d{2}$/);
  });

  it("large jump across a day boundary shows date + time when the bar is mid-session", () => {
    // Fri 14:00 local → Mon 22:30 local (weekend gap, >= 56h).
    // Mon 22:30 is not near midnight, so the hour matters to the viewer.
    const prev = new Date(2026, 0, 16, 14, 0, 0).getTime();
    const next = new Date(2026, 0, 19, 22, 30, 0).getTime();
    const label = autoFormatTime(next, prev);
    expect(label).toMatch(/[A-Z][a-z]{2}/); // month
    expect(label).toContain("22:30"); // explicit hour anchor
  });

  it("large jump across day boundary keeps compact date when bar is near midnight", () => {
    // Daily bars: consecutive bars are 24h apart and timestamped at 00:00.
    // Compact "Jan 17" is more readable than "Jan 17 00:00".
    const prev = new Date(2026, 0, 16, 0, 0, 0).getTime();
    const next = new Date(2026, 0, 17, 0, 0, 0).getTime();
    const label = autoFormatTime(next, prev);
    expect(label).not.toContain(":");
  });

  it("large time jump within the same local day shows date + time", () => {
    // Simulates an overnight session gap (e.g. AAPL ET 16:00 → 09:30 next day,
    // which can fall on the same local calendar day when viewed cross-TZ).
    // Use local Date constructor so both times are the same calendar day in
    // the test runner's TZ, then make the jump big (18h).
    const prev = new Date(2026, 0, 15, 2, 0, 0).getTime(); // local 02:00
    const next = new Date(2026, 0, 15, 20, 0, 0).getTime(); // local 20:00, +18h
    const label = autoFormatTime(next, prev);
    // Must include a month name (anchoring context) + the time, not just HH:MM
    expect(label).toMatch(/[A-Z][a-z]{2}/);
    expect(label).toMatch(/\d{2}:\d{2}/);
  });
});

describe("formatVolume", () => {
  it("formats billions", () => {
    expect(formatVolume(1_500_000_000)).toBe("1.5B");
  });

  it("formats millions", () => {
    expect(formatVolume(7_200_000)).toBe("7.2M");
  });

  it("formats thousands", () => {
    expect(formatVolume(45_600)).toBe("45.6K");
  });

  it("formats small numbers as-is", () => {
    expect(formatVolume(999)).toBe("999");
  });

  it("handles NaN", () => {
    expect(formatVolume(Number.NaN)).toBe("—");
  });
});

describe("detectPrecision", () => {
  it("detects stock prices (2 decimals)", () => {
    expect(detectPrecision([150, 155, 148, 160])).toBe(2);
  });

  it("detects crypto prices (6+ decimals)", () => {
    expect(detectPrecision([0.0001, 0.0002, 0.00015])).toBe(6);
  });

  it("defaults to 2 for empty input", () => {
    expect(detectPrecision([])).toBe(2);
  });

  it("detects high-value assets (0 decimals)", () => {
    expect(detectPrecision([50000, 55000, 48000])).toBe(0);
  });

  it("detects FX prices (4 decimals)", () => {
    expect(detectPrecision([0.85, 0.86, 0.84])).toBe(4);
  });

  it("handles single-element array", () => {
    expect(detectPrecision([250])).toBe(2);
  });
});

describe("autoFormatPrice edge cases", () => {
  it("formats very large negative number", () => {
    expect(autoFormatPrice(-99999)).toBe("-99999");
  });

  it("formats exactly 1", () => {
    expect(autoFormatPrice(1)).toBe("1.000");
  });

  it("formats exactly 0.01", () => {
    expect(autoFormatPrice(0.01)).toBe("0.0100");
  });
});

describe("formatShortTime", () => {
  it("returns HH:MM 24h format", () => {
    const t = new Date(2026, 0, 15, 9, 30).getTime();
    expect(formatShortTime(t)).toBe("09:30");
  });
  it("pads hours and minutes", () => {
    const t = new Date(2026, 0, 15, 1, 5).getTime();
    expect(formatShortTime(t)).toBe("01:05");
  });
});

describe("formatShortDate", () => {
  it("returns month + day", () => {
    const t = new Date(2026, 2, 16, 10, 0).getTime();
    expect(formatShortDate(t)).toContain("16");
  });
  it("returns year when year boundary crossed", () => {
    const prev = new Date(2026, 11, 31).getTime();
    const cur = new Date(2027, 0, 1).getTime();
    expect(formatShortDate(cur, prev)).toBe("2027");
  });
});

describe("pickNiceStep", () => {
  const M = 60_000;
  const H = 60 * M;
  const D = 24 * H;

  it("picks 5m for short spans", () => {
    expect(pickNiceStep(30 * M, 6)).toBe(5 * M);
  });
  it("picks 15m for 2-hour span with 8 labels", () => {
    expect(pickNiceStep(2 * H, 8)).toBe(15 * M);
  });
  it("picks 1h for 8-hour span with 8 labels", () => {
    expect(pickNiceStep(8 * H, 8)).toBe(H);
  });
  it("picks 1 day for week-long span", () => {
    expect(pickNiceStep(7 * D, 7)).toBe(D);
  });
  it("gracefully handles edge cases", () => {
    expect(pickNiceStep(0, 10)).toBeGreaterThan(0);
    expect(pickNiceStep(100, 0)).toBeGreaterThan(0);
  });
});
