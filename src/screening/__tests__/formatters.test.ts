import { describe, expect, it } from "vitest";
import { formatCsv } from "../formatters/csv";
import { formatJson } from "../formatters/json";
import { formatTable } from "../formatters/table";
import type { ScreeningSessionResult } from "../types";

// =============================================================================
// Test Helper
// =============================================================================

function createSessionResult(
  overrides: Partial<ScreeningSessionResult> = {},
): ScreeningSessionResult {
  return {
    timestamp: new Date("2024-01-15T10:00:00Z").getTime(),
    criteria: {
      name: "Test Criteria",
      entryDescription: "goldenCross(5, 25)",
      exitDescription: "deadCross(5, 25)",
    },
    options: {
      dataPath: "/data",
      minDataPoints: 100,
    },
    summary: {
      totalFiles: 10,
      processedFiles: 8,
      skippedFiles: 2,
      entrySignals: 3,
      exitSignals: 1,
      processingTimeMs: 500,
    },
    results: [
      {
        ticker: "AAPL",
        entrySignal: true,
        exitSignal: false,
        currentPrice: 150.25,
        timestamp: new Date("2024-01-15").getTime(),
        atrPercent: 2.5432,
        metrics: { rsi14: 65.12, volume: 5000000, volumeRatio: 1.85 },
      },
      {
        ticker: "GOOG",
        entrySignal: false,
        exitSignal: true,
        currentPrice: 140.50,
        timestamp: new Date("2024-01-15").getTime(),
        atrPercent: 3.1234,
        metrics: { rsi14: 32.50, volume: 3000000, volumeRatio: 0.95 },
      },
      {
        ticker: "MSFT",
        entrySignal: false,
        exitSignal: false,
        currentPrice: 380.00,
        timestamp: new Date("2024-01-15").getTime(),
        atrPercent: 1.8765,
        metrics: { rsi14: 55.00, volume: 4000000, volumeRatio: 1.20 },
      },
    ],
    skipped: [],
    ...overrides,
  };
}

// =============================================================================
// formatCsv
// =============================================================================

describe("formatCsv", () => {
  it("should include header row", () => {
    const session = createSessionResult();
    const csv = formatCsv(session);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "ticker,entry_signal,exit_signal,price,atr_percent,rsi14,volume,volume_ratio,timestamp",
    );
  });

  it("should filter to only signaled results by default", () => {
    const session = createSessionResult();
    const csv = formatCsv(session);
    const lines = csv.split("\n");
    // header + 2 signaled results (AAPL entry, GOOG exit)
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("AAPL");
    expect(lines[2]).toContain("GOOG");
  });

  it("should include all results when showAll=true", () => {
    const session = createSessionResult();
    const csv = formatCsv(session, { showAll: true });
    const lines = csv.split("\n");
    // header + 3 results
    expect(lines).toHaveLength(4);
  });

  it("should return header only for empty results", () => {
    const session = createSessionResult({ results: [] });
    const csv = formatCsv(session);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(1);
  });

  it("should format entry/exit signal as 1/0", () => {
    const session = createSessionResult();
    const csv = formatCsv(session);
    const lines = csv.split("\n");
    // AAPL: entry=1, exit=0
    expect(lines[1]).toContain(",1,0,");
    // GOOG: entry=0, exit=1
    expect(lines[2]).toContain(",0,1,");
  });

  it("should escape ticker with comma", () => {
    const session = createSessionResult({
      results: [
        {
          ticker: 'Stock,Inc',
          entrySignal: true,
          exitSignal: false,
          currentPrice: 100,
          timestamp: new Date("2024-01-15").getTime(),
          atrPercent: 2.0,
          metrics: { rsi14: 50, volume: 1000000, volumeRatio: 1.0 },
        },
      ],
    });
    const csv = formatCsv(session);
    const lines = csv.split("\n");
    // Ticker with comma should be quoted
    expect(lines[1]).toMatch(/^"Stock,Inc"/);
  });

  it("should escape ticker with double quotes", () => {
    const session = createSessionResult({
      results: [
        {
          ticker: 'Stock"A',
          entrySignal: true,
          exitSignal: false,
          currentPrice: 100,
          timestamp: new Date("2024-01-15").getTime(),
          atrPercent: 2.0,
          metrics: { rsi14: 50, volume: 1000000, volumeRatio: 1.0 },
        },
      ],
    });
    const csv = formatCsv(session);
    const lines = csv.split("\n");
    // Quotes should be doubled and wrapped
    expect(lines[1]).toMatch(/^"Stock""A"/);
  });
});

// =============================================================================
// formatJson
// =============================================================================

