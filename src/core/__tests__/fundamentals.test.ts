import { describe, expect, it } from "vitest";
import {
  parseFundamentals,
  createFundamentalsMap,
  getFundamentalsAt,
} from "../fundamentals";

describe("parseFundamentals", () => {
  it("should parse PER/PBR from CSV with standard format", () => {
    const csv = `date,open,high,low,close,volume,adjusted_close,per,pbr
2024/1/5,100,105,99,104,1000000,104,15.5,1.2
2024/1/6,104,110,103,108,1200000,108,16.0,1.25`;

    const result = parseFundamentals(csv);

    expect(result).toHaveLength(2);
    expect(result[0].per).toBe(15.5);
    expect(result[0].pbr).toBe(1.2);
    expect(result[1].per).toBe(16.0);
    expect(result[1].pbr).toBe(1.25);
  });

  it("should parse dates in YYYY-MM-DD format", () => {
    const csv = `date,open,high,low,close,volume,adjusted_close,per,pbr
2024-01-05,100,105,99,104,1000000,104,15.5,1.2`;

    const result = parseFundamentals(csv);

    expect(result).toHaveLength(1);
    expect(result[0].per).toBe(15.5);
  });

  it("should handle missing PER/PBR values as null", () => {
    const csv = `date,open,high,low,close,volume,adjusted_close,per,pbr
2024/1/5,100,105,99,104,1000000,104,,
2024/1/6,104,110,103,108,1200000,108,16.0,
2024/1/7,108,115,107,114,1100000,114,,1.3`;

    const result = parseFundamentals(csv);

    expect(result).toHaveLength(3);
    expect(result[0].per).toBeNull();
    expect(result[0].pbr).toBeNull();
    expect(result[1].per).toBe(16.0);
    expect(result[1].pbr).toBeNull();
    expect(result[2].per).toBeNull();
    expect(result[2].pbr).toBe(1.3);
  });

  it("should handle dash (-) as null value", () => {
    const csv = `date,open,high,low,close,volume,adjusted_close,per,pbr
2024/1/5,100,105,99,104,1000000,104,-,-`;

    const result = parseFundamentals(csv);

    expect(result[0].per).toBeNull();
    expect(result[0].pbr).toBeNull();
  });

  it("should normalize time to epoch milliseconds", () => {
    const csv = `date,open,high,low,close,volume,adjusted_close,per,pbr
2024/1/5,100,105,99,104,1000000,104,15.5,1.2`;

    const result = parseFundamentals(csv);

    // 2024-01-05 00:00:00 UTC
    const expectedTime = new Date("2024-01-05T00:00:00Z").getTime();
    expect(result[0].time).toBe(expectedTime);
  });

  it("should sort results by time ascending", () => {
    const csv = `date,open,high,low,close,volume,adjusted_close,per,pbr
2024/1/10,100,105,99,104,1000000,104,15.5,1.2
2024/1/5,104,110,103,108,1200000,108,16.0,1.25
2024/1/7,108,115,107,114,1100000,114,14.0,1.1`;

    const result = parseFundamentals(csv);

    expect(result).toHaveLength(3);
    expect(result[0].per).toBe(16.0); // Jan 5
    expect(result[1].per).toBe(14.0); // Jan 7
    expect(result[2].per).toBe(15.5); // Jan 10
  });

  it("should return empty array for empty content", () => {
    const result = parseFundamentals("");
    expect(result).toHaveLength(0);
  });

  it("should return empty array for header-only CSV", () => {
    const csv = `date,open,high,low,close,volume,adjusted_close,per,pbr`;
    const result = parseFundamentals(csv);
    expect(result).toHaveLength(0);
  });

  it("should support custom column indices", () => {
    const csv = `date,per,pbr
2024/1/5,15.5,1.2`;

    const result = parseFundamentals(csv, { perColumn: 1, pbrColumn: 2 });

    expect(result[0].per).toBe(15.5);
    expect(result[0].pbr).toBe(1.2);
  });

  it("should skip header when skipHeader is true (default)", () => {
    const csv = `date,open,high,low,close,volume,adjusted_close,per,pbr
2024/1/5,100,105,99,104,1000000,104,15.5,1.2`;

    const result = parseFundamentals(csv);
    expect(result).toHaveLength(1);
  });

  it("should not skip header when skipHeader is false", () => {
    const csv = `2024/1/5,100,105,99,104,1000000,104,15.5,1.2`;

    const result = parseFundamentals(csv, { skipHeader: false });
    expect(result).toHaveLength(1);
    expect(result[0].per).toBe(15.5);
  });
});

describe("createFundamentalsMap", () => {
  it("should create time-indexed map", () => {
    const csv = `date,open,high,low,close,volume,adjusted_close,per,pbr
2024/1/5,100,105,99,104,1000000,104,15.5,1.2
2024/1/6,104,110,103,108,1200000,108,16.0,1.25`;

    const fundamentals = parseFundamentals(csv);
    const map = createFundamentalsMap(fundamentals);

    expect(map.size).toBe(2);

    const jan5Time = new Date("2024-01-05T00:00:00Z").getTime();
    const metrics = map.get(jan5Time);
    expect(metrics?.per).toBe(15.5);
    expect(metrics?.pbr).toBe(1.2);
  });

  it("should handle empty array", () => {
    const map = createFundamentalsMap([]);
    expect(map.size).toBe(0);
  });

  it("should handle duplicate times (last wins)", () => {
    const fundamentals = [
      { time: 1000, per: 10, pbr: 1.0 },
      { time: 1000, per: 20, pbr: 2.0 },
    ];

    const map = createFundamentalsMap(fundamentals);

    expect(map.size).toBe(1);
    expect(map.get(1000)?.per).toBe(20);
  });
});

describe("getFundamentalsAt", () => {
  it("should return metrics for exact time match", () => {
    const fundamentals = [
      { time: 1000, per: 15.5, pbr: 1.2 },
      { time: 2000, per: 16.0, pbr: 1.25 },
    ];
    const map = createFundamentalsMap(fundamentals);

    const result = getFundamentalsAt(map, 1000);

    expect(result?.per).toBe(15.5);
    expect(result?.pbr).toBe(1.2);
  });

  it("should return undefined for missing time", () => {
    const fundamentals = [{ time: 1000, per: 15.5, pbr: 1.2 }];
    const map = createFundamentalsMap(fundamentals);

    const result = getFundamentalsAt(map, 9999);

    expect(result).toBeUndefined();
  });

  it("should return metrics with null values", () => {
    const fundamentals = [{ time: 1000, per: null, pbr: null }];
    const map = createFundamentalsMap(fundamentals);

    const result = getFundamentalsAt(map, 1000);

    expect(result).toBeDefined();
    expect(result?.per).toBeNull();
    expect(result?.pbr).toBeNull();
  });
});
