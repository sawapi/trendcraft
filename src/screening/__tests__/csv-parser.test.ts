import { describe, expect, it } from "vitest";
import { parseCsv } from "../csv-parser";

describe("parseCsv", () => {
  it("should parse standard CSV with YYYY-MM-DD dates", () => {
    const csv = [
      "date,open,high,low,close,volume",
      "2024-01-01,100,110,95,105,1000000",
      "2024-01-02,105,115,100,110,1200000",
    ].join("\n");

    const candles = parseCsv(csv);
    expect(candles).toHaveLength(2);
    expect(candles[0].open).toBe(100);
    expect(candles[0].high).toBe(110);
    expect(candles[0].low).toBe(95);
    expect(candles[0].close).toBe(105);
    expect(candles[0].volume).toBe(1000000);
  });

  it("should parse YYYY/M/D date format and normalize", () => {
    const csv = [
      "date,open,high,low,close,volume",
      "2024/1/5,100,110,95,105,1000000",
      "2024/12/15,105,115,100,110,1200000",
    ].join("\n");

    const candles = parseCsv(csv);
    expect(candles).toHaveLength(2);
    // Should be normalized with time as number
    expect(typeof candles[0].time).toBe("number");
  });

  it("should sort candles by date ascending", () => {
    const csv = [
      "date,open,high,low,close,volume",
      "2024-01-03,110,120,105,115,1100000",
      "2024-01-01,100,110,95,105,1000000",
      "2024-01-02,105,115,100,110,1200000",
    ].join("\n");

    const candles = parseCsv(csv);
    expect(candles).toHaveLength(3);
    // Should be sorted ascending by time
    expect(candles[0].time).toBeLessThan(candles[1].time);
    expect(candles[1].time).toBeLessThan(candles[2].time);
  });

  it("should handle trailing newline", () => {
    const csv = [
      "date,open,high,low,close,volume",
      "2024-01-01,100,110,95,105,1000000",
      "",
    ].join("\n");

    const candles = parseCsv(csv);
    expect(candles).toHaveLength(1);
  });

  it("should throw when CSV has header only", () => {
    const csv = "date,open,high,low,close,volume";
    expect(() => parseCsv(csv)).toThrow("CSV file has no data rows");
  });

  it("should throw when CSV is empty", () => {
    expect(() => parseCsv("")).toThrow("CSV file has no data rows");
  });

  it("should throw when a row has fewer than 6 columns", () => {
    const csv = [
      "date,open,high,low,close,volume",
      "2024-01-01,100,110,95",
    ].join("\n");

    expect(() => parseCsv(csv)).toThrow("Invalid CSV format at line 2: expected at least 6 columns");
  });

  it("should accept 7+ columns (adjusted_close)", () => {
    const csv = [
      "date,open,high,low,close,volume,adjusted_close",
      "2024-01-01,100,110,95,105,1000000,104.5",
    ].join("\n");

    const candles = parseCsv(csv);
    expect(candles).toHaveLength(1);
    expect(candles[0].close).toBe(105);
  });

  it("should return candles with numeric time values after normalization", () => {
    const csv = [
      "date,open,high,low,close,volume",
      "2024-01-01,100,110,95,105,1000000",
    ].join("\n");

    const candles = parseCsv(csv);
    expect(typeof candles[0].time).toBe("number");
  });

  it("should parse decimal price values", () => {
    const csv = [
      "date,open,high,low,close,volume",
      "2024-01-01,100.50,110.75,95.25,105.30,1000000",
    ].join("\n");

    const candles = parseCsv(csv);
    expect(candles[0].open).toBeCloseTo(100.50, 2);
    expect(candles[0].high).toBeCloseTo(110.75, 2);
    expect(candles[0].low).toBeCloseTo(95.25, 2);
    expect(candles[0].close).toBeCloseTo(105.30, 2);
  });
});
