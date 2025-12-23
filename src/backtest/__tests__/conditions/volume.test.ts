import { describe, it, expect } from "vitest";
import { volumeAboveAvg, evaluateCondition } from "../../conditions";
import type { NormalizedCandle } from "../../../types";

describe("volumeAboveAvg()", () => {
  it("should create a valid preset condition", () => {
    const condition = volumeAboveAvg(1.5);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("volumeAboveAvg");
  });

  it("should detect volume spike", () => {
    // Generate candles with a volume spike
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      const volume = i === 45 ? 3000000 : 1000000; // Spike at index 45
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume,
      });
    }

    const condition = volumeAboveAvg(1.5); // 1.5x average
    const indicators: Record<string, unknown> = {};

    // The spike should trigger the condition
    const result = evaluateCondition(condition, indicators, candles[45], 45, candles);
    expect(result).toBe(true);
  });

  it("should not trigger on normal volume", () => {
    // Generate candles with consistent volume
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1000000, // Consistent volume
      });
    }

    const condition = volumeAboveAvg(1.5);
    const indicators: Record<string, unknown> = {};

    // Normal volume should not trigger
    const result = evaluateCondition(condition, indicators, candles[40], 40, candles);
    expect(result).toBe(false);
  });
});
