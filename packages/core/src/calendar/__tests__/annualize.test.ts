import { describe, expect, it } from "vitest";
import {
  CRYPTO_CALENDAR,
  FX_CALENDAR,
  HKEX_CALENDAR,
  JPX_CALENDAR,
  US_EQUITY_CALENDAR,
  annualizationFactor,
} from "../index";

describe("annualizationFactor", () => {
  it("defaults to 252 when no options are supplied", () => {
    expect(annualizationFactor()).toBe(252);
    expect(annualizationFactor({})).toBe(252);
  });

  it("honors periodsPerYear override", () => {
    expect(annualizationFactor({ periodsPerYear: 365 })).toBe(365);
    expect(annualizationFactor({ periodsPerYear: 52 })).toBe(52);
  });

  it("prefers calendar over periodsPerYear when both are provided", () => {
    expect(annualizationFactor({ calendar: JPX_CALENDAR, periodsPerYear: 999 })).toBe(
      JPX_CALENDAR.tradingDaysPerYear,
    );
  });

  it("resolves each preset to its documented value", () => {
    expect(annualizationFactor({ calendar: US_EQUITY_CALENDAR })).toBe(252);
    expect(annualizationFactor({ calendar: JPX_CALENDAR })).toBe(245);
    expect(annualizationFactor({ calendar: HKEX_CALENDAR })).toBe(247);
    expect(annualizationFactor({ calendar: CRYPTO_CALENDAR })).toBe(365);
    expect(annualizationFactor({ calendar: FX_CALENDAR })).toBe(260);
  });
});

describe("TradingCalendar preset shapes", () => {
  it("all presets are well-formed", () => {
    for (const cal of [
      US_EQUITY_CALENDAR,
      JPX_CALENDAR,
      HKEX_CALENDAR,
      CRYPTO_CALENDAR,
      FX_CALENDAR,
    ]) {
      expect(typeof cal.name).toBe("string");
      expect(cal.name.length).toBeGreaterThan(0);
      expect(cal.tradingDaysPerYear).toBeGreaterThan(0);
      expect(cal.tradingDaysPerYear).toBeLessThanOrEqual(365);
    }
  });

  it("does not ship holiday predicates by default (users supply their own)", () => {
    for (const cal of [US_EQUITY_CALENDAR, JPX_CALENDAR, CRYPTO_CALENDAR]) {
      expect(cal.isTradingDay).toBeUndefined();
    }
  });
});
