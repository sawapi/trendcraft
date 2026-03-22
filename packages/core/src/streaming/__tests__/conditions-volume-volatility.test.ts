/**
 * Volume & Volatility Streaming Conditions Tests
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import {
  atrPercentAbove,
  atrPercentBelow,
  volatilityContracting,
  volatilityExpanding,
} from "../conditions/volatility";
import {
  cmfAbove,
  cmfBelow,
  obvCrossDown,
  obvCrossUp,
  obvFalling,
  obvRising,
  volumeAboveAvg,
} from "../conditions/volume";

const candle: NormalizedCandle = {
  time: 1000,
  open: 100,
  high: 105,
  low: 95,
  close: 100,
  volume: 1000,
};

// ==========================================
// Volume conditions
// ==========================================

describe("volumeAboveAvg", () => {
  it("detects above-average volume", () => {
    const cond = volumeAboveAvg(1.5);
    expect(
      cond.evaluate({ volumeAnomaly: { ratio: 2.0, volume: 2000, avgVolume: 1000 } }, candle),
    ).toBe(true);
  });

  it("returns false for normal volume", () => {
    const cond = volumeAboveAvg(1.5);
    expect(
      cond.evaluate({ volumeAnomaly: { ratio: 1.0, volume: 1000, avgVolume: 1000 } }, candle),
    ).toBe(false);
  });
});

describe("cmfAbove / cmfBelow", () => {
  it("detects positive CMF", () => {
    const cond = cmfAbove(0.05);
    expect(cond.evaluate({ cmf: 0.15 }, candle)).toBe(true);
  });

  it("detects negative CMF", () => {
    const cond = cmfBelow(-0.05);
    expect(cond.evaluate({ cmf: -0.15 }, candle)).toBe(true);
  });

  it("returns false when missing", () => {
    expect(cmfAbove(0.05).evaluate({}, candle)).toBe(false);
  });
});

describe("obvRising / obvFalling", () => {
  it("detects rising OBV", () => {
    const cond = obvRising();
    cond.evaluate({ obv: 1000 }, candle);
    expect(cond.evaluate({ obv: 1200 }, candle)).toBe(true);
  });

  it("detects falling OBV", () => {
    const cond = obvFalling();
    cond.evaluate({ obv: 1200 }, candle);
    expect(cond.evaluate({ obv: 1000 }, candle)).toBe(true);
  });

  it("returns false on first call", () => {
    expect(obvRising().evaluate({ obv: 1000 }, candle)).toBe(false);
  });
});

describe("obvCrossUp / obvCrossDown", () => {
  it("detects OBV crossing above signal", () => {
    const cond = obvCrossUp();
    cond.evaluate({ obv: 900, obvSignal: 1000 }, candle);
    expect(cond.evaluate({ obv: 1100, obvSignal: 1000 }, candle)).toBe(true);
  });

  it("detects OBV crossing below signal", () => {
    const cond = obvCrossDown();
    cond.evaluate({ obv: 1100, obvSignal: 1000 }, candle);
    expect(cond.evaluate({ obv: 900, obvSignal: 1000 }, candle)).toBe(true);
  });
});

// ==========================================
// Volatility conditions
// ==========================================

describe("atrPercentAbove / atrPercentBelow", () => {
  it("detects high ATR%", () => {
    const cond = atrPercentAbove(2.0);
    expect(cond.evaluate({ atr: 3 }, candle)).toBe(true); // 3/100 * 100 = 3%
  });

  it("detects low ATR%", () => {
    const cond = atrPercentBelow(1.0);
    expect(cond.evaluate({ atr: 0.5 }, candle)).toBe(true); // 0.5/100 * 100 = 0.5%
  });

  it("returns false for zero close", () => {
    const zeroCl = { ...candle, close: 0 };
    expect(atrPercentAbove(1.0).evaluate({ atr: 1 }, zeroCl)).toBe(false);
  });
});

describe("volatilityExpanding / volatilityContracting", () => {
  it("detects expanding volatility", () => {
    const cond = volatilityExpanding();
    cond.evaluate({ atr: 1.0 }, candle);
    expect(cond.evaluate({ atr: 1.5 }, candle)).toBe(true);
  });

  it("detects contracting volatility", () => {
    const cond = volatilityContracting();
    cond.evaluate({ atr: 1.5 }, candle);
    expect(cond.evaluate({ atr: 1.0 }, candle)).toBe(true);
  });

  it("returns false on first call", () => {
    expect(volatilityExpanding().evaluate({ atr: 1.0 }, candle)).toBe(false);
  });
});
