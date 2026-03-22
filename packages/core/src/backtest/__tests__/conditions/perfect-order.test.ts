import { describe, expect, it } from "vitest";
import {
  evaluateCondition,
  perfectOrderActiveBearish,
  perfectOrderActiveBullish,
  perfectOrderBearish,
  perfectOrderBullish,
  perfectOrderCollapsed,
} from "../../conditions";
import {
  generateStrongDowntrend,
  generateStrongUptrend,
  generateSustainedUptrend,
  generateTrendReversal,
} from "./test-helpers";

describe("perfectOrderBullish()", () => {
  it("should create a valid preset condition", () => {
    const condition = perfectOrderBullish();
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("perfectOrderBullish");
  });

  it("should detect bullish perfect order formation", () => {
    const candles = generateStrongUptrend(150);
    const condition = perfectOrderBullish({ periods: [5, 10, 20] });
    const indicators: Record<string, unknown> = {};

    // Find if there's a formation
    let foundFormation = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        foundFormation = true;
        break;
      }
    }

    expect(foundFormation).toBe(true);
  });

  it("should respect minStrength option", () => {
    const candles = generateStrongUptrend(150);
    const weakCondition = perfectOrderBullish({ periods: [5, 10, 20], minStrength: 0 });
    const strongCondition = perfectOrderBullish({ periods: [5, 10, 20], minStrength: 80 });
    const indicators: Record<string, unknown> = {};

    let weakFormations = 0;
    let strongFormations = 0;

    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(weakCondition, {}, candles[i], i, candles)) {
        weakFormations++;
      }
      if (evaluateCondition(strongCondition, indicators, candles[i], i, candles)) {
        strongFormations++;
      }
    }

    // Strong formations should be less than or equal to weak ones
    expect(strongFormations).toBeLessThanOrEqual(weakFormations);
  });
});

describe("perfectOrderBearish()", () => {
  it("should create a valid preset condition", () => {
    const condition = perfectOrderBearish();
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("perfectOrderBearish");
  });

  it("should detect bearish perfect order formation", () => {
    const candles = generateStrongDowntrend(150);
    const condition = perfectOrderBearish({ periods: [5, 10, 20] });
    const indicators: Record<string, unknown> = {};

    // Find if there's a formation
    let foundFormation = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        foundFormation = true;
        break;
      }
    }

    expect(foundFormation).toBe(true);
  });
});

describe("perfectOrderCollapsed()", () => {
  it("should create a valid preset condition", () => {
    const condition = perfectOrderCollapsed();
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("perfectOrderCollapsed");
  });

  it("should detect perfect order collapse after reversal", () => {
    const candles = generateTrendReversal(200);
    const condition = perfectOrderCollapsed({ periods: [5, 10, 20] });
    const indicators: Record<string, unknown> = {};

    // Find if there's a collapse in the reversal period (collapse happens shortly after reversal starts)
    let foundCollapse = false;
    for (let i = 80; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        foundCollapse = true;
        break;
      }
    }

    expect(foundCollapse).toBe(true);
  });
});

describe("perfectOrderActiveBullish()", () => {
  it("should create a valid preset condition", () => {
    const condition = perfectOrderActiveBullish();
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("perfectOrderActiveBullish");
  });

  it("should return true while bullish perfect order is active", () => {
    const candles = generateSustainedUptrend(100);
    const condition = perfectOrderActiveBullish({ periods: [5, 10, 20] });
    const indicators: Record<string, unknown> = {};

    // After MA convergence, should stay true
    let activeCount = 0;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        activeCount++;
      }
    }

    // Most of the later candles should have active bullish PO
    expect(activeCount).toBeGreaterThan(30);
  });
});

describe("perfectOrderActiveBearish()", () => {
  it("should create a valid preset condition", () => {
    const condition = perfectOrderActiveBearish();
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("perfectOrderActiveBearish");
  });
});
