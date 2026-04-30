import { describe, expect, it } from "vitest";
import { checkBacktest, checkSignals, checkTrades, summarizeIssues } from "../core/validation";

describe("checkSignals", () => {
  it("rejects non-array input", () => {
    const res = checkSignals(null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/array/i);
  });

  it("accepts a valid array", () => {
    const res = checkSignals([
      { time: 1, type: "buy" },
      { time: 2, type: "sell", label: "x" },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toHaveLength(2);
  });

  it("filters out entries with missing or malformed fields", () => {
    const res = checkSignals([
      { time: 1, type: "buy" },
      { type: "sell" }, // missing time
      { time: 2 }, // missing type
      { time: 3, type: "hold" }, // bad type
      { time: "2026-01-01", type: "buy" }, // string time rejected
      { time: Number.NaN, type: "sell" }, // non-finite time rejected
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toHaveLength(1);
      expect(res.issues).toHaveLength(5);
    }
  });
});

describe("checkTrades", () => {
  it("rejects non-array input", () => {
    expect(checkTrades("nope").ok).toBe(false);
  });

  it("accepts a valid trade", () => {
    const res = checkTrades([{ entryTime: 1, entryPrice: 100, exitTime: 2, exitPrice: 110 }]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toHaveLength(1);
  });

  it("rejects non-finite prices", () => {
    const res = checkTrades([
      { entryTime: 1, entryPrice: Number.NaN, exitTime: 2, exitPrice: 110 },
      { entryTime: 1, entryPrice: 100, exitTime: 2, exitPrice: Number.POSITIVE_INFINITY },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toHaveLength(0);
      expect(res.issues).toHaveLength(2);
    }
  });

  it("rejects non-numeric times", () => {
    const res = checkTrades([
      { entryTime: "2026-01-01", entryPrice: 100, exitTime: 2, exitPrice: 110 },
      { entryTime: 1, entryPrice: 100, exitTime: new Date(0), exitPrice: 110 },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toHaveLength(0);
      expect(res.issues).toHaveLength(2);
    }
  });
});

describe("checkBacktest", () => {
  const validResult = {
    initialCapital: 10000,
    finalCapital: 12000,
    totalReturnPercent: 20,
    tradeCount: 5,
    winRate: 60,
    maxDrawdown: 8,
    sharpeRatio: 1.5,
    profitFactor: 2,
    trades: [],
    drawdownPeriods: [],
  };

  it("accepts a valid result", () => {
    expect(checkBacktest(validResult).ok).toBe(true);
  });

  it("rejects null", () => {
    const res = checkBacktest(null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/object/);
  });

  it("rejects when a required scalar is missing", () => {
    const { winRate: _w, ...rest } = validResult;
    const res = checkBacktest(rest);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/winRate/);
  });

  it("rejects when trades is not an array", () => {
    const res = checkBacktest({ ...validResult, trades: undefined });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/trades/);
  });

  it("rejects when drawdownPeriods is not an array", () => {
    const res = checkBacktest({ ...validResult, drawdownPeriods: undefined });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/drawdownPeriods/);
  });
});

describe("summarizeIssues", () => {
  it("returns undefined for empty input", () => {
    expect(summarizeIssues(undefined)).toBeUndefined();
    expect(summarizeIssues([])).toBeUndefined();
  });

  it("includes samples up to the limit", () => {
    const out = summarizeIssues(
      [
        { index: 0, reason: "a" },
        { index: 1, reason: "b" },
        { index: 2, reason: "c" },
        { index: 3, reason: "d" },
      ],
      2,
    ) as { rejected: number; samples: string[]; omitted?: number };
    expect(out.rejected).toBe(4);
    expect(out.samples).toHaveLength(2);
    expect(out.omitted).toBe(2);
  });
});
