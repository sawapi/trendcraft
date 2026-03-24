import { describe, expect, it } from "vitest";
import { autoFormatPrice, autoFormatTime, detectPrecision, formatVolume } from "../core/format";

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
    expect(autoFormatPrice(0)).toBe("0.00000000");
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
});
