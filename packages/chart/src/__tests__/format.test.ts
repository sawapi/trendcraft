import { describe, expect, it } from "vitest";
import {
  autoFormatPrice,
  autoFormatTime,
  detectPrecision,
  formatShortDate,
  formatShortTime,
  formatVolume,
  pickNiceStep,
  tickPriceFormatter,
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

  it("preserves genuinely tiny values (the formatter is reused outside axis ticks — crosshair / overlay / drawings — where rewriting them as 0 would lose data)", () => {
    expect(autoFormatPrice(1e-12)).toBe("0.00000000");
    expect(autoFormatPrice(1e-9)).toBe("0.00000000");
  });
});

describe("autoFormatPrice from a million up", () => {
  // Crosshair, badges and legend show the exact price; only axis ticks shorten.
  it("keeps every digit", () => {
    expect(autoFormatPrice(15_234_567)).toBe("15234567");
  });
});

describe("tickPriceFormatter from a million up", () => {
  it("labels every tick with the largest tick's unit", () => {
    const ticks = [0, 2e10, 4e10, 6e10, 8e10, 1e11, 1.2e11, 1.4e11];
    const fmt = tickPriceFormatter(ticks);
    expect(ticks.map(fmt)).toEqual(["0", "20B", "40B", "60B", "80B", "100B", "120B", "140B"]);
  });

  it("keeps the decimals the step needs", () => {
    const fmt = tickPriceFormatter([1_000_000, 1_100_000, 1_200_000]);
    expect(fmt(1_100_000)).toBe("1.1M");
  });

  it("keeps full digits when the unit would make labels longer", () => {
    const fmt = tickPriceFormatter([1_234_520, 1_234_540, 1_234_560]);
    expect(fmt(1_234_540)).toBe("1234540");
  });
});

describe("tickPriceFormatter on a log axis", () => {
  it("labels each tick with its own digits and unit", () => {
    const ticks = [0.01, 0.1, 1, 10, 100];
    expect(ticks.map(tickPriceFormatter(ticks, true))).toEqual(["0.01", "0.1", "1", "10", "100"]);
    const big = [1, 100, 1e4, 1e6, 1e8, 1e10];
    expect(big.map(tickPriceFormatter(big, true))).toEqual([
      "1",
      "100",
      "10000",
      "1M",
      "100M",
      "10B",
    ]);
  });

  it("keeps shared decimals for linear fallback ticks", () => {
    const ticks = [1.2, 1.25, 1.3];
    expect(ticks.map(tickPriceFormatter(ticks, true))).toEqual(["1.20", "1.25", "1.30"]);
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

  it("first label of a daily series omits the wall-clock time artifact", () => {
    // A daily bar stamped at 00:00 UTC renders as 09:00 in a +09:00 TZ. With a
    // daily interval hint the first label must stay a bare date, not "09:00".
    const DAY = 24 * 60 * 60 * 1000;
    const label = autoFormatTime(day1, null, DAY);
    expect(label).not.toContain(":");
    expect(label).toContain("Jan");
    expect(label).toContain("15");
  });

  it("first label of an intraday series keeps the wall-clock time", () => {
    // intraday1 is 10:30 UTC; with a 1h interval hint the time must survive
    // (in TZs where 10:30 UTC is not local midnight).
    const HOUR = 60 * 60 * 1000;
    const label = autoFormatTime(intraday1, null, HOUR);
    const localMidnight =
      new Date(intraday1).getHours() === 0 && new Date(intraday1).getMinutes() === 0;
    if (!localMidnight) expect(label).toMatch(/\d{2}:\d{2}/);
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
    expect(formatVolume(0)).toBe("0");
  });

  it("keeps fractional volume below 1,000", () => {
    expect(formatVolume(0.3)).toBe("0.3");
    expect(formatVolume(0.5)).toBe("0.5");
    expect(formatVolume(12.5)).toBe("12.5");
    expect(formatVolume(123.456)).toBe("123");
    expect(formatVolume(0.000123456)).toBe("0.000123");
    expect(formatVolume(9.996)).toBe("10");
    expect(formatVolume(-0.25)).toBe("-0.25");
  });

  it("never prints an exponent", () => {
    expect(formatVolume(2.5e-7)).toBe("0.00000025");
    expect(formatVolume(1.23456e-12)).toBe("0.00000000000123");
  });

  it("moves to the next unit when rounding reaches 1,000", () => {
    expect(formatVolume(999.6)).toBe("1.0K");
    expect(formatVolume(999_949)).toBe("999.9K");
    expect(formatVolume(999_960)).toBe("1.0M");
    expect(formatVolume(999_960_000)).toBe("1.0B");
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

  it("leaves the caller's array in its order", () => {
    const prices = [160, 148, 155, 150];
    detectPrecision(prices);
    expect(prices).toEqual([160, 148, 155, 150]);
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
