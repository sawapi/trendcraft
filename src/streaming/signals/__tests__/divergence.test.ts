import { describe, it, expect } from "vitest";
import { createDivergenceDetector } from "../divergence";

describe("createDivergenceDetector", () => {
  it("should not detect divergence with insufficient data", () => {
    const d = createDivergenceDetector({ lookback: 6 });
    for (let i = 0; i < 4; i++) {
      const result = d.next(100 + i, 50 + i);
      expect(result.bullish).toBe(false);
      expect(result.bearish).toBe(false);
    }
  });

  it("should detect bullish divergence (price lower low, indicator higher low)", () => {
    const d = createDivergenceDetector({ lookback: 6 });

    // First half: price=100, indicator=40
    d.next(100, 40);
    d.next(95, 38);
    d.next(98, 42);

    // Second half: price makes lower low (90), indicator makes higher low (42)
    d.next(92, 45);
    d.next(90, 42);
    const result = d.next(93, 48);

    expect(result.bullish).toBe(true);
  });

  it("should detect bearish divergence (price higher high, indicator lower high)", () => {
    const d = createDivergenceDetector({ lookback: 6 });

    // First half: price=100, indicator=70
    d.next(100, 70);
    d.next(105, 72);
    d.next(102, 68);

    // Second half: price makes higher high (110), indicator makes lower high (69)
    d.next(108, 65);
    d.next(110, 69);
    const result = d.next(106, 64);

    expect(result.bearish).toBe(true);
  });

  it("should not detect divergence when price and indicator agree", () => {
    const d = createDivergenceDetector({ lookback: 6 });

    // Both trending up together
    d.next(100, 50);
    d.next(102, 52);
    d.next(104, 54);
    d.next(106, 56);
    d.next(108, 58);
    const result = d.next(110, 60);

    expect(result.bullish).toBe(false);
    expect(result.bearish).toBe(false);
  });

  it("should handle null values gracefully", () => {
    const d = createDivergenceDetector({ lookback: 4 });
    d.next(null, 50);
    d.next(100, null);
    d.next(null, null);
    const result = d.next(100, 50);
    expect(result.bullish).toBe(false);
    expect(result.bearish).toBe(false);
  });

  it("should use sliding window (buffer evicts old values)", () => {
    const d = createDivergenceDetector({ lookback: 4 });

    // Fill buffer
    d.next(100, 50);
    d.next(90, 40);
    d.next(95, 45);
    d.next(85, 42);

    // This should evict the first value (100, 50) and add new
    const result = d.next(88, 48);
    // Now buffer: [90,40], [95,45], [85,42], [88,48]
    // First half lows: price=90, ind=40
    // Second half lows: price=85, ind=42
    // Bullish: 85 < 90 && 42 > 40 = true
    expect(result.bullish).toBe(true);
  });

  it("should support peek without advancing state", () => {
    const d = createDivergenceDetector({ lookback: 4 });
    d.next(100, 60);
    d.next(95, 55);
    d.next(90, 58);

    const peekResult = d.peek(85, 62);
    const nextResult = d.next(85, 62);
    expect(peekResult).toEqual(nextResult);
  });

  describe("state persistence", () => {
    it("should serialize and restore state", () => {
      const d1 = createDivergenceDetector({ lookback: 6 });
      d1.next(100, 40);
      d1.next(95, 38);
      d1.next(98, 42);
      d1.next(92, 45);

      const state = JSON.parse(JSON.stringify(d1.getState()));
      const d2 = createDivergenceDetector({}, state);

      // Continue from restored state
      d2.next(90, 42);
      const r2 = d2.next(93, 48);

      // Also continue original
      d1.next(90, 42);
      const r1 = d1.next(93, 48);

      expect(r1).toEqual(r2);
    });
  });
});
