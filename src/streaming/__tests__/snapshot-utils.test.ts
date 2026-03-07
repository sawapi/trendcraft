import { describe, it, expect } from "vitest";
import { getNumber, getField, resolveNumber } from "../snapshot-utils";
import type { IndicatorSnapshot } from "../conditions/types";

describe("getNumber", () => {
  it("returns number when value is a number", () => {
    const snap: IndicatorSnapshot = { rsi: 42.5 };
    expect(getNumber(snap, "rsi")).toBe(42.5);
  });

  it("returns null for missing key", () => {
    const snap: IndicatorSnapshot = {};
    expect(getNumber(snap, "rsi")).toBeNull();
  });

  it("returns null for undefined value", () => {
    const snap: IndicatorSnapshot = { rsi: undefined };
    expect(getNumber(snap, "rsi")).toBeNull();
  });

  it("returns null for null value", () => {
    const snap: IndicatorSnapshot = { rsi: null };
    expect(getNumber(snap, "rsi")).toBeNull();
  });

  it("returns null when value is an object (compound indicator)", () => {
    const snap: IndicatorSnapshot = {
      bb: { upper: 110, middle: 100, lower: 90 },
    };
    expect(getNumber(snap, "bb")).toBeNull();
  });

  it("returns null for string value", () => {
    const snap: IndicatorSnapshot = { rsi: "not a number" };
    expect(getNumber(snap, "rsi")).toBeNull();
  });
});

describe("getField", () => {
  it("extracts Bollinger Bands sub-field", () => {
    const snap: IndicatorSnapshot = {
      bb: { upper: 110, middle: 100, lower: 90, percentB: 0.75 },
    };
    expect(getField(snap, "bb", "lower")).toBe(90);
    expect(getField(snap, "bb", "upper")).toBe(110);
    expect(getField(snap, "bb", "percentB")).toBe(0.75);
  });

  it("extracts MACD sub-field", () => {
    const snap: IndicatorSnapshot = {
      macd: { macd: 1.5, signal: 1.2, histogram: 0.3 },
    };
    expect(getField(snap, "macd", "histogram")).toBe(0.3);
    expect(getField(snap, "macd", "signal")).toBe(1.2);
  });

  it("extracts DMI sub-field", () => {
    const snap: IndicatorSnapshot = {
      dmi: { plusDi: 30, minusDi: 20, adx: 25 },
    };
    expect(getField(snap, "dmi", "plusDi")).toBe(30);
    expect(getField(snap, "dmi", "adx")).toBe(25);
  });

  it("returns null for missing key", () => {
    const snap: IndicatorSnapshot = {};
    expect(getField(snap, "bb", "lower")).toBeNull();
  });

  it("returns null when value is not an object", () => {
    const snap: IndicatorSnapshot = { rsi: 42 };
    expect(getField(snap, "rsi", "value")).toBeNull();
  });

  it("returns null for missing sub-field", () => {
    const snap: IndicatorSnapshot = {
      bb: { upper: 110, middle: 100, lower: 90 },
    };
    expect(getField(snap, "bb", "nonexistent")).toBeNull();
  });

  it("returns null when sub-field is not a number", () => {
    const snap: IndicatorSnapshot = {
      custom: { label: "test" },
    };
    expect(getField(snap, "custom", "label")).toBeNull();
  });

  it("returns null for null top-level value", () => {
    const snap: IndicatorSnapshot = { bb: null };
    expect(getField(snap, "bb", "lower")).toBeNull();
  });
});

describe("resolveNumber", () => {
  const snap: IndicatorSnapshot = {
    rsi: 55,
    bb: { upper: 110, middle: 100, lower: 90 },
    macd: { macd: 1.5, signal: 1.2, histogram: 0.3 },
  };

  it("resolves simple key to getNumber", () => {
    expect(resolveNumber(snap, "rsi")).toBe(55);
  });

  it("resolves dot-path to getField", () => {
    expect(resolveNumber(snap, "bb.lower")).toBe(90);
    expect(resolveNumber(snap, "macd.histogram")).toBe(0.3);
  });

  it("returns null for missing simple key", () => {
    expect(resolveNumber(snap, "nonexistent")).toBeNull();
  });

  it("returns null for invalid dot-path", () => {
    expect(resolveNumber(snap, "bb.nonexistent")).toBeNull();
  });

  it("returns null for dot-path with missing top-level key", () => {
    expect(resolveNumber(snap, "unknown.field")).toBeNull();
  });
});
