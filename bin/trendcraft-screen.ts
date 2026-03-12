#!/usr/bin/env node
/**
 * TrendCraft Stock Screener CLI
 *
 * Usage:
 *   npx trendcraft-screen <data-path> [options]
 *
 * Examples:
 *   npx trendcraft-screen ./examples/data --entry "goldenCross,volumeAnomaly"
 *   npx trendcraft-screen ./data --entry "perfectOrderBullish" --exit "perfectOrderCollapsed"
 *   npx trendcraft-screen ./data --output json > results.json
 *   npx trendcraft-screen ./data --min-atr 2.3 --all
 */

import { resolve } from "node:path";
import {
  createCriteriaFromNames,
  formatCsv,
  formatJson,
  formatTable,
  getAvailableConditions,
  runScreening,
} from "../src/screening";
import type { OutputFormat } from "../src/screening/types";

// Parse command line arguments
function parseArgs(args: string[]): {
  dataPath?: string;
  entry: string[];
  exit: string[];
  output: OutputFormat;
  minAtr?: number;
  minData: number;
  showAll: boolean;
  verbose: boolean;
  help: boolean;
  list: boolean;
} {
  const result = {
    dataPath: undefined as string | undefined,
    entry: [] as string[],
    exit: [] as string[],
    output: "table" as OutputFormat,
    minAtr: undefined as number | undefined,
    minData: 100,
    showAll: false,
    verbose: false,
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
        result.output = args[i] as OutputFormat;
      }
    } else if (arg === "--min-atr") {
      i++;
      if (args[i]) {
        result.minAtr = Number.parseFloat(args[i]);
      }
    } else if (arg === "--min-data") {
      i++;
      if (args[i]) {
        result.minData = Number.parseInt(args[i], 10);
      }
    } else if (arg === "--all" || arg === "-a") {
      result.showAll = true;
    } else if (arg === "--verbose" || arg === "-v") {
      result.verbose = true;
    } else if (!arg.startsWith("-")) {
      result.dataPath = arg;
    }

    i++;
  }

  // Default entry condition
  if (result.entry.length === 0) {
    result.entry = ["goldenCross", "volumeAnomaly"];
  }

  return result;
}

function printHelp(): void {
  console.log(`
TrendCraft Stock Screener

Usage:
  trendcraft-screen <data-path> [options]

Arguments:
  data-path              Directory containing CSV files

Options:
  -e, --entry <conds>    Entry conditions (comma-separated)
                         Default: goldenCross,volumeAnomaly
  -x, --exit <conds>     Exit conditions (comma-separated)
  -o, --output <format>  Output format: table, json, csv
                         Default: table
  --min-atr <percent>    Minimum ATR% filter (e.g., 2.3)
  --min-data <count>     Minimum data points required
                         Default: 100
  -a, --all              Show all stocks (not just signals)
  -v, --verbose          Verbose output
  -l, --list             List available condition names
  -h, --help             Show this help

Examples:
  # Basic screening with defaults
  trendcraft-screen ./examples/data

  # Custom entry conditions
  trendcraft-screen ./data --entry "goldenCross,rsiBelow40,volumeAnomaly"

  # With exit conditions
  trendcraft-screen ./data \\
    --entry "perfectOrderBullish,macdCrossUp" \\
    --exit "perfectOrderCollapsed,macdCrossDown"

  # JSON output
  trendcraft-screen ./data --output json > results.json

  # CSV output with all stocks
  trendcraft-screen ./data --output csv --all > all-stocks.csv

  # With ATR% filter
  trendcraft-screen ./data --min-atr 2.3 --entry "rangeBreakout,volumeAnomaly"
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
    "Volume Profile": [],
    "Volume (CMF/OBV)": [],
    "Range/Pattern": [],
    Volatility: [],
    "Price Patterns": [],
    SMC: [],
    Other: [],
  };

  for (const name of conditions) {
    if (
      name.includes("Cross") &&
      !name.includes("macd") &&
      !name.includes("stoch") &&
      !name.includes("obv")
    ) {
      categories["Moving Average Cross"].push(name);
    } else if (name.startsWith("rsi")) {
      categories.RSI.push(name);
    } else if (name.startsWith("macd")) {
      categories.MACD.push(name);
    } else if (
      name.includes("perfectOrder") ||
      name.includes("Perfect") ||
      name === "poPlusEntry" ||
      name === "pbEntry" ||
      name === "poPlusPbEntry"
    ) {
      categories["Perfect Order"].push(name);
    } else if (name.startsWith("cmf") || name.startsWith("obv")) {
      categories["Volume (CMF/OBV)"].push(name);
    } else if (
      [
        "nearPoc",
        "inValueArea",
        "breakoutVah",
        "breakdownVal",
        "priceAbovePoc",
        "priceBelowPoc",
      ].includes(name)
    ) {
      categories["Volume Profile"].push(name);
    } else if (name.includes("volume") || name.includes("Volume")) {
      categories.Volume.push(name);
    } else if (
      name.includes("range") ||
      name.includes("Range") ||
      name.includes("bollinger") ||
      name.includes("breakoutRisk")
    ) {
      categories["Range/Pattern"].push(name);
    } else if (name.includes("volatility") || name.includes("atrPercent")) {
      categories.Volatility.push(name);
    } else if (
      name.includes("OrderBlock") ||
      name.includes("orderBlock") ||
      name.includes("liquidity") ||
      name.includes("Sweep") ||
      name.includes("sweep")
    ) {
      categories.SMC.push(name);
    } else if (
      name.includes("Pattern") ||
      name.includes("Detected") ||
      name.includes("pattern") ||
      name.includes("double") ||
      name.includes("head") ||
      name.includes("inverse") ||
      name.includes("cup")
    ) {
      categories["Price Patterns"].push(name);
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

async function main(): Promise<void> {
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

  if (!options.dataPath) {
    console.error("Error: Data path is required\n");
    printHelp();
    process.exit(1);
  }

  const dataPath = resolve(options.dataPath);

  try {
    // Create criteria from names
    const criteria = createCriteriaFromNames(
      options.entry,
      options.exit.length > 0 ? options.exit : undefined,
    );

    if (options.verbose) {
      console.error(`Scanning: ${dataPath}`);
      console.error(`Entry: ${options.entry.join(", ")}`);
      if (options.exit.length > 0) {
        console.error(`Exit: ${options.exit.join(", ")}`);
      }
      if (options.minAtr) {
        console.error(`Min ATR%: ${options.minAtr}%`);
      }
      console.error("");
    }

    // Run screening
    const result = runScreening({
      dataPath,
      criteria,
      minDataPoints: options.minData,
      minAtrPercent: options.minAtr,
      onProgress: options.verbose
        ? (processed, total, ticker) => {
            process.stderr.write(`\rProcessing: ${processed}/${total} - ${ticker.padEnd(12)}`);
          }
        : undefined,
    });

    if (options.verbose) {
      console.error("\n");
    }

    // Output based on format
    if (options.output === "json") {
      console.log(formatJson(result, { showAll: options.showAll }));
    } else if (options.output === "csv") {
      console.log(formatCsv(result, { showAll: options.showAll }));
    } else {
      console.log(formatTable(result, { showAll: options.showAll }));
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

main();
