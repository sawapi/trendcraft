import { describe, expect, it } from "vitest";
import { validateIndicatorParams } from "../validation/params";

describe("validateIndicatorParams", () => {
  it("returns silently when params is undefined", () => {
    expect(() => validateIndicatorParams("rsi", undefined)).not.toThrow();
  });

  it("rejects non-object params", () => {
    expect(() => validateIndicatorParams("rsi", 14 as unknown)).toThrow(/must be a plain object/);
    expect(() => validateIndicatorParams("rsi", "{}" as unknown)).toThrow(/must be a plain object/);
    expect(() => validateIndicatorParams("rsi", null as unknown)).toThrow(/must be a plain object/);
    expect(() => validateIndicatorParams("rsi", [14] as unknown)).toThrow(/must be a plain object/);
  });

  it("rejects null leaf values", () => {
    expect(() => validateIndicatorParams("rsi", { period: null })).toThrow(/is null/);
  });

  it("rejects nested objects", () => {
    expect(() => validateIndicatorParams("rsi", { period: { value: 14 } })).toThrow(
      /nested object/,
    );
  });

  it("accepts flat number arrays (e.g. KST rocPeriods)", () => {
    expect(() => validateIndicatorParams("kst", { rocPeriods: [10, 15, 20, 30] })).not.toThrow();
  });

  it("accepts flat string arrays (e.g. candlestickPatterns patterns)", () => {
    expect(() =>
      validateIndicatorParams("candlestickPatterns", { patterns: ["hammer", "doji"] }),
    ).not.toThrow();
  });

  it("accepts flat boolean arrays", () => {
    expect(() => validateIndicatorParams("dummy", { flags: [true, false, true] })).not.toThrow();
  });

  it("rejects nested arrays", () => {
    expect(() => validateIndicatorParams("kst", { rocPeriods: [[10], [15]] as unknown[] })).toThrow(
      /array of primitives/,
    );
  });

  it("rejects arrays containing NaN", () => {
    expect(() =>
      validateIndicatorParams("kst", { rocPeriods: [10, Number.NaN] as number[] }),
    ).toThrow(/array of primitives/);
  });

  it("rejects arrays containing null", () => {
    expect(() => validateIndicatorParams("kst", { rocPeriods: [10, null] as unknown[] })).toThrow(
      /array of primitives/,
    );
  });

  it("rejects NaN / Infinity numbers", () => {
    expect(() => validateIndicatorParams("rsi", { period: Number.NaN })).toThrow(/NaN/);
    expect(() => validateIndicatorParams("rsi", { period: Number.POSITIVE_INFINITY })).toThrow(
      /Infinity/,
    );
  });

  it("rejects string-where-number-expected on numeric-style keys", () => {
    expect(() => validateIndicatorParams("rsi", { period: "14" })).toThrow(
      /string \("14"\) but a number is expected/,
    );
  });

  it("does not auto-coerce numeric-style strings", () => {
    expect(() => validateIndicatorParams("macd", { fastPeriod: "12" })).toThrow();
  });

  it("accepts generic options not listed in manifest paramHints", () => {
    // SMA's manifest paramHints lists only `period`, but the indicator
    // accepts `source` (hl2 / hlc3 / etc.). The guard must not reject
    // it just because the manifest is curated rather than exhaustive.
    expect(() => validateIndicatorParams("sma", { period: 20, source: "hlc3" })).not.toThrow();
  });

  it("accepts known params with valid values (regression)", () => {
    expect(() => validateIndicatorParams("rsi", { period: 14 })).not.toThrow();
    expect(() =>
      validateIndicatorParams("macd", { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
    ).not.toThrow();
  });
});
