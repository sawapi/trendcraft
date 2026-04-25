/**
 * Integration tests: verify annualization wiring actually changes downstream
 * metrics (Sharpe, GARCH forecast, Ulcer Performance Index, etc.) when the
 * calendar is swapped.
 */

import { describe, expect, it } from "vitest";
import { ewmaVolatility, garch } from "../../indicators/volatility/garch";
import { ulcerPerformanceIndex } from "../../risk/drawdown-analysis";
import { calculateMetricsFromReturns } from "../../risk/stress-test";
import { CRYPTO_CALENDAR, JPX_CALENDAR, US_EQUITY_CALENDAR } from "../index";

function syntheticReturns(n = 200, seed = 1): number[] {
  let s = seed;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return Array.from({ length: n }, () => (r() - 0.48) * 0.02);
}

describe("calendar integration: stress-test metrics", () => {
  const returns = syntheticReturns(250, 11);

  it("defaults to US (252) when no calendar is provided", () => {
    const us = calculateMetricsFromReturns(returns, { calendar: US_EQUITY_CALENDAR });
    const def = calculateMetricsFromReturns(returns);
    expect(def.sharpe).toBeCloseTo(us.sharpe, 12);
  });

  it("crypto (365) produces a larger-magnitude Sharpe than US (252)", () => {
    const us = calculateMetricsFromReturns(returns, { calendar: US_EQUITY_CALENDAR });
    const crypto = calculateMetricsFromReturns(returns, { calendar: CRYPTO_CALENDAR });
    // Sharpe scales with sqrt(N); sqrt(365)/sqrt(252) ~ 1.203
    expect(Math.abs(crypto.sharpe)).toBeGreaterThan(Math.abs(us.sharpe));
    expect(Math.abs(crypto.sharpe) / Math.abs(us.sharpe)).toBeCloseTo(Math.sqrt(365 / 252), 2);
  });

  it("totalReturn / maxDrawdown do not depend on the calendar", () => {
    const us = calculateMetricsFromReturns(returns, { calendar: US_EQUITY_CALENDAR });
    const jpx = calculateMetricsFromReturns(returns, { calendar: JPX_CALENDAR });
    expect(us.totalReturn).toBe(jpx.totalReturn);
    expect(us.maxDrawdown).toBe(jpx.maxDrawdown);
  });
});

describe("calendar integration: GARCH / EWMA forecasts", () => {
  const returns = syntheticReturns(300, 42);

  it("GARCH forecast scales by sqrt(periodsPerYear)", () => {
    const us = garch(returns, { calendar: US_EQUITY_CALENDAR });
    const crypto = garch(returns, { calendar: CRYPTO_CALENDAR });
    // Forecast is sqrt(variance) * sqrt(N) * 100 — ratio should match sqrt factor
    expect(crypto.volatilityForecast / us.volatilityForecast).toBeCloseTo(Math.sqrt(365 / 252), 4);
  });

  it("EWMA volatility scales by sqrt(periodsPerYear)", () => {
    const us = ewmaVolatility(returns, { calendar: US_EQUITY_CALENDAR });
    const crypto = ewmaVolatility(returns, { calendar: CRYPTO_CALENDAR });
    for (let i = 10; i < us.length; i += 20) {
      if (us[i].value > 0) {
        expect(crypto[i].value / us[i].value).toBeCloseTo(Math.sqrt(365 / 252), 4);
      }
    }
  });

  it("default (no calendar) equals US explicit", () => {
    const def = garch(returns);
    const us = garch(returns, { calendar: US_EQUITY_CALENDAR });
    expect(def.volatilityForecast).toBeCloseTo(us.volatilityForecast, 8);
  });
});

describe("calendar integration: Ulcer Performance Index", () => {
  const equity = Array.from({ length: 120 }, (_, i) => {
    // Drifting upward curve with some pullbacks
    const base = 100 * (1 + 0.001 * i);
    const pullback = Math.max(0, Math.sin(i / 4)) * 2;
    return base - pullback;
  });

  it("JPX (245) produces a slightly smaller UPI than US (252) on the same curve", () => {
    const us = ulcerPerformanceIndex(equity, 0, { calendar: US_EQUITY_CALENDAR });
    const jpx = ulcerPerformanceIndex(equity, 0, { calendar: JPX_CALENDAR });
    // UPI's annualized return uses (1+r)^(N/n); higher N → larger exponent → larger UPI for positive r
    expect(us).toBeGreaterThan(jpx);
  });
});
