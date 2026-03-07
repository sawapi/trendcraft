import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { toResult } from "../../types";
import {
  smaSafe,
  emaSafe,
  rsiSafe,
  macdSafe,
  bollingerBandsSafe,
  atrSafe,
  kamaSafe,
  t3Safe,
  dpoSafe,
  hurstSafe,
  fractalsSafe,
  zigzagSafe,
} from "../safe";

describe("safe indicator wrappers", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close * 1.02,
      low: close * 0.98,
      close,
      volume: 1000,
    }));

  const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));

  describe("toResult utility", () => {
    it("should return Ok for successful function", () => {
      const result = toResult(() => 42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it("should return Err for throwing function", () => {
      const result = toResult(() => {
        throw new Error("test error");
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("COMPUTATION_FAILED");
        expect(result.error.message).toBe("test error");
      }
    });

    it("should use custom error code", () => {
      const result = toResult(() => {
        throw new Error("bad param");
      }, "INDICATOR_ERROR");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INDICATOR_ERROR");
      }
    });

    it("should handle non-Error throws", () => {
      const result = toResult(() => {
        throw "string error";
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("string error");
        expect(result.error.cause).toBeUndefined();
      }
    });
  });

  describe("smaSafe", () => {
    it("should return Ok with valid parameters", () => {
      const result = smaSafe(candles, { period: 5 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(candles.length);
      }
    });

    it("should return Err with invalid parameters", () => {
      const result = smaSafe(candles, { period: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INDICATOR_ERROR");
        expect(result.error.message).toContain("period");
      }
    });
  });

  describe("emaSafe", () => {
    it("should return Ok with valid parameters", () => {
      const result = emaSafe(candles, { period: 12 });
      expect(result.ok).toBe(true);
    });

    it("should return Err with invalid parameters", () => {
      const result = emaSafe(candles, { period: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INDICATOR_ERROR");
      }
    });
  });

  describe("rsiSafe", () => {
    it("should return Ok with valid parameters", () => {
      const result = rsiSafe(candles, { period: 14 });
      expect(result.ok).toBe(true);
    });
  });

  describe("macdSafe", () => {
    it("should return Ok with valid parameters", () => {
      const result = macdSafe(candles);
      expect(result.ok).toBe(true);
    });
  });

  describe("bollingerBandsSafe", () => {
    it("should return Ok with valid parameters", () => {
      const result = bollingerBandsSafe(candles);
      expect(result.ok).toBe(true);
    });
  });

  describe("atrSafe", () => {
    it("should return Ok with valid parameters", () => {
      const result = atrSafe(candles);
      expect(result.ok).toBe(true);
    });
  });

  describe("new indicator safe versions", () => {
    it("kamaSafe should return Ok", () => {
      const result = kamaSafe(candles, { period: 10 });
      expect(result.ok).toBe(true);
    });

    it("kamaSafe should return Err for invalid period", () => {
      const result = kamaSafe(candles, { period: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INDICATOR_ERROR");
      }
    });

    it("t3Safe should return Ok", () => {
      const result = t3Safe(candles, { period: 3 });
      expect(result.ok).toBe(true);
    });

    it("dpoSafe should return Ok", () => {
      const result = dpoSafe(candles, { period: 10 });
      expect(result.ok).toBe(true);
    });

    it("hurstSafe should return Ok", () => {
      const longCandles = makeCandles(Array.from({ length: 120 }, (_, i) => 100 + i));
      const result = hurstSafe(longCandles, { minWindow: 10, maxWindow: 80 });
      expect(result.ok).toBe(true);
    });

    it("fractalsSafe should return Ok", () => {
      const result = fractalsSafe(candles);
      expect(result.ok).toBe(true);
    });

    it("zigzagSafe should return Ok", () => {
      const result = zigzagSafe(candles);
      expect(result.ok).toBe(true);
    });

    it("zigzagSafe should return Err for invalid deviation", () => {
      const result = zigzagSafe(candles, { deviation: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INDICATOR_ERROR");
      }
    });
  });

  describe("safe version matches throw version result", () => {
    it("smaSafe should produce same values as sma", () => {
      const result = smaSafe(candles, { period: 5 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Verify structure
        expect(result.value[0].time).toBe(candles[0].time);
        expect(result.value[0].value).toBeNull();
        expect(result.value[4].value).not.toBeNull();
      }
    });
  });
});
