/**
 * Margin interest is charged for the time a loan is outstanding.
 *
 * It used to be charged in whole days with a floor of one:
 * `Math.max(1, Math.round((exit - entry) / MS_PER_DAY))`. On intraday bars
 * that made the bill a function of TRADE COUNT rather than time held — every
 * round trip paid a full overnight even though nothing was held overnight —
 * and the rounding distorted multi-day holds in both directions.
 *
 * Expectations are expressed as multiples of a measured one-day charge rather
 * than a hand-computed loan figure: what matters here is that the bill is
 * proportional to elapsed time, not what the engine borrows or how it rounds.
 */

import { describe, expect, it } from "vitest";
import type { ConditionFn, NormalizedCandle } from "../../types";
import { runBacktest } from "../engine";

const CAPITAL = 1_000_000;
const MARGIN = {
  leverage: 2,
  maintenanceMargin: 0.25,
  marginCallAction: "liquidate" as const,
  interestRate: 0.05,
};
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const BASE_TIME = 1_700_000_000_000;

/** Flat candles at a fixed interval, so trade P&L is exactly zero. */
function flatCandles(count: number, intervalMs: number, price = 100): NormalizedCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: BASE_TIME + i * intervalMs,
    open: price,
    high: price + 1,
    low: price - 1,
    close: price,
    volume: 1_000_000,
  }));
}

const at =
  (...indices: number[]): ConditionFn =>
  (_ind, _candle, i) =>
    indices.includes(i);

/** Interest deducted by a run — the only way capital moves on a flat series. */
function charged(candles: NormalizedCandle[], entry: ConditionFn, exit: ConditionFn): number {
  const result = runBacktest(candles, entry, exit, { capital: CAPITAL, margin: MARGIN });
  return CAPITAL - result.finalCapital;
}

const HOURLY = flatCandles(200, MS_PER_HOUR);

/**
 * One day of interest on the loan this configuration takes, measured rather
 * than derived. `finalCapital` is rounded to cents once, on the way out, so
 * reading a single day back carries a rounding error that multiplying
 * amplifies. Taking a hundred-day reference and dividing by its OBSERVED
 * holding time makes the unit exact and assumes nothing about how much the
 * engine borrows.
 */
const DAY = (() => {
  const reference = runBacktest(flatCandles(120, MS_PER_DAY), at(1), at(101), {
    capital: CAPITAL,
    margin: MARGIN,
  });
  const trade = reference.trades[0];
  const days = (trade.exitTime - trade.entryTime) / MS_PER_DAY;
  return (CAPITAL - reference.finalCapital) / days;
})();

describe("margin interest is proportional to time held", () => {
  it("charges a measurable, exactly-daily amount as the baseline", () => {
    // Anchors every expectation below. 1M capital at 2x borrows ~1M; a year
    // at 5% is ~50,000, so a day is ~137.
    expect(DAY).toBeCloseTo(136.99, 1);
  });

  it.each([
    [1, 1 / 24],
    [2, 2 / 24],
    [4, 4 / 24],
    [12, 12 / 24],
  ])("bills a %i-hour hold for %f of a day", (hours, days) => {
    // Every one of these used to cost a full day: 136.99.
    expect(charged(HOURLY, at(10), at(10 + hours))).toBeCloseTo(DAY * days, 2);
  });

  it("doubles the bill when the hold doubles", () => {
    // `finalCapital` is reported to the cent, which puts a floor on how exact
    // this can be: an 11.42 bill is 0.0004 off its unrounded value, so the
    // ratio lands within ~0.1%.
    const bills = [2, 4, 8, 16].map((h) => charged(HOURLY, at(10), at(10 + h)));
    for (let i = 1; i < bills.length; i++) {
      expect(bills[i] / bills[i - 1]).toBeCloseTo(2, 2);
    }
  });
});

describe("the bill follows time held, not the number of trades", () => {
  it("bills 99 ten-minute round trips for the ten minutes each", () => {
    // 400 five-minute bars = 33.3 hours of wall clock. Entering every 4 bars
    // and exiting 2 bars later gives 99 round trips of 10 minutes.
    const candles = flatCandles(400, 5 * 60_000);
    const result = runBacktest(
      candles,
      (_ind, _candle, i) => i % 4 === 0,
      (_ind, _candle, i) => i % 4 === 2,
      { capital: CAPITAL, margin: MARGIN },
    );

    expect(result.trades.length).toBe(99);
    const heldMs = result.trades.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0);
    expect(heldMs).toBe(99 * 10 * 60_000);

    const bill = CAPITAL - result.finalCapital;
    expect(bill).toBeCloseTo(DAY * (heldMs / MS_PER_DAY), 1);
    // Before the fix: 13,471.02 — a full day per trade, ~143x the honest bill.
    expect(bill).toBeLessThan(100);
  });

  it("charges the same total whether the time is held in one trade or many", () => {
    // Twelve hours as one hold, versus the same twelve hours split in three.
    const one = charged(HOURLY, at(10), at(22));
    const many = charged(
      HOURLY,
      (_i, _c, i) => i === 10 || i === 30 || i === 50,
      (_i, _c, i) => i === 14 || i === 34 || i === 54,
    );
    expect(many).toBeCloseTo(one, 1);
  });
});

