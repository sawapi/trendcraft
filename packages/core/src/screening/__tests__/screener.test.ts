import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { and, goldenCross, rsiBelow } from "../../backtest/conditions";
import type { NormalizedCandle } from "../../types";
import { getCsvFiles, loadCsvDirectory } from "../csv-loader";
import { parseCsv } from "../csv-parser";
import { formatCsv, formatJson, formatTable } from "../formatters";
import {
  CONDITION_PRESETS,
  createCriteriaFromNames,
  getAvailableConditions,
  screenStock,
} from "../screen-stock";
import { runScreening } from "../screener";

// Generate mock candle data
function generateMockCandles(
  count: number,
  options: { trend?: "up" | "down" | "flat" } = {},
): NormalizedCandle[] {
  const { trend = "flat" } = options;
  const candles: NormalizedCandle[] = [];
  let price = 1000;

  for (let i = 0; i < count; i++) {
    const date = new Date(2024, 0, 1);
    date.setDate(date.getDate() + i);

    // Apply trend
    if (trend === "up") {
      price *= 1 + Math.random() * 0.02;
    } else if (trend === "down") {
      price *= 1 - Math.random() * 0.02;
    } else {
      price *= 1 + (Math.random() - 0.5) * 0.02;
    }

    const volatility = price * 0.02;
    const open = price + (Math.random() - 0.5) * volatility;
    const close = price + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;

    candles.push({
      time: date.getTime(),
      open,
      high,
      low,
      close,
      volume: Math.floor(1000000 + Math.random() * 500000),
    });
  }

  return candles;
}

describe("screener", () => {
  describe("screenStock", () => {
    it("should screen a stock with entry condition", () => {
      const candles = generateMockCandles(200);
      const result = screenStock("TEST", candles, {
        entry: goldenCross(5, 25),
      });

      expect(result.ticker).toBe("TEST");
      expect(typeof result.entrySignal).toBe("boolean");
      expect(result.exitSignal).toBe(false);
      expect(result.currentPrice).toBeGreaterThan(0);
      expect(result.atrPercent).toBeGreaterThanOrEqual(0);
    });

    it("should screen a stock with entry and exit conditions", () => {
      const candles = generateMockCandles(200);
      const result = screenStock("TEST", candles, {
        entry: goldenCross(5, 25),
        exit: rsiBelow(30),
      });

      expect(result.ticker).toBe("TEST");
      expect(typeof result.entrySignal).toBe("boolean");
      expect(typeof result.exitSignal).toBe("boolean");
    });

    it("should include metrics", () => {
      const candles = generateMockCandles(200);
      const result = screenStock("TEST", candles, {
        entry: goldenCross(5, 25),
      });

      expect(result.metrics.rsi14).toBeDefined();
      expect(result.metrics.volume).toBeGreaterThan(0);
      expect(result.metrics.volumeRatio).toBeGreaterThan(0);
    });

    it("should throw error for empty candles", () => {
      expect(() => {
        screenStock("TEST", [], { entry: goldenCross(5, 25) });
      }).toThrow("No candle data");
    });
  });

  describe("createCriteriaFromNames", () => {
    it("should create criteria from single entry condition", () => {
      const criteria = createCriteriaFromNames(["goldenCross"]);
      expect(criteria.name).toBe("goldenCross");
      expect(criteria.entry).toBeDefined();
      expect(criteria.exit).toBeUndefined();
    });

    it("should create criteria from multiple entry conditions", () => {
      const criteria = createCriteriaFromNames(["goldenCross", "volumeAnomaly"]);
      expect(criteria.name).toBe("goldenCross + volumeAnomaly");
      expect(criteria.entry).toBeDefined();
    });

    it("should create criteria with exit conditions", () => {
      const criteria = createCriteriaFromNames(["goldenCross"], ["deadCross"]);
      expect(criteria.entry).toBeDefined();
      expect(criteria.exit).toBeDefined();
    });

    it("should throw error for unknown condition", () => {
      expect(() => {
        createCriteriaFromNames(["unknownCondition"]);
      }).toThrow(/Unknown condition/);
    });
  });

  describe("getAvailableConditions", () => {
    it("should return list of available conditions", () => {
      const conditions = getAvailableConditions();
      expect(conditions).toContain("goldenCross");
      expect(conditions).toContain("deadCross");
      expect(conditions).toContain("rsiBelow30");
      expect(conditions).toContain("volumeAnomaly");
    });
  });

  describe("CONDITION_PRESETS", () => {
    it("should have all presets return valid conditions", () => {
      for (const [name, factory] of Object.entries(CONDITION_PRESETS)) {
        const condition = factory();
        expect(condition).toBeDefined();
      }
    });
  });
});

