import { describe, expect, it } from "vitest";
import { atrBasedSize } from "../atr-based";
import { fixedFractionalSize } from "../fixed-fractional";
import { kellySize } from "../kelly";
import { riskBasedSize } from "../risk-based";
import { applyConstraints, validateInputs } from "../utils";

// =============================================================================
// riskBasedSize edge cases
// =============================================================================

describe("riskBasedSize edge cases", () => {
  it("should throw when riskPercent is 0", () => {
    expect(() =>
      riskBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        riskPercent: 0,
        stopLossPrice: 48,
      }),
    ).toThrow("riskPercent must be between 0 and 100");
  });

  it("should throw when riskPercent is negative", () => {
    expect(() =>
      riskBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        riskPercent: -1,
        stopLossPrice: 48,
      }),
    ).toThrow("riskPercent must be between 0 and 100");
  });

  it("should throw when stopLoss equals entryPrice for long", () => {
    expect(() =>
      riskBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        riskPercent: 1,
        stopLossPrice: 50,
        direction: "long",
      }),
    ).toThrow("stopLossPrice must be below entryPrice");
  });

  it("should throw when stopLoss is above entryPrice for long", () => {
    expect(() =>
      riskBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        riskPercent: 1,
        stopLossPrice: 52,
        direction: "long",
      }),
    ).toThrow("stopLossPrice must be below entryPrice");
  });

  it("should throw when stopLoss is below entryPrice for short", () => {
    expect(() =>
      riskBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        riskPercent: 1,
        stopLossPrice: 48,
        direction: "short",
      }),
    ).toThrow("stopLossPrice must be above entryPrice");
  });

  it("should constrain by maxPositionPercent with tiny stop distance", () => {
    const result = riskBasedSize({
      accountSize: 100000,
      entryPrice: 50,
      riskPercent: 2,
      stopLossPrice: 49.99, // tiny stop distance: $0.01
      maxPositionPercent: 10,
    });
    // maxPositionPercent=10 → max $10,000 position → max 200 shares at $50
    expect(result.shares).toBeLessThanOrEqual(200);
    expect(result.positionValue).toBeLessThanOrEqual(10000);
  });

  it("should handle short direction correctly", () => {
    const result = riskBasedSize({
      accountSize: 100000,
      entryPrice: 50,
      riskPercent: 1,
      stopLossPrice: 52,
      direction: "short",
    });
    expect(result.shares).toBeGreaterThan(0);
    expect(result.stopPrice).toBe(52);
  });

  it("should throw on accountSize <= 0", () => {
    expect(() =>
      riskBasedSize({
        accountSize: 0,
        entryPrice: 50,
        riskPercent: 1,
        stopLossPrice: 48,
      }),
    ).toThrow("accountSize must be positive");
  });

  it("should throw on entryPrice <= 0", () => {
    expect(() =>
      riskBasedSize({
        accountSize: 100000,
        entryPrice: 0,
        riskPercent: 1,
        stopLossPrice: -2,
      }),
    ).toThrow("entryPrice must be positive");
  });
});

// =============================================================================
// atrBasedSize edge cases
// =============================================================================

describe("atrBasedSize edge cases", () => {
  it("should throw when atrMultiplier is 0", () => {
    expect(() =>
      atrBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        riskPercent: 1,
        atrValue: 2.5,
        atrMultiplier: 0,
      }),
    ).toThrow("atrMultiplier must be positive");
  });

  it("should throw when atrMultiplier is negative", () => {
    expect(() =>
      atrBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        riskPercent: 1,
        atrValue: 2.5,
        atrMultiplier: -1,
      }),
    ).toThrow("atrMultiplier must be positive");
  });

  it("should throw when atrValue is 0", () => {
    expect(() =>
      atrBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        riskPercent: 1,
        atrValue: 0,
        atrMultiplier: 2,
      }),
    ).toThrow("atrValue must be positive");
  });

  it("should produce small position when ATR > entryPrice", () => {
    const result = atrBasedSize({
      accountSize: 100000,
      entryPrice: 50,
      riskPercent: 1,
      atrValue: 60, // ATR greater than entry price
      atrMultiplier: 2,
    });
    // stopDistance = 60*2=120, riskAmount=1000, rawShares=1000/120≈8.3→8
    expect(result.shares).toBeLessThanOrEqual(10);
  });

  it("should set correct stopPrice for long direction", () => {
    const result = atrBasedSize({
      accountSize: 100000,
      entryPrice: 50,
      riskPercent: 1,
      atrValue: 2.5,
      atrMultiplier: 2,
      direction: "long",
    });
    expect(result.stopPrice).toBe(45); // 50 - 2.5*2
  });

  it("should set correct stopPrice for short direction", () => {
    const result = atrBasedSize({
      accountSize: 100000,
      entryPrice: 50,
      riskPercent: 1,
      atrValue: 2.5,
      atrMultiplier: 2,
      direction: "short",
    });
    expect(result.stopPrice).toBe(55); // 50 + 2.5*2
  });
});

// =============================================================================
// kellySize edge cases
// =============================================================================