describe("rounding no longer distorts multi-day holds", () => {
  it("bills a 34-hour hold for 34 hours, where rounding UNDER-charged a day", () => {
    const bill = charged(HOURLY, at(10), at(44));
    expect(bill).toBeCloseTo(DAY * (34 / 24), 2);
    expect(bill).toBeCloseTo(194.06, 2); // Math.round billed 136.99
    expect(bill).toBeGreaterThan(DAY);
  });

  it("bills a 38-hour hold for 38 hours, where rounding OVER-charged two days", () => {
    const bill = charged(HOURLY, at(10), at(48));
    expect(bill).toBeCloseTo(DAY * (38 / 24), 2);
    expect(bill).toBeCloseTo(216.89, 2); // Math.round billed 273.97
    expect(bill).toBeLessThan(DAY * 2);
  });
});

describe("partial exits pay for their own time", () => {
  /** Flat at 100, then 110 from `jumpAt` — enough to trip a scale-out level. */
  function risingCandles(count: number, jumpAt: number): NormalizedCandle[] {
    return Array.from({ length: count }, (_, i) => {
      const price = i >= jumpAt ? 110 : 100;
      return {
        time: BASE_TIME + i * MS_PER_HOUR,
        open: price,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1_000_000,
      };
    });
  }

  const RISING = risingCandles(200, 16);
  const SCALE_OUT = { levels: [{ threshold: 1, sellPercent: 50 }] };

  it("bills each tranche for the balance outstanding while it was", () => {
    const whole = runBacktest(RISING, at(10), at(34), { capital: CAPITAL, margin: MARGIN });
    const split = runBacktest(RISING, at(10), at(34), {
      capital: CAPITAL,
      margin: MARGIN,
      scaleOut: SCALE_OUT,
    });

    // The level must actually fire, or this compares two identical runs.
    expect(whole.trades.length).toBe(1);
    expect(split.trades.length).toBe(2);
    expect(split.trades.map((t) => t.exitReason)).toEqual(["scaleOut", "signal"]);
    expect(split.trades.map((t) => (t.exitTime - t.entryTime) / MS_PER_HOUR)).toEqual([5, 24]);

    // Interest is the only thing separating them: with the rate at zero both
    // runs end on the same capital.
    const free = (options: object) =>
      runBacktest(RISING, at(10), at(34), {
        capital: CAPITAL,
        margin: { ...MARGIN, interestRate: 0 },
        ...options,
      }).finalCapital;
    expect(free({})).toBeCloseTo(free({ scaleOut: SCALE_OUT }), 6);

    const wholeBill = free({}) - whole.finalCapital;
    const splitBill = free({ scaleOut: SCALE_OUT }) - split.finalCapital;

    // Halving the loan five hours in must cost LESS than carrying it whole for
    // twenty-four — the loan-weighted integral, not a flat per-window charge:
    //   full balance for 5h  +  half balance for the remaining 19h
    const loanDays = 5 / 24 + 0.5 * (19 / 24);
    expect(splitBill).toBeCloseTo(DAY * loanDays, 1);
    expect(splitBill).toBeLessThan(wholeBill);
  });
});

describe("a non-monotonic exit time cannot produce a credit", () => {
  it("charges zero rather than negative interest", () => {
    // Candle times are caller-supplied; an exit stamped before its entry
    // would otherwise hand the account free money.
    const candles = flatCandles(60, MS_PER_HOUR).map((c, i) =>
      i === 40 ? { ...c, time: BASE_TIME - MS_PER_DAY } : c,
    );
    expect(charged(candles, at(10), at(39))).toBeCloseTo(0, 6);
  });
});

describe("whole-day holds are unchanged", () => {
  it("bills an exact-day hold exactly as before", () => {
    // Math.round was exact for whole-day holds, which is why the existing
    // interest tests never caught this.
    //
    // Note what this does NOT claim: daily bars are not universally
    // unchanged. A bar stamped in an exchange timezone is 23 or 25 hours long
    // across a DST transition, and a same-bar-close fill can exit on the bar
    // it entered — a zero-length hold, which used to be billed a full day.
    const daily = flatCandles(40, MS_PER_DAY);
    expect(charged(daily, at(10), at(15))).toBeCloseTo(DAY * 5, 2);
  });

  it("charges nothing when no interest rate is configured", () => {
    const candles = flatCandles(400, 5 * 60_000);
    const { interestRate: _rate, ...noInterest } = MARGIN;
    const result = runBacktest(
      candles,
      (_ind, _candle, i) => i % 4 === 0,
      (_ind, _candle, i) => i % 4 === 2,
      { capital: CAPITAL, margin: noInterest },
    );
    expect(result.finalCapital).toBeCloseTo(CAPITAL, 6);
  });

  it("charges nothing for a hold that opens and closes on the same bar", () => {
    // `fillMode: "same-bar-close"` with a limit order lets a position fill and
    // exit within one bar. Zero elapsed time is zero interest; the old floor
    // billed a full day even here.
    const daily = flatCandles(30, MS_PER_DAY).map((c, i) =>
      i === 11 ? { ...c, open: 100, high: 101, low: 80, close: 85 } : c,
    );
    const result = runBacktest(daily, at(10), () => false, {
      capital: CAPITAL,
      margin: MARGIN,
      fillMode: "same-bar-close",
      orderType: { type: "limit", price: 100 },
      stopLoss: 5,
    });
    const sameBar = result.trades.find((t) => t.exitTime === t.entryTime);
    expect(sameBar).toBeDefined();
    // The whole position is lost to the stop. `700_000` exactly means interest
    // added nothing on top; the old floor made it 699,863.01.
    expect(result.finalCapital).toBeCloseTo(700_000, 2);
  });

  it("charges nothing when the position is never opened", () => {
    const never: ConditionFn = () => false;
    expect(charged(HOURLY, never, never)).toBeCloseTo(0, 6);
  });
});
