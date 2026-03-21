import { describe, expect, it } from "vitest";
import {
  accrueInterest,
  calculateBuyingPower,
  checkMarginCall,
  createMarginState,
  updateMarginState,
} from "../margin";

describe("createMarginState", () => {
  it("returns correct initial values for capital=10000, leverage=2", () => {
    const state = createMarginState(10000, 2);

    expect(state.equity).toBe(10000);
    expect(state.borrowedAmount).toBe(10000); // 10000 * (2 - 1)
    expect(state.marginRatio).toBe(1.0);
    expect(state.isMarginCall).toBe(false);
    expect(state.accumulatedInterest).toBe(0);
  });

  it("returns zero borrowedAmount when leverage is 1 (no leverage)", () => {
    const state = createMarginState(5000, 1);

    expect(state.equity).toBe(5000);
    expect(state.borrowedAmount).toBe(0);
  });

  it("calculates correct borrowedAmount for leverage=3", () => {
    const state = createMarginState(10000, 3);

    expect(state.borrowedAmount).toBe(20000); // 10000 * (3 - 1)
  });
});

describe("calculateBuyingPower", () => {
  it("returns capital * leverage", () => {
    expect(calculateBuyingPower(10000, 2)).toBe(20000);
  });

  it("returns capital when leverage is 1", () => {
    expect(calculateBuyingPower(10000, 1)).toBe(10000);
  });

  it("returns correct value for fractional leverage", () => {
    expect(calculateBuyingPower(10000, 1.5)).toBe(15000);
  });
});

describe("updateMarginState", () => {
  it("calculates equity correctly when position value changes", () => {
    const state = createMarginState(10000, 2);
    // Bought $20000, position now worth $18000
    const updated = updateMarginState(state, 18000, 10000);

    // equity = capital + positionValue - borrowedAmount - accumulatedInterest
    // equity = 10000 + 18000 - 10000 - 0 = 18000
    expect(updated.equity).toBe(18000);
  });

  it("calculates marginRatio as equity / positionValue", () => {
    const state = createMarginState(10000, 2);
    const updated = updateMarginState(state, 18000, 10000);

    // marginRatio = 18000 / 18000 = 1.0
    expect(updated.marginRatio).toBe(1.0);
  });

  it("reflects loss in equity when position drops", () => {
    const state = createMarginState(10000, 2);
    // Position dropped from $20000 to $15000
    const updated = updateMarginState(state, 15000, 10000);

    // equity = 10000 + 15000 - 10000 - 0 = 15000
    expect(updated.equity).toBe(15000);
    // marginRatio = 15000 / 15000 = 1.0
    expect(updated.marginRatio).toBe(1.0);
  });

  it("returns marginRatio=1.0 when positionValue is 0", () => {
    const state = createMarginState(10000, 2);
    const updated = updateMarginState(state, 0, 10000);

    expect(updated.marginRatio).toBe(1.0);
  });

  it("accounts for accumulatedInterest in equity", () => {
    const state = createMarginState(10000, 2);
    const stateWithInterest = { ...state, accumulatedInterest: 500 };
    const updated = updateMarginState(stateWithInterest, 20000, 10000);

    // equity = 10000 + 20000 - 10000 - 500 = 19500
    expect(updated.equity).toBe(19500);
    // marginRatio = 19500 / 20000 = 0.975
    expect(updated.marginRatio).toBe(0.975);
  });
});

describe("accrueInterest", () => {
  it("calculates correct interest for 1 day", () => {
    const state = createMarginState(10000, 2);
    const dailyRate = 0.05 / 365;
    const interest = accrueInterest(state, dailyRate, 1);

    // borrowedAmount=10000, dailyRate≈0.000136986, days=1
    expect(interest).toBeCloseTo(10000 * (0.05 / 365), 10);
  });

  it("scales linearly with number of days", () => {
    const state = createMarginState(10000, 2);
    const dailyRate = 0.05 / 365;

    const oneDay = accrueInterest(state, dailyRate, 1);
    const sevenDays = accrueInterest(state, dailyRate, 7);

    expect(sevenDays).toBeCloseTo(oneDay * 7, 10);
  });

  it("returns 0 when borrowedAmount is 0 (no leverage)", () => {
    const state = createMarginState(10000, 1);
    const interest = accrueInterest(state, 0.05 / 365, 1);

    expect(interest).toBe(0);
  });
});

describe("checkMarginCall", () => {
  it("returns true when marginRatio < maintenanceMargin", () => {
    const state = createMarginState(10000, 2);
    const updated = { ...state, marginRatio: 0.2 };

    expect(checkMarginCall(updated, 0.25)).toBe(true);
  });

  it("returns false when marginRatio > maintenanceMargin", () => {
    const state = createMarginState(10000, 2);
    const updated = { ...state, marginRatio: 0.5 };

    expect(checkMarginCall(updated, 0.25)).toBe(false);
  });

  it("returns false when marginRatio equals maintenanceMargin", () => {
    const state = createMarginState(10000, 2);
    const updated = { ...state, marginRatio: 0.25 };

    expect(checkMarginCall(updated, 0.25)).toBe(false);
  });
});