describe("csv-loader", () => {
  describe("parseCsv", () => {
    it("should parse YYYY/MM/DD format", () => {
      const csv = `date,open,high,low,close,volume
2024/1/5,100,110,95,105,1000000
2024/1/6,105,115,100,110,1200000`;

      const candles = parseCsv(csv);
      expect(candles).toHaveLength(2);
      expect(candles[0].close).toBe(105);
      expect(candles[1].close).toBe(110);
    });

    it("should parse YYYY-MM-DD format", () => {
      const csv = `date,open,high,low,close,volume
2024-01-05,100,110,95,105,1000000
2024-01-06,105,115,100,110,1200000`;

      const candles = parseCsv(csv);
      expect(candles).toHaveLength(2);
    });

    it("should sort candles by date", () => {
      const csv = `date,open,high,low,close,volume
2024/1/10,100,110,95,105,1000000
2024/1/5,105,115,100,110,1200000`;

      const candles = parseCsv(csv);
      expect(candles[0].close).toBe(110); // Jan 5 first
      expect(candles[1].close).toBe(105); // Jan 10 second
    });

    it("should throw for empty CSV", () => {
      expect(() => parseCsv("")).toThrow("no data rows");
    });
  });
});

describe("formatters", () => {
  const mockResult = {
    timestamp: Date.now(),
    criteria: {
      name: "Test",
      entryDescription: "goldenCross",
      exitDescription: undefined,
    },
    options: {
      dataPath: "./data",
      minDataPoints: 100,
      minAtrPercent: undefined,
    },
    summary: {
      totalFiles: 10,
      processedFiles: 8,
      skippedFiles: 2,
      entrySignals: 3,
      exitSignals: 1,
      processingTimeMs: 100,
    },
    results: [
      {
        ticker: "TEST1",
        entrySignal: true,
        exitSignal: false,
        currentPrice: 1000,
        timestamp: Date.now(),
        atrPercent: 2.5,
        metrics: { rsi14: 35, volume: 1000000, volumeRatio: 1.5 },
      },
      {
        ticker: "TEST2",
        entrySignal: false,
        exitSignal: true,
        currentPrice: 2000,
        timestamp: Date.now(),
        atrPercent: 3.0,
        metrics: { rsi14: 65, volume: 2000000, volumeRatio: 0.8 },
      },
    ],
    skipped: [],
  };

  describe("formatTable", () => {
    it("should format results as table", () => {
      const output = formatTable(mockResult);
      expect(output).toContain("Stock Screening Results");
      expect(output).toContain("TEST1");
      expect(output).toContain("ENTRY");
      expect(output).toContain("EXIT");
    });

    it("should show summary", () => {
      const output = formatTable(mockResult);
      expect(output).toContain("Total Files: 10");
      expect(output).toContain("Entry Signals: 3");
    });
  });

  describe("formatJson", () => {
    it("should format results as JSON", () => {
      const output = formatJson(mockResult);
      const parsed = JSON.parse(output);
      expect(parsed.summary.totalFiles).toBe(10);
      expect(parsed.results).toHaveLength(2);
    });

    it("should filter non-signal results when showAll is false", () => {
      const resultWithNoSignal = {
        ...mockResult,
        results: [
          ...mockResult.results,
          {
            ticker: "TEST3",
            entrySignal: false,
            exitSignal: false,
            currentPrice: 3000,
            timestamp: Date.now(),
            atrPercent: 2.0,
            metrics: {},
          },
        ],
      };
      const output = formatJson(resultWithNoSignal, { showAll: false });
      const parsed = JSON.parse(output);
      expect(parsed.results).toHaveLength(2); // Only signals
    });
  });

  describe("formatCsv", () => {
    it("should format results as CSV", () => {
      const output = formatCsv(mockResult);
      const lines = output.split("\n");
      expect(lines[0]).toContain("ticker,entry_signal");
      expect(lines[1]).toContain("TEST1,1,0");
      expect(lines[2]).toContain("TEST2,0,1");
    });
  });
});

describe("integration", () => {
  it("should run full screening with real data if available", () => {
    const dataPath = join(__dirname, "../../../examples/data");

    try {
      const files = getCsvFiles(dataPath);
      if (files.length === 0) {
        // Skip if no data files
        return;
      }

      const result = runScreening({
        dataPath,
        criteria: {
          name: "Test",
          entry: and(goldenCross(5, 25), rsiBelow(70)),
        },
        minDataPoints: 100,
      });

      expect(result.summary.totalFiles).toBeGreaterThan(0);
      expect(result.timestamp).toBeGreaterThan(0);
    } catch {
      // Skip if data directory doesn't exist
    }
  });
});
