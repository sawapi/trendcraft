/**
 * Stochastics, MACD, DMI Streaming Conditions Tests
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { adxRising, adxStrong, dmiCrossDown, dmiCrossUp } from "../conditions/dmi";
import {
  macdCrossDown,
  macdCrossUp,
  macdHistogramFalling,
  macdHistogramRising,
} from "../conditions/macd";
import { stochAbove, stochBelow, stochCrossDown, stochCrossUp } from "../conditions/stochastics";

const candle: NormalizedCandle = {
  time: 1000,
  open: 100,
  high: 105,
  low: 95,
  close: 102,
  volume: 1000,
};

// ==========================================
// Stochastics
// ==========================================

describe("stochBelow", () => {
  it("detects oversold", () => {
    const cond = stochBelow(20);
    expect(cond.evaluate({ stochastics: { k: 15, d: 18 } }, candle)).toBe(true);
  });

  it("returns false when above threshold", () => {
    const cond = stochBelow(20);
    expect(cond.evaluate({ stochastics: { k: 50, d: 45 } }, candle)).toBe(false);
  });
});

describe("stochAbove", () => {
  it("detects overbought", () => {
    const cond = stochAbove(80);
    expect(cond.evaluate({ stochastics: { k: 85, d: 82 } }, candle)).toBe(true);
  });
});

describe("stochCrossUp", () => {
  it("detects K crossing above D", () => {
    const cond = stochCrossUp();
    // First call: establish prev
    cond.evaluate({ stochastics: { k: 20, d: 25 } }, candle);
    // Second call: K crosses above D
    expect(cond.evaluate({ stochastics: { k: 30, d: 25 } }, candle)).toBe(true);
  });

  it("returns false on first call", () => {
    const cond = stochCrossUp();
    expect(cond.evaluate({ stochastics: { k: 30, d: 25 } }, candle)).toBe(false);
  });
});

describe("stochCrossDown", () => {
  it("detects K crossing below D", () => {
    const cond = stochCrossDown();
    cond.evaluate({ stochastics: { k: 80, d: 75 } }, candle);
    expect(cond.evaluate({ stochastics: { k: 70, d: 75 } }, candle)).toBe(true);
  });
});

// ==========================================
// MACD
// ==========================================

describe("macdCrossUp", () => {
  it("detects MACD crossing above signal", () => {
    const cond = macdCrossUp();
    cond.evaluate({ macd: { macd: -1, signal: 0, histogram: -1 } }, candle);
    expect(cond.evaluate({ macd: { macd: 1, signal: 0, histogram: 1 } }, candle)).toBe(true);
  });
});

describe("macdCrossDown", () => {
  it("detects MACD crossing below signal", () => {
    const cond = macdCrossDown();
    cond.evaluate({ macd: { macd: 1, signal: 0, histogram: 1 } }, candle);
    expect(cond.evaluate({ macd: { macd: -1, signal: 0, histogram: -1 } }, candle)).toBe(true);
  });
});

describe("macdHistogramRising", () => {
  it("detects rising histogram", () => {
    const cond = macdHistogramRising();
    cond.evaluate({ macd: { macd: 1, signal: 0.5, histogram: 0.5 } }, candle);
    expect(cond.evaluate({ macd: { macd: 2, signal: 0.5, histogram: 1.5 } }, candle)).toBe(true);
  });

  it("returns false on first call", () => {
    const cond = macdHistogramRising();
    expect(cond.evaluate({ macd: { macd: 1, signal: 0.5, histogram: 0.5 } }, candle)).toBe(false);
  });
});

describe("macdHistogramFalling", () => {
  it("detects falling histogram", () => {
    const cond = macdHistogramFalling();
    cond.evaluate({ macd: { macd: 2, signal: 0.5, histogram: 1.5 } }, candle);
    expect(cond.evaluate({ macd: { macd: 1, signal: 0.5, histogram: 0.5 } }, candle)).toBe(true);
  });
});

// ==========================================
// DMI/ADX
// ==========================================

describe("adxStrong", () => {
  it("detects strong trend", () => {
    const cond = adxStrong(25);
    expect(cond.evaluate({ dmi: { plusDi: 30, minusDi: 15, adx: 30 } }, candle)).toBe(true);
  });

  it("returns false for weak trend", () => {
    const cond = adxStrong(25);
    expect(cond.evaluate({ dmi: { plusDi: 20, minusDi: 18, adx: 15 } }, candle)).toBe(false);
  });
});

describe("adxRising", () => {
  it("detects rising ADX", () => {
    const cond = adxRising();
    cond.evaluate({ dmi: { plusDi: 25, minusDi: 15, adx: 20 } }, candle);
    expect(cond.evaluate({ dmi: { plusDi: 28, minusDi: 12, adx: 25 } }, candle)).toBe(true);
  });
});

describe("dmiCrossUp", () => {
  it("detects +DI crossing above -DI", () => {
    const cond = dmiCrossUp();
    cond.evaluate({ dmi: { plusDi: 15, minusDi: 20, adx: 25 } }, candle);
    expect(cond.evaluate({ dmi: { plusDi: 22, minusDi: 18, adx: 26 } }, candle)).toBe(true);
  });
});

describe("dmiCrossDown", () => {
  it("detects +DI crossing below -DI", () => {
    const cond = dmiCrossDown();
    cond.evaluate({ dmi: { plusDi: 25, minusDi: 20, adx: 30 } }, candle);
    expect(cond.evaluate({ dmi: { plusDi: 18, minusDi: 22, adx: 28 } }, candle)).toBe(true);
  });
});