describe("kellySize edge cases", () => {
  it("should return 0 shares when winRate is 0", () => {
    const result = kellySize({
      accountSize: 100000,
      entryPrice: 50,
      winRate: 0,
      winLossRatio: 1.5,
    });
    // Kelly = 0 - 1/1.5 = -0.667, clamp to 0 → 0 shares
    expect(result.shares).toBe(0);
  });

  it("should respect maxKellyPercent when winRate is 1", () => {
    const result = kellySize({
      accountSize: 100000,
      entryPrice: 50,
      winRate: 1,
      winLossRatio: 1.5,
      kellyFraction: 1,
      maxKellyPercent: 25,
    });
    // Full Kelly = 100%, capped at 25%
    expect(result.positionValue).toBeLessThanOrEqual(25000);
  });

  it("should throw when kellyFraction is 0", () => {
    expect(() =>
      kellySize({
        accountSize: 100000,
        entryPrice: 50,
        winRate: 0.6,
        winLossRatio: 1.5,
        kellyFraction: 0,
      }),
    ).toThrow("kellyFraction must be between 0 and 1");
  });

  it("should throw when kellyFraction > 1", () => {
    expect(() =>
      kellySize({
        accountSize: 100000,
        entryPrice: 50,
        winRate: 0.6,
        winLossRatio: 1.5,
        kellyFraction: 1.5,
      }),
    ).toThrow("kellyFraction must be between 0 and 1");
  });

  it("should throw when winRate < 0", () => {
    expect(() =>
      kellySize({
        accountSize: 100000,
        entryPrice: 50,
        winRate: -0.1,
        winLossRatio: 1.5,
      }),
    ).toThrow("winRate must be between 0 and 1");
  });

  it("should throw when winRate > 1", () => {
    expect(() =>
      kellySize({
        accountSize: 100000,
        entryPrice: 50,
        winRate: 1.1,
        winLossRatio: 1.5,
      }),
    ).toThrow("winRate must be between 0 and 1");
  });

  it("should throw when winLossRatio <= 0", () => {
    expect(() =>
      kellySize({
        accountSize: 100000,
        entryPrice: 50,
        winRate: 0.6,
        winLossRatio: 0,
      }),
    ).toThrow("winLossRatio must be positive");
  });

  it("should return 0 shares for negative Kelly (bad edge)", () => {
    const result = kellySize({
      accountSize: 100000,
      entryPrice: 50,
      winRate: 0.2, // Low win rate
      winLossRatio: 0.5, // Small wins vs losses
    });
    // Kelly = 0.2 - 0.8/0.5 = 0.2 - 1.6 = -1.4 → clamped to 0
    expect(result.shares).toBe(0);
  });
});

// =============================================================================
// fixedFractionalSize edge cases
// =============================================================================

describe("fixedFractionalSize edge cases", () => {
  it("should throw when fractionPercent is 0", () => {
    expect(() =>
      fixedFractionalSize({
        accountSize: 100000,
        entryPrice: 50,
        fractionPercent: 0,
      }),
    ).toThrow("fractionPercent must be between 0 and 100");
  });

  it("should throw when fractionPercent > 100", () => {
    expect(() =>
      fixedFractionalSize({
        accountSize: 100000,
        entryPrice: 50,
        fractionPercent: 101,
      }),
    ).toThrow("fractionPercent must be between 0 and 100");
  });

  it("should use full account at fractionPercent=100", () => {
    const result = fixedFractionalSize({
      accountSize: 100000,
      entryPrice: 50,
      fractionPercent: 100,
    });
    expect(result.shares).toBe(2000);
    expect(result.positionValue).toBe(100000);
  });

  it("should return 0 shares when tiny fraction cannot meet minShares", () => {
    const result = fixedFractionalSize({
      accountSize: 100,
      entryPrice: 50,
      fractionPercent: 1, // $1 position → 0 shares after rounding
      minShares: 5,
    });
    // rawShares = 1/50 = 0.02 → 0 after floor → < minShares(5) → 0
    expect(result.shares).toBe(0);
  });

  it("should respect maxPositionPercent constraint", () => {
    const result = fixedFractionalSize({
      accountSize: 100000,
      entryPrice: 50,
      fractionPercent: 50,
      maxPositionPercent: 20,
    });
    // maxPosition=$20,000 → 400 shares
    expect(result.shares).toBeLessThanOrEqual(400);
  });
});

// =============================================================================
// applyConstraints edge cases
// =============================================================================

describe("applyConstraints edge cases", () => {
  it("should return 0 for negative shares", () => {
    const result = applyConstraints(-10, 50, 100000, {});
    expect(result).toBe(0);
  });

  it("should return 0 when shares are 0", () => {
    const result = applyConstraints(0, 50, 100000, {});
    expect(result).toBe(0);
  });

  it("should return 0 when below minShares", () => {
    const result = applyConstraints(3, 50, 100000, { minShares: 5 });
    expect(result).toBe(0);
  });

  it("should cap by maxPositionPercent", () => {
    const result = applyConstraints(1000, 50, 100000, { maxPositionPercent: 10 });
    // max = 100000 * 0.10 / 50 = 200
    expect(result).toBe(200);
  });

  it("should floor shares when roundShares is true", () => {
    const result = applyConstraints(10.7, 50, 100000, { roundShares: true });
    expect(result).toBe(10);
  });

  it("should not floor shares when roundShares is false", () => {
    const result = applyConstraints(10.7, 50, 100000, { roundShares: false });
    expect(result).toBe(10.7);
  });
});

// =============================================================================
// validateInputs edge cases
// =============================================================================

describe("validateInputs edge cases", () => {
  it("should throw for accountSize = 0", () => {
    expect(() => validateInputs(0, 50, "test")).toThrow("accountSize must be positive");
  });

  it("should throw for negative accountSize", () => {
    expect(() => validateInputs(-100, 50, "test")).toThrow("accountSize must be positive");
  });

  it("should throw for entryPrice = 0", () => {
    expect(() => validateInputs(100000, 0, "test")).toThrow("entryPrice must be positive");
  });

  it("should throw for negative entryPrice", () => {
    expect(() => validateInputs(100000, -50, "test")).toThrow("entryPrice must be positive");
  });

  it("should not throw for valid inputs", () => {
    expect(() => validateInputs(100000, 50, "test")).not.toThrow();
  });
});
