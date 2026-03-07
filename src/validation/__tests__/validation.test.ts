import { describe, expect, it } from "vitest";
import { normalizeAndValidate } from "../../core/normalize";
import type { NormalizedCandle } from "../../types";
import { detectDuplicates, removeDuplicates } from "../duplicate-detection";
import { detectGaps } from "../gap-detection";
import { detectOhlcErrors, detectPriceSpikes, detectVolumeAnomalies } from "../outlier-detection";
import { detectSplitHints } from "../split-detection";
import { detectStaleData } from "../stale-detection";
import { validateCandles } from "../validate";

// Helper to create test candles
function makeCandle(
  time: number,
  close: number,
  volume = 1000,
  open?: number,
  high?: number,
  low?: number,
): NormalizedCandle {
  const o = open ?? close;
  const h = high ?? Math.max(o, close) * 1.01;
  const l = low ?? Math.min(o, close) * 0.99;
  return { time, open: o, high: h, low: l, close, volume };
}

const DAY = 86400000;

describe("gap-detection", () => {
  it("detects time gaps", () => {
    const candles = [
      makeCandle(DAY * 1, 100),
      makeCandle(DAY * 2, 101),
      makeCandle(DAY * 5, 102), // 3-day gap
      makeCandle(DAY * 6, 103),
    ];
    const findings = detectGaps(candles, {
      maxGapMultiplier: 2,
      skipWeekends: false,
    });
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].category).toBe("gap");
  });

  it("skips weekend gaps when enabled", () => {
    // Create candles that span a weekend (Friday to Monday)
    // Jan 3, 2025 = Friday, Jan 6, 2025 = Monday
    const fri = new Date("2025-01-03T00:00:00Z").getTime();
    const mon = new Date("2025-01-06T00:00:00Z").getTime();
    const tue = new Date("2025-01-07T00:00:00Z").getTime();
    const candles = [makeCandle(fri, 100), makeCandle(mon, 101), makeCandle(tue, 102)];
    const findings = detectGaps(candles, {
      maxGapMultiplier: 2,
      skipWeekends: true,
    });
    expect(findings.length).toBe(0);
  });

  it("returns empty for fewer than 2 candles", () => {
    const findings = detectGaps([makeCandle(DAY, 100)]);
    expect(findings.length).toBe(0);
  });
});

describe("duplicate-detection", () => {
  it("detects duplicate timestamps", () => {
    const candles = [
      makeCandle(DAY, 100),
      makeCandle(DAY, 101), // duplicate
      makeCandle(DAY * 2, 102),
    ];
    const findings = detectDuplicates(candles);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("error");
  });

  it("removeDuplicates keeps last occurrence", () => {
    const candles = [makeCandle(DAY, 100), makeCandle(DAY, 101), makeCandle(DAY * 2, 102)];
    const cleaned = removeDuplicates(candles);
    expect(cleaned.length).toBe(2);
    expect(cleaned[0].close).toBe(101);
  });

  it("returns empty for no duplicates", () => {
    const candles = [makeCandle(DAY, 100), makeCandle(DAY * 2, 101)];
    const findings = detectDuplicates(candles);
    expect(findings.length).toBe(0);
  });
});

describe("outlier-detection", () => {
  it("detects OHLC inconsistencies", () => {
    const candles: NormalizedCandle[] = [
      { time: DAY, open: 100, high: 95, low: 90, close: 98, volume: 1000 }, // high < open
    ];
    const findings = detectOhlcErrors(candles);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe("error");
  });

  it("detects high < low", () => {
    const candles: NormalizedCandle[] = [
      { time: DAY, open: 100, high: 90, low: 95, close: 92, volume: 1000 },
    ];
    const findings = detectOhlcErrors(candles);
    const highLow = findings.find((f) => f.message.includes("High") && f.message.includes("< Low"));
    expect(highLow).toBeDefined();
  });

  it("detects price spikes", () => {
    const candles = [
      makeCandle(DAY, 100),
      makeCandle(DAY * 2, 130), // 30% jump
    ];
    const findings = detectPriceSpikes(candles, {
      maxPriceChangePercent: 20,
    });
    expect(findings.length).toBe(1);
  });

  it("does not flag normal price changes", () => {
    const candles = [
      makeCandle(DAY, 100),
      makeCandle(DAY * 2, 105), // 5% change
    ];
    const findings = detectPriceSpikes(candles, {
      maxPriceChangePercent: 20,
    });
    expect(findings.length).toBe(0);
  });

  it("detects volume anomalies", () => {
    // 20 normal volume bars with slight variation + 1 extreme spike
    const candles = Array.from({ length: 21 }, (_, i) =>
      makeCandle(DAY * (i + 1), 100 + i, i < 20 ? 1000 + (i % 3) * 10 : 100000),
    );
    const findings = detectVolumeAnomalies(candles, {
      zScoreThreshold: 4,
      lookback: 20,
    });
    expect(findings.length).toBe(1);
    expect(findings[0].category).toBe("volume");
  });
});

