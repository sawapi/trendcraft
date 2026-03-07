import { describe, it, expect } from "vitest";
import { crossOver, crossUnder } from "../conditions/cross";
import { getField } from "../snapshot-utils";
import type { IndicatorSnapshot } from "../conditions/types";
import type { NormalizedCandle } from "../../types";

const dummyCandle: NormalizedCandle = {
  time: 1000,
  open: 100,
  high: 105,
  low: 95,
  close: 102,
  volume: 1000,
};

function makeSnap(overrides: Record<string, unknown>): IndicatorSnapshot {
  return overrides;
}

describe("crossOver", () => {
  describe("with string keys", () => {
    it("detects when A crosses above B", () => {
      const cond = crossOver("sma20", "sma50");

      // First call: no previous state
      expect(cond.evaluate(makeSnap({ sma20: 48, sma50: 50 }), dummyCandle)).toBe(false);
      // A still below B
      expect(cond.evaluate(makeSnap({ sma20: 49, sma50: 50 }), dummyCandle)).toBe(false);
      // A crosses above B
      expect(cond.evaluate(makeSnap({ sma20: 51, sma50: 50 }), dummyCandle)).toBe(true);
      // A remains above B (no new cross)
      expect(cond.evaluate(makeSnap({ sma20: 52, sma50: 50 }), dummyCandle)).toBe(false);
    });

    it("does not fire on touch (A == B)", () => {
      const cond = crossOver("sma20", "sma50");

      cond.evaluate(makeSnap({ sma20: 48, sma50: 50 }), dummyCandle);
      // A reaches B but does not exceed
      expect(cond.evaluate(makeSnap({ sma20: 50, sma50: 50 }), dummyCandle)).toBe(false);
    });

    it("fires after touch when A exceeds B", () => {
      const cond = crossOver("sma20", "sma50");

      cond.evaluate(makeSnap({ sma20: 48, sma50: 50 }), dummyCandle);
      cond.evaluate(makeSnap({ sma20: 50, sma50: 50 }), dummyCandle);
      // Now from equal to above
      expect(cond.evaluate(makeSnap({ sma20: 51, sma50: 50 }), dummyCandle)).toBe(true);
    });
  });

  describe("with dot-path keys", () => {
    it("detects MACD signal line cross", () => {
      const cond = crossOver("macd.macd", "macd.signal");

      cond.evaluate(
        makeSnap({ macd: { macd: 0.8, signal: 1.0, histogram: -0.2 } }),
        dummyCandle,
      );
      expect(
        cond.evaluate(
          makeSnap({ macd: { macd: 1.1, signal: 1.0, histogram: 0.1 } }),
          dummyCandle,
        ),
      ).toBe(true);
    });
  });

  describe("with numeric constant", () => {
    it("detects RSI crossing above 30", () => {
      const cond = crossOver("rsi", 30);

      cond.evaluate(makeSnap({ rsi: 28 }), dummyCandle);
      expect(cond.evaluate(makeSnap({ rsi: 31 }), dummyCandle)).toBe(true);
    });

    it("does not fire when already above", () => {
      const cond = crossOver("rsi", 30);

      cond.evaluate(makeSnap({ rsi: 35 }), dummyCandle);
      expect(cond.evaluate(makeSnap({ rsi: 40 }), dummyCandle)).toBe(false);
    });
  });

  describe("with custom extractor function", () => {
    it("detects DMI +DI crossing above -DI", () => {
      const cond = crossOver(
        (snap) => getField(snap, "dmi", "plusDi"),
        (snap) => getField(snap, "dmi", "minusDi"),
      );

      cond.evaluate(makeSnap({ dmi: { plusDi: 20, minusDi: 25, adx: 30 } }), dummyCandle);
      expect(
        cond.evaluate(
          makeSnap({ dmi: { plusDi: 26, minusDi: 25, adx: 30 } }),
          dummyCandle,
        ),
      ).toBe(true);
    });
  });

  describe("null handling", () => {
    it("skips when value is null", () => {
      const cond = crossOver("sma20", "sma50");

      cond.evaluate(makeSnap({ sma20: 48, sma50: 50 }), dummyCandle);
      // null value — should not fire
      expect(cond.evaluate(makeSnap({ sma20: 51 }), dummyCandle)).toBe(false);
      // Now both present but no valid prev pair
      expect(cond.evaluate(makeSnap({ sma20: 52, sma50: 50 }), dummyCandle)).toBe(false);
    });

    it("returns false on first call (no previous state)", () => {
      const cond = crossOver("rsi", 30);
      expect(cond.evaluate(makeSnap({ rsi: 35 }), dummyCandle)).toBe(false);
    });
  });

  it("has descriptive name", () => {
    expect(crossOver("sma20", "sma50").name).toBe("crossOver(sma20, sma50)");
    expect(crossOver("rsi", 30).name).toBe("crossOver(rsi, 30)");
    expect(crossOver(() => null, () => null).name).toBe("crossOver(fn, fn)");
  });
});

describe("crossUnder", () => {
  it("detects when A crosses below B", () => {
    const cond = crossUnder("sma20", "sma50");

    cond.evaluate(makeSnap({ sma20: 52, sma50: 50 }), dummyCandle);
    expect(cond.evaluate(makeSnap({ sma20: 49, sma50: 50 }), dummyCandle)).toBe(true);
  });

  it("does not fire on touch (A == B)", () => {
    const cond = crossUnder("sma20", "sma50");

    cond.evaluate(makeSnap({ sma20: 52, sma50: 50 }), dummyCandle);
    expect(cond.evaluate(makeSnap({ sma20: 50, sma50: 50 }), dummyCandle)).toBe(false);
  });

  it("fires after touch when A drops below B", () => {
    const cond = crossUnder("sma20", "sma50");

    cond.evaluate(makeSnap({ sma20: 52, sma50: 50 }), dummyCandle);
    cond.evaluate(makeSnap({ sma20: 50, sma50: 50 }), dummyCandle);
    // From equal to below
    expect(cond.evaluate(makeSnap({ sma20: 49, sma50: 50 }), dummyCandle)).toBe(true);
  });

  it("detects RSI crossing below 70", () => {
    const cond = crossUnder("rsi", 70);

    cond.evaluate(makeSnap({ rsi: 75 }), dummyCandle);
    expect(cond.evaluate(makeSnap({ rsi: 68 }), dummyCandle)).toBe(true);
  });

  it("has descriptive name", () => {
    expect(crossUnder("sma20", "sma50").name).toBe("crossUnder(sma20, sma50)");
  });

  describe("state transitions", () => {
    it("correctly tracks multiple crosses", () => {
      const cond = crossUnder("fast", "slow");

      // Initial: above
      cond.evaluate(makeSnap({ fast: 55, slow: 50 }), dummyCandle);
      // Cross under
      expect(cond.evaluate(makeSnap({ fast: 45, slow: 50 }), dummyCandle)).toBe(true);
      // Stay below
      expect(cond.evaluate(makeSnap({ fast: 44, slow: 50 }), dummyCandle)).toBe(false);
      // Cross back above
      expect(cond.evaluate(makeSnap({ fast: 55, slow: 50 }), dummyCandle)).toBe(false);
      // Cross under again
      expect(cond.evaluate(makeSnap({ fast: 48, slow: 50 }), dummyCandle)).toBe(true);
    });
  });
});
