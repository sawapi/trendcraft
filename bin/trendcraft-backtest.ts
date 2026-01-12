#!/usr/bin/env node
/**
 * TrendCraft Backtest CLI
 *
 * Usage:
 *   trendcraft-backtest <file-or-folder> [options]
 *
 * Examples:
 *   # Single file backtest (detailed output)
 *   trendcraft-backtest ./data/6758.T.csv --entry "goldenCross" --exit "deadCross"
 *
 *   # Multiple files backtest (comparison table)
 *   trendcraft-backtest ./data --entry "perfectOrderActiveBullish" --exit "perfectOrderCollapsed"
 *
 *   # With options
 *   trendcraft-backtest ./data --entry "goldenCross,volumeAnomaly" --stop-loss 5 --take-profit 10
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { runBacktest } from "../src/backtest/engine";
import { createCriteriaFromNames, getAvailableConditions, loadCsvFile } from "../src/screening";
import type { BacktestResult } from "../src/types";

import type { FillMode, SlTpMode } from "../src/types";

// Parse command line arguments
function parseArgs(args: string[]): {
  target?: string;
  entry: string[];
  exit: string[];
  output: "table" | "json" | "csv";
  capital: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  commission: number;
  fillMode: FillMode;
  slTpMode: SlTpMode;
  showTrades: boolean;
  help: boolean;
  list: boolean;
} {
  const result = {
    target: undefined as string | undefined,
    entry: [] as string[],
    exit: [] as string[],
    output: "table" as "table" | "json" | "csv",
    capital: 1000000,
    stopLoss: undefined as number | undefined,
    takeProfit: undefined as number | undefined,
    trailingStop: undefined as number | undefined,
    commission: 0,
    fillMode: "next-bar-open" as FillMode,
    slTpMode: "close-only" as SlTpMode,
    showTrades: false,
    help: false,
    list: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--list" || arg === "-l") {
      result.list = true;
    } else if (arg === "--entry" || arg === "-e") {
      i++;
      if (args[i]) {
        result.entry = args[i].split(",").map((s) => s.trim());
      }
    } else if (arg === "--exit" || arg === "-x") {
      i++;
      if (args[i]) {
        result.exit = args[i].split(",").map((s) => s.trim());
      }
    } else if (arg === "--output" || arg === "-o") {
      i++;
      if (args[i] && ["json", "table", "csv"].includes(args[i])) {
        result.output = args[i] as "table" | "json" | "csv";
      }
    } else if (arg === "--capital" || arg === "-c") {
      i++;
      if (args[i]) {
        result.capital = Number.parseInt(args[i], 10);
      }
    } else if (arg === "--stop-loss" || arg === "--sl") {
      i++;
      if (args[i]) {
        result.stopLoss = Number.parseFloat(args[i]);
      }
    } else if (arg === "--take-profit" || arg === "--tp") {
      i++;
      if (args[i]) {
        result.takeProfit = Number.parseFloat(args[i]);
      }
    } else if (arg === "--trailing-stop" || arg === "--ts") {
      i++;
      if (args[i]) {
        result.trailingStop = Number.parseFloat(args[i]);
      }
    } else if (arg === "--commission") {
      i++;
      if (args[i]) {
        result.commission = Number.parseFloat(args[i]);
      }
    } else if (arg === "--fill-mode") {
      i++;
      if (args[i] && ["next-bar-open", "same-bar-close"].includes(args[i])) {
        result.fillMode = args[i] as FillMode;
      }
    } else if (arg === "--sl-tp-mode") {
      i++;
      if (args[i] && ["close-only", "intraday"].includes(args[i])) {
        result.slTpMode = args[i] as SlTpMode;
      }
    } else if (arg === "--trades" || arg === "-t") {
      result.showTrades = true;
    } else if (!arg.startsWith("-")) {
      result.target = arg;
    }

    i++;
  }

  // Default conditions
  if (result.entry.length === 0) {
    result.entry = ["goldenCross"];
  }
  if (result.exit.length === 0) {
    result.exit = ["deadCross"];
  }

  return result;
}

function printHelp(): void {
  console.log(`
TrendCraft Backtest CLI

Usage:
  trendcraft-backtest <file-or-folder> [options]

Arguments:
  file-or-folder         CSV file or directory containing CSV files

Options:
  -e, --entry <conds>    Entry conditions (comma-separated)
                         Default: goldenCross
  -x, --exit <conds>     Exit conditions (comma-separated)
                         Default: deadCross
  -o, --output <format>  Output format: table, json, csv
                         Default: table
  -c, --capital <amount> Initial capital
                         Default: 1000000
  --stop-loss <percent>  Stop loss percentage (e.g., 5 for 5%)
  --take-profit <percent> Take profit percentage (e.g., 10 for 10%)
  --trailing-stop <percent> Trailing stop percentage
  --commission <amount>  Commission per trade
                         Default: 0
  --fill-mode <mode>     Order fill timing: next-bar-open, same-bar-close
                         Default: next-bar-open (no look-ahead bias)
  --sl-tp-mode <mode>    SL/TP check mode: close-only, intraday
                         Default: close-only (no look-ahead bias)
  -t, --trades           Show individual trades (single file only)
  -l, --list             List available condition names
  -h, --help             Show this help

Examples:
  # Single file with detailed output
  trendcraft-backtest ./data/6758.T.csv --entry "goldenCross" --exit "deadCross"

  # Multiple files comparison
  trendcraft-backtest ./data --entry "perfectOrderActiveBullish" --exit "perfectOrderCollapsed"

  # With risk management
  trendcraft-backtest ./data/6758.T.csv \\
    --entry "goldenCross,volumeAnomaly" \\
    --exit "deadCross" \\
    --stop-loss 5 --take-profit 10

  # JSON output
  trendcraft-backtest ./data --output json > results.json

  # Show individual trades
  trendcraft-backtest ./data/6758.T.csv --entry "goldenCross" --trades

  # With look-ahead bias settings (legacy mode)
  trendcraft-backtest ./data/6758.T.csv \\
    --fill-mode same-bar-close \\
    --sl-tp-mode intraday
`);
}

function printConditionList(): void {
  console.log("\nAvailable Condition Presets:\n");

  const conditions = getAvailableConditions();
  const categories: Record<string, string[]> = {
    "Moving Average Cross": [],
    RSI: [],
    MACD: [],
    "Perfect Order": [],
    Volume: [],
    "Range/Pattern": [],
    Other: [],
  };

  for (const name of conditions) {
    if (name.includes("Cross") && !name.includes("macd") && !name.includes("stoch")) {
      categories["Moving Average Cross"].push(name);
    } else if (name.startsWith("rsi")) {
      categories.RSI.push(name);
    } else if (name.startsWith("macd")) {
      categories.MACD.push(name);
    } else if (name.includes("perfectOrder") || name.includes("Perfect")) {
      categories["Perfect Order"].push(name);
    } else if (name.includes("volume") || name.includes("Volume")) {
      categories.Volume.push(name);
    } else if (name.includes("range") || name.includes("Range") || name.includes("bollinger")) {
      categories["Range/Pattern"].push(name);
    } else {
      categories.Other.push(name);
    }
  }

  for (const [category, names] of Object.entries(categories)) {
    if (names.length > 0) {
      console.log(`${category}:`);
      for (const name of names) {
        console.log(`  - ${name}`);
      }
      console.log("");
    }
  }
}

type BacktestResultWithTicker = BacktestResult & { ticker: string };

function formatSingleResult(
  ticker: string,
  result: BacktestResult,
  options: { showTrades: boolean },
): string {
  const lines: string[] = [];

  lines.push("=".repeat(70));
  lines.push(`Backtest Result: ${ticker}`);
  lines.push("=".repeat(70));
  lines.push("");

  lines.push("Performance Summary:");
  lines.push(`  Total Return:     ${result.totalReturnPercent.toFixed(2)}%`);
  lines.push(`  Trade Count:      ${result.tradeCount}`);
  lines.push(`  Win Rate:         ${result.winRate.toFixed(1)}%`);
  lines.push(`  Profit Factor:    ${result.profitFactor.toFixed(2)}`);
  lines.push(`  Max Drawdown:     ${result.maxDrawdown.toFixed(2)}%`);
  lines.push(`  Sharpe Ratio:     ${result.sharpeRatio.toFixed(3)}`);
  lines.push("");

  lines.push("Capital:");
  lines.push(`  Initial:          ${result.initialCapital.toLocaleString()}`);
  lines.push(`  Final:            ${result.finalCapital.toLocaleString()}`);
  lines.push("");

  if (options.showTrades && result.trades.length > 0) {
    lines.push("Individual Trades:");
    lines.push("-".repeat(70));
    lines.push(
      `${"Entry Date".padEnd(12)} | ${"Exit Date".padEnd(12)} | ${"Entry".padStart(8)} | ${"Exit".padStart(8)} | ${"Return".padStart(8)} | ${"Days".padStart(4)}`,
    );
    lines.push("-".repeat(70));

    for (const trade of result.trades) {
      const entryDate = new Date(trade.entryTime).toISOString().split("T")[0];
      const exitDate = new Date(trade.exitTime).toISOString().split("T")[0];
      const returnPct = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
      const holdingDays = Math.round((trade.exitTime - trade.entryTime) / (24 * 60 * 60 * 1000));

      lines.push(
        `${entryDate.padEnd(12)} | ${exitDate.padEnd(12)} | ${trade.entryPrice.toFixed(0).padStart(8)} | ${trade.exitPrice.toFixed(0).padStart(8)} | ${returnPct.toFixed(2).padStart(7)}% | ${holdingDays.toString().padStart(4)}`,
      );
    }
    lines.push("-".repeat(70));
  }

  return lines.join("\n");
}

function formatMultipleResults(results: BacktestResultWithTicker[]): string {
  const lines: string[] = [];

  lines.push("=".repeat(110));
  lines.push("Backtest Comparison");
  lines.push("=".repeat(110));
  lines.push("");

  // Summary stats
  const profitable = results.filter((r) => r.totalReturnPercent > 0);
  const avgReturn = results.reduce((sum, r) => sum + r.totalReturnPercent, 0) / results.length;

  lines.push("Summary:");
  lines.push(`  Total Stocks:     ${results.length}`);
  lines.push(
    `  Profitable:       ${profitable.length} (${((profitable.length / results.length) * 100).toFixed(0)}%)`,
  );
  lines.push(`  Average Return:   ${avgReturn.toFixed(2)}%`);
  lines.push("");

  // Table
  lines.push("-".repeat(110));
  lines.push(
    `| ${"Ticker".padEnd(12)} | ${"Trades".padStart(6)} | ${"WinRate".padStart(8)} | ${"Return".padStart(10)} | ${"MaxDD".padStart(8)} | ${"PF".padStart(6)} | ${"Sharpe".padStart(7)} |`,
  );
  lines.push("-".repeat(110));

  // Sort by return descending
  const sorted = [...results].sort((a, b) => b.totalReturnPercent - a.totalReturnPercent);

  for (const r of sorted) {
    lines.push(
      `| ${r.ticker.padEnd(12)} | ${r.tradeCount.toString().padStart(6)} | ${(`${r.winRate.toFixed(1)}%`).padStart(8)} | ${(`${r.totalReturnPercent.toFixed(2)}%`).padStart(10)} | ${(`${r.maxDrawdown.toFixed(2)}%`).padStart(8)} | ${r.profitFactor.toFixed(2).padStart(6)} | ${r.sharpeRatio.toFixed(3).padStart(7)} |`,
    );
  }

  lines.push("-".repeat(110));

  return lines.join("\n");
}

function formatResultsJson(results: BacktestResultWithTicker[]): string {
  return JSON.stringify(
    {
      summary: {
        totalStocks: results.length,
        profitable: results.filter((r) => r.totalReturnPercent > 0).length,
        averageReturn: results.reduce((sum, r) => sum + r.totalReturnPercent, 0) / results.length,
      },
      results: results.map((r) => ({
        ticker: r.ticker,
        tradeCount: r.tradeCount,
        winRate: r.winRate,
        totalReturnPercent: r.totalReturnPercent,
        maxDrawdown: r.maxDrawdown,
        profitFactor: r.profitFactor,
        sharpeRatio: r.sharpeRatio,
        initialCapital: r.initialCapital,
        finalCapital: r.finalCapital,
      })),
    },
    null,
    2,
  );
}

function formatResultsCsv(results: BacktestResultWithTicker[]): string {
  const lines: string[] = [];
  lines.push(
    "ticker,trades,win_rate,return_pct,max_drawdown,profit_factor,sharpe_ratio,initial_capital,final_capital",
  );

  for (const r of results) {
    lines.push(
      [
        r.ticker,
        r.tradeCount,
        r.winRate.toFixed(2),
        r.totalReturnPercent.toFixed(4),
        r.maxDrawdown.toFixed(4),
        r.profitFactor.toFixed(4),
        r.sharpeRatio.toFixed(4),
        r.initialCapital,
        r.finalCapital.toFixed(0),
      ].join(","),
    );
  }

  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.list) {
    printConditionList();
    process.exit(0);
  }

  if (!options.target) {
    console.error("Error: File or folder path is required\n");
    printHelp();
    process.exit(1);
  }

  const targetPath = resolve(options.target);

  if (!existsSync(targetPath)) {
    console.error(`Error: Path not found: ${targetPath}`);
    process.exit(1);
  }

  try {
    // Create conditions from names
    const criteria = createCriteriaFromNames(options.entry, options.exit);

    const backtestOptions = {
      capital: options.capital,
      commission: options.commission,
      stopLoss: options.stopLoss,
      takeProfit: options.takeProfit,
      trailingStop: options.trailingStop,
      fillMode: options.fillMode,
      slTpMode: options.slTpMode,
    };

    const stat = statSync(targetPath);

    if (stat.isFile()) {
      // Single file backtest
      const { ticker, candles } = loadCsvFile(targetPath);

      if (candles.length < 100) {
        console.error(`Error: Insufficient data (${candles.length} candles, need at least 100)`);
        process.exit(1);
      }

      const result = runBacktest(
        candles,
        criteria.entry,
        criteria.exit ?? criteria.entry,
        backtestOptions,
      );

      if (options.output === "json") {
        console.log(
          JSON.stringify(
            { ticker, ...result, trades: options.showTrades ? result.trades : undefined },
            null,
            2,
          ),
        );
      } else {
        console.log(formatSingleResult(ticker, result, { showTrades: options.showTrades }));
      }
    } else {
      // Multiple files backtest
      const files = readdirSync(targetPath).filter((f) => f.endsWith(".csv"));

      if (files.length === 0) {
        console.error("Error: No CSV files found in directory");
        process.exit(1);
      }

      const results: BacktestResultWithTicker[] = [];

      for (const file of files) {
        const filepath = join(targetPath, file);
        try {
          const { ticker, candles } = loadCsvFile(filepath);

          if (candles.length < 100) {
            continue; // Skip files with insufficient data
          }

          const result = runBacktest(
            candles,
            criteria.entry,
            criteria.exit ?? criteria.entry,
            backtestOptions,
          );

          results.push({ ticker, ...result });
        } catch {
          // Skip files that fail to load
        }
      }

      if (results.length === 0) {
        console.error("Error: No valid data files found");
        process.exit(1);
      }

      if (options.output === "json") {
        console.log(formatResultsJson(results));
      } else if (options.output === "csv") {
        console.log(formatResultsCsv(results));
      } else {
        console.log(formatMultipleResults(results));
      }
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

main();