describe("stale-detection", () => {
  it("detects stale data", () => {
    const candles = Array.from({ length: 10 }, (_, i) => makeCandle(DAY * (i + 1), 100, 1000 + i));
    const findings = detectStaleData(candles, { minConsecutive: 5 });
    expect(findings.length).toBe(1);
  });

  it("does not flag varying prices", () => {
    const candles = Array.from({ length: 10 }, (_, i) => makeCandle(DAY * (i + 1), 100 + i));
    const findings = detectStaleData(candles, { minConsecutive: 5 });
    expect(findings.length).toBe(0);
  });

  it("detects stale streak at end of data", () => {
    const candles = [
      makeCandle(DAY, 100),
      makeCandle(DAY * 2, 105),
      ...Array.from({ length: 6 }, (_, i) => makeCandle(DAY * (i + 3), 110)),
    ];
    const findings = detectStaleData(candles, { minConsecutive: 5 });
    expect(findings.length).toBe(1);
  });
});

describe("split-detection", () => {
  it("detects 2:1 split hint", () => {
    const candles = [
      makeCandle(DAY, 200),
      makeCandle(DAY * 2, 100), // 50% drop = possible 2:1 split
    ];
    const findings = detectSplitHints(candles);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("info");
    expect(findings[0].category).toBe("split");
    expect(findings[0].message).toContain("2:1 split");
  });

  it("detects reverse split hint", () => {
    const candles = [
      makeCandle(DAY, 50),
      makeCandle(DAY * 2, 100), // 2x = possible 1:2 reverse split
    ];
    const findings = detectSplitHints(candles);
    expect(findings.length).toBe(1);
    expect(findings[0].message).toContain("reverse split");
  });

  it("does not flag normal price changes", () => {
    const candles = [
      makeCandle(DAY, 100),
      makeCandle(DAY * 2, 95), // 5% drop, not a split ratio
    ];
    const findings = detectSplitHints(candles);
    expect(findings.length).toBe(0);
  });
});

describe("validateCandles", () => {
  it("returns valid for clean data", () => {
    const candles = Array.from({ length: 10 }, (_, i) => makeCandle(DAY * (i + 1), 100 + i));
    const result = validateCandles(candles);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("autoClean removes duplicates and sorts", () => {
    const candles = [
      makeCandle(DAY * 2, 102),
      makeCandle(DAY, 100),
      makeCandle(DAY, 101), // duplicate
    ];
    const result = validateCandles(candles, { autoClean: true });
    expect(result.cleanedCandles).toBeDefined();
    expect(result.cleanedCandles?.length).toBe(2);
    expect(result.cleanedCandles?.[0].time).toBe(DAY);
  });

  it("accepts raw Candle[] with string time", () => {
    const candles = [
      {
        time: "2025-01-01",
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000,
      },
      {
        time: "2025-01-02",
        open: 102,
        high: 106,
        low: 100,
        close: 104,
        volume: 1100,
      },
    ];
    const result = validateCandles(candles);
    expect(result.valid).toBe(true);
  });

  it("respects disabled checks", () => {
    const candles = [
      makeCandle(DAY, 100),
      makeCandle(DAY, 101), // duplicate
    ];
    const result = validateCandles(candles, { duplicates: false });
    // Should not find duplicate errors when disabled
    expect(result.errors.filter((e) => e.category === "duplicate").length).toBe(0);
  });

  it("split hints are disabled by default", () => {
    const candles = [
      makeCandle(DAY, 200),
      makeCandle(DAY * 2, 100), // 2:1 split
    ];
    const result = validateCandles(candles);
    expect(result.info.filter((f) => f.category === "split").length).toBe(0);

    // Enable splits
    const resultWithSplits = validateCandles(candles, { splits: true });
    expect(resultWithSplits.info.filter((f) => f.category === "split").length).toBe(1);
  });
});

describe("normalizeAndValidate", () => {
  it("normalizes and validates", () => {
    const candles = [
      {
        time: "2025-01-01",
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000,
      },
      {
        time: "2025-01-02",
        open: 102,
        high: 106,
        low: 100,
        close: 104,
        volume: 1100,
      },
    ];
    const result = normalizeAndValidate(candles, {
      gaps: false,
      spikes: false,
      stale: false,
      volumeAnomalies: false,
    });
    expect(result.candles.length).toBe(2);
    expect(result.validation).toBeDefined();
    expect(result.validation?.valid).toBe(true);
  });

  it("returns candles without validation when no options", () => {
    const candles = [
      {
        time: "2025-01-01",
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000,
      },
    ];
    const result = normalizeAndValidate(candles);
    expect(result.candles.length).toBe(1);
    expect(result.validation).toBeUndefined();
  });
});
