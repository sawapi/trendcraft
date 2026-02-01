import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { perBelow, perAbove, perBetween, pbrBelow, pbrAbove, pbrBetween } from "../fundamentals";

// Helper to create a mock candle
function createCandle(time = 1000): NormalizedCandle {
  return {
    time,
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 1000000,
  };
}

describe("perBelow", () => {
  it("should return true when PER is below threshold", () => {
    const condition = perBelow(15);
    const indicators: Record<string, unknown> = { per: 12.5 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(true);
  });

  it("should return false when PER is above threshold", () => {
    const condition = perBelow(15);
    const indicators: Record<string, unknown> = { per: 20 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should return false when PER equals threshold", () => {
    const condition = perBelow(15);
    const indicators: Record<string, unknown> = { per: 15 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should return false when PER is null", () => {
    const condition = perBelow(15);
    const indicators: Record<string, unknown> = { per: null };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should return false when PER is undefined", () => {
    const condition = perBelow(15);
    const indicators: Record<string, unknown> = {};
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should have correct name", () => {
    const condition = perBelow(15);
    expect(condition.name).toBe("perBelow(15)");
  });
});

describe("perAbove", () => {
  it("should return true when PER is above threshold", () => {
    const condition = perAbove(30);
    const indicators: Record<string, unknown> = { per: 35 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(true);
  });

  it("should return false when PER is below threshold", () => {
    const condition = perAbove(30);
    const indicators: Record<string, unknown> = { per: 25 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should return false when PER equals threshold", () => {
    const condition = perAbove(30);
    const indicators: Record<string, unknown> = { per: 30 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should return false when PER is null", () => {
    const condition = perAbove(30);
    const indicators: Record<string, unknown> = { per: null };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should have correct name", () => {
    const condition = perAbove(30);
    expect(condition.name).toBe("perAbove(30)");
  });
});

describe("perBetween", () => {
  it("should return true when PER is within range", () => {
    const condition = perBetween(10, 20);
    const indicators: Record<string, unknown> = { per: 15 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(true);
  });

  it("should return true when PER equals min (inclusive)", () => {
    const condition = perBetween(10, 20);
    const indicators: Record<string, unknown> = { per: 10 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(true);
  });

  it("should return true when PER equals max (inclusive)", () => {
    const condition = perBetween(10, 20);
    const indicators: Record<string, unknown> = { per: 20 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(true);
  });

  it("should return false when PER is outside range", () => {
    const condition = perBetween(10, 20);
    const indicators: Record<string, unknown> = { per: 25 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should return false when PER is null", () => {
    const condition = perBetween(10, 20);
    const indicators: Record<string, unknown> = { per: null };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should have correct name", () => {
    const condition = perBetween(10, 20);
    expect(condition.name).toBe("perBetween(10,20)");
  });
});

describe("pbrBelow", () => {
  it("should return true when PBR is below threshold", () => {
    const condition = pbrBelow(1.0);
    const indicators: Record<string, unknown> = { pbr: 0.8 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(true);
  });

  it("should return false when PBR is above threshold", () => {
    const condition = pbrBelow(1.0);
    const indicators: Record<string, unknown> = { pbr: 1.5 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should return false when PBR is null", () => {
    const condition = pbrBelow(1.0);
    const indicators: Record<string, unknown> = { pbr: null };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should have correct name", () => {
    const condition = pbrBelow(1.0);
    expect(condition.name).toBe("pbrBelow(1)");
  });
});

describe("pbrAbove", () => {
  it("should return true when PBR is above threshold", () => {
    const condition = pbrAbove(3.0);
    const indicators: Record<string, unknown> = { pbr: 3.5 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(true);
  });

  it("should return false when PBR is below threshold", () => {
    const condition = pbrAbove(3.0);
    const indicators: Record<string, unknown> = { pbr: 2.0 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should return false when PBR is null", () => {
    const condition = pbrAbove(3.0);
    const indicators: Record<string, unknown> = { pbr: null };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should have correct name", () => {
    const condition = pbrAbove(3.0);
    expect(condition.name).toBe("pbrAbove(3)");
  });
});

describe("pbrBetween", () => {
  it("should return true when PBR is within range", () => {
    const condition = pbrBetween(0.5, 1.5);
    const indicators: Record<string, unknown> = { pbr: 1.0 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(true);
  });

  it("should return true when PBR equals min (inclusive)", () => {
    const condition = pbrBetween(0.5, 1.5);
    const indicators: Record<string, unknown> = { pbr: 0.5 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(true);
  });

  it("should return true when PBR equals max (inclusive)", () => {
    const condition = pbrBetween(0.5, 1.5);
    const indicators: Record<string, unknown> = { pbr: 1.5 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(true);
  });

  it("should return false when PBR is outside range", () => {
    const condition = pbrBetween(0.5, 1.5);
    const indicators: Record<string, unknown> = { pbr: 2.0 };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should return false when PBR is null", () => {
    const condition = pbrBetween(0.5, 1.5);
    const indicators: Record<string, unknown> = { pbr: null };
    const candle = createCandle();

    const result = condition.evaluate(indicators, candle, 0, [candle]);

    expect(result).toBe(false);
  });

  it("should have correct name", () => {
    const condition = pbrBetween(0.5, 1.5);
    expect(condition.name).toBe("pbrBetween(0.5,1.5)");
  });
});
