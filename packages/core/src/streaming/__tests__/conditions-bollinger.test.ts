/**
 * Bollinger Bands Streaming Conditions Tests
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import {
  bollingerBreakout,
  bollingerExpansion,
  bollingerSqueeze,
  bollingerTouch,
} from "../conditions/bollinger";

const candle: NormalizedCandle = {
  time: 1000,
  open: 100,
  high: 105,
  low: 95,
  close: 102,
  volume: 1000,
};

describe("bollingerBreakout", () => {
  it("detects upper breakout", () => {
    const cond = bollingerBreakout("upper");
    const snapshot = { bb: { upper: 101, middle: 100, lower: 99, bandwidth: 0.02, percentB: 1.5 } };
    expect(cond.evaluate(snapshot, candle)).toBe(true);
  });

  it("returns false when below upper", () => {
    const cond = bollingerBreakout("upper");
    const snapshot = { bb: { upper: 103, middle: 100, lower: 97, bandwidth: 0.06, percentB: 0.8 } };
    expect(cond.evaluate(snapshot, candle)).toBe(false);
  });

  it("detects lower breakout", () => {
    const cond = bollingerBreakout("lower");
    const lowCandle = { ...candle, close: 95 };
    const snapshot = {
      bb: { upper: 110, middle: 100, lower: 96, bandwidth: 0.14, percentB: -0.07 },
    };
    expect(cond.evaluate(snapshot, lowCandle)).toBe(true);
  });

  it("returns false when missing data", () => {
    const cond = bollingerBreakout("upper");
    expect(cond.evaluate({}, candle)).toBe(false);
  });
});

describe("bollingerTouch", () => {
  it("detects when price is near upper band", () => {
    const cond = bollingerTouch("upper", 0.5);
    const snapshot = {
      bb: { upper: 102.3, middle: 100, lower: 97.7, bandwidth: 0.046, percentB: 0.98 },
    };
    expect(cond.evaluate(snapshot, candle)).toBe(true);
  });

  it("returns false when price is far from band", () => {
    const cond = bollingerTouch("upper", 0.1);
    const snapshot = { bb: { upper: 110, middle: 100, lower: 90, bandwidth: 0.2, percentB: 0.6 } };
    expect(cond.evaluate(snapshot, candle)).toBe(false);
  });
});

describe("bollingerSqueeze", () => {
  it("detects low bandwidth", () => {
    const cond = bollingerSqueeze(0.1);
    const snapshot = { bb: { upper: 101, middle: 100, lower: 99, bandwidth: 0.02, percentB: 1 } };
    expect(cond.evaluate(snapshot, candle)).toBe(true);
  });

  it("returns false for high bandwidth", () => {
    const cond = bollingerSqueeze(0.1);
    const snapshot = { bb: { upper: 110, middle: 100, lower: 90, bandwidth: 0.2, percentB: 0.6 } };
    expect(cond.evaluate(snapshot, candle)).toBe(false);
  });
});

describe("bollingerExpansion", () => {
  it("detects high bandwidth", () => {
    const cond = bollingerExpansion(0.15);
    const snapshot = { bb: { upper: 110, middle: 100, lower: 90, bandwidth: 0.2, percentB: 0.6 } };
    expect(cond.evaluate(snapshot, candle)).toBe(true);
  });

  it("returns false for low bandwidth", () => {
    const cond = bollingerExpansion(0.3);
    const snapshot = { bb: { upper: 110, middle: 100, lower: 90, bandwidth: 0.2, percentB: 0.6 } };
    expect(cond.evaluate(snapshot, candle)).toBe(false);
  });
});