describe("formatJson", () => {
  it("should filter to only signaled results by default", () => {
    const session = createSessionResult();
    const json = formatJson(session);
    const parsed = JSON.parse(json);
    // Only AAPL (entry) and GOOG (exit)
    expect(parsed.results).toHaveLength(2);
  });

  it("should include all results when showAll=true", () => {
    const session = createSessionResult();
    const json = formatJson(session, { showAll: true });
    const parsed = JSON.parse(json);
    expect(parsed.results).toHaveLength(3);
  });

  it("should pretty-print by default", () => {
    const session = createSessionResult();
    const json = formatJson(session);
    // Pretty-printed JSON contains newlines
    expect(json).toContain("\n");
  });

  it("should produce compact format when pretty=false", () => {
    const session = createSessionResult();
    const json = formatJson(session, { pretty: false });
    // Compact JSON has no newlines
    expect(json).not.toContain("\n");
  });

  it("should remove candles from output", () => {
    const session = createSessionResult({
      results: [
        {
          ticker: "AAPL",
          entrySignal: true,
          exitSignal: false,
          currentPrice: 150,
          timestamp: new Date("2024-01-15").getTime(),
          atrPercent: 2.5,
          metrics: { rsi14: 65, volume: 5000000, volumeRatio: 1.85 },
          candles: [
            { time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
          ],
        },
      ],
    });
    const json = formatJson(session);
    const parsed = JSON.parse(json);
    expect(parsed.results[0].candles).toBeUndefined();
  });

  it("should return valid JSON for empty results", () => {
    const session = createSessionResult({ results: [] });
    const json = formatJson(session);
    const parsed = JSON.parse(json);
    expect(parsed.results).toHaveLength(0);
  });
});

// =============================================================================
// formatTable
// =============================================================================

describe("formatTable", () => {
  it("should include header with timestamp", () => {
    const session = createSessionResult();
    const table = formatTable(session);
    expect(table).toContain("Stock Screening Results");
    expect(table).toContain("2024");
  });

  it("should include criteria information", () => {
    const session = createSessionResult();
    const table = formatTable(session);
    expect(table).toContain("Criteria: Test Criteria");
    expect(table).toContain("Entry: goldenCross(5, 25)");
    expect(table).toContain("Exit: deadCross(5, 25)");
  });

  it("should display ENTRY signal type", () => {
    const session = createSessionResult();
    const table = formatTable(session);
    expect(table).toContain("ENTRY");
  });

  it("should display EXIT signal type", () => {
    const session = createSessionResult();
    const table = formatTable(session);
    expect(table).toContain("EXIT");
  });

  it("should display BOTH when entry and exit signals", () => {
    const session = createSessionResult({
      results: [
        {
          ticker: "AAPL",
          entrySignal: true,
          exitSignal: true,
          currentPrice: 150,
          timestamp: new Date("2024-01-15").getTime(),
          atrPercent: 2.5,
          metrics: { rsi14: 65, volume: 5000000, volumeRatio: 1.85 },
        },
      ],
    });
    const table = formatTable(session);
    expect(table).toContain("BOTH");
  });

  it("should display 'No signals found' for empty results", () => {
    const session = createSessionResult({ results: [] });
    const table = formatTable(session);
    expect(table).toContain("No signals found");
  });

  it("should show minAtrPercent filter when set", () => {
    const session = createSessionResult({
      options: { dataPath: "/data", minDataPoints: 100, minAtrPercent: 2.3 },
    });
    const table = formatTable(session);
    expect(table).toContain("minAtrPercent >= 2.3%");
  });

  it("should not show filter line when minAtrPercent is not set", () => {
    const session = createSessionResult();
    const table = formatTable(session);
    expect(table).not.toContain("Filters:");
  });

  it("should include summary statistics", () => {
    const session = createSessionResult();
    const table = formatTable(session);
    expect(table).toContain("Total Files: 10");
    expect(table).toContain("Processed: 8");
    expect(table).toContain("Skipped: 2");
    expect(table).toContain("Entry Signals: 3");
    expect(table).toContain("Exit Signals: 1");
    expect(table).toContain("Processing Time: 500ms");
  });

  it("should filter by default to only signaled results", () => {
    const session = createSessionResult();
    const table = formatTable(session);
    // MSFT has no signal, should not appear
    expect(table).toContain("AAPL");
    expect(table).toContain("GOOG");
    expect(table).not.toContain("MSFT");
  });

  it("should include all results when showAll=true", () => {
    const session = createSessionResult();
    const table = formatTable(session, { showAll: true });
    expect(table).toContain("MSFT");
  });
});
