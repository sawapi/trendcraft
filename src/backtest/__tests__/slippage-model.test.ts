import { describe, it, expect } from "vitest";
import { calculateDynamicSlippage, resolveSlippageModel } from "../slippage-model";
import type { NormalizedCandle } from "../../types";

const candle = {
  time: 1000,
  open: 100,
  high: 105,
  low: 95,
  close: 100,
  volume: 10000,
} as NormalizedCandle;

describe("calculateDynamicSlippage", () => {
  describe("fixed model", () => {
    it("returns percent directly", () => {
      const result = calculateDynamicSlippage({ type: "fixed", percent: 0.1 }, candle);
      expect(result).toBe(0.1);
    });
  });

  describe("volatility model", () => {
    it("returns (ATR/close)*100*multiplier", () => {
      // ATR=2, close=100, multiplier=1 → (2/100)*100*1 = 2
      const result = calculateDynamicSlippage(
        { type: "volatility", atrMultiplier: 1 },
        candle,
        2.0,
      );
      expect(result).toBe(2.0);
    });

    it("returns 0 if no ATR provided", () => {
      const result = calculateDynamicSlippage(
        { type: "volatility", atrMultiplier: 1 },
        candle,
      );
      expect(result).toBe(0);
    });
  });

  describe("volume model", () => {
    it("returns impactCoeff/sqrt(volume)*100", () => {
      // impactCoeff=0.1, volume=10000 → 0.1/sqrt(10000)*100 = 0.1/100*100 = 0.1
      const result = calculateDynamicSlippage(
        { type: "volume", impactCoeff: 0.1 },
        candle,
      );
      expect(result).toBeCloseTo(0.1, 10);
    });

    it("falls back to impactCoeff*100 when volume is 0", () => {
      const zeroVolCandle = { ...candle, volume: 0 } as NormalizedCandle;
      const result = calculateDynamicSlippage(
        { type: "volume", impactCoeff: 0.1 },
        zeroVolCandle,
      );
      expect(result).toBe(10);
    });
  });

  describe("composite model", () => {
    it("returns weighted average of volatility and volume components (default 50/50)", () => {
      // volatility: (2/100)*100*1 = 2
      // volume: 0.1/sqrt(10000)*100 = 0.1
      // composite: 2*0.5 + 0.1*0.5 = 1.05
      const result = calculateDynamicSlippage(
        { type: "composite", atrMultiplier: 1, impactCoeff: 0.1 },
        candle,
        2.0,
      );
      expect(result).toBeCloseTo(1.05, 10);
    });

    it("respects custom volatilityWeight", () => {
      // volatility: 2, volume: 0.1
      // composite: 2*0.8 + 0.1*0.2 = 1.62
      const result = calculateDynamicSlippage(
        { type: "composite", atrMultiplier: 1, impactCoeff: 0.1, volatilityWeight: 0.8 },
        candle,
        2.0,
      );
      expect(result).toBeCloseTo(1.62, 10);
    });
  });
});

describe("resolveSlippageModel", () => {
  it("returns model when model is provided", () => {
    const model = { type: "volatility" as const, atrMultiplier: 1.5 };
    expect(resolveSlippageModel(undefined, model)).toEqual(model);
  });

  it("converts numeric slippage to fixed model", () => {
    expect(resolveSlippageModel(0.1)).toEqual({ type: "fixed", percent: 0.1 });
  });

  it("returns undefined when neither provided", () => {
    expect(resolveSlippageModel()).toBeUndefined();
  });

  it("model takes precedence over numeric slippage", () => {
    const model = { type: "volume" as const, impactCoeff: 0.2 };
    expect(resolveSlippageModel(0.1, model)).toEqual(model);
  });
});
