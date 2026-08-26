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
import { parseScreenArgs } from "../src/screening/cli-args";

function printHelp(): void {
  console.log(`
TrendCraft Stock Screener

Usage:
  trendcraft-screen <data-path> [options]

Arguments:
  data-path              Directory containing CSV files

Options (long options also accept --opt=value):
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

const VOLUME_PROFILE_NAMES = new Set([
  "nearPoc",
  "inValueArea",
  "breakoutVah",
  "breakdownVal",
  "priceAbovePoc",
  "priceBelowPoc",
]);

const PERFECT_ORDER_NAMES = new Set(["poPlusEntry", "pbEntry", "poPlusPbEntry"]);

/**
 * Categorization rules applied in order. First match wins.
 * Each rule is [category, predicate].
 */
const CATEGORY_RULES: Array<[string, (name: string) => boolean]> = [
  [
    "Moving Average Cross",
    (n) => n.includes("Cross") && !n.includes("macd") && !n.includes("stoch") && !n.includes("obv"),
  ],
  ["RSI", (n) => n.startsWith("rsi")],
  ["MACD", (n) => n.startsWith("macd")],
  [
    "Perfect Order",
    (n) => n.includes("perfectOrder") || n.includes("Perfect") || PERFECT_ORDER_NAMES.has(n),
  ],
  ["Volume (CMF/OBV)", (n) => n.startsWith("cmf") || n.startsWith("obv")],
  ["Volume Profile", (n) => VOLUME_PROFILE_NAMES.has(n)],
  ["Volume", (n) => /volume/i.test(n)],
  ["Range/Pattern", (n) => /range|bollinger|breakoutRisk/i.test(n)],
  ["Volatility", (n) => n.includes("volatility") || n.includes("atrPercent")],
  ["SMC", (n) => /orderBlock|liquidity|sweep/i.test(n)],
  ["Price Patterns", (n) => /pattern|Detected|double|head|inverse|cup/i.test(n)],
];

function categorizeCondition(name: string): string {
  for (const [category, predicate] of CATEGORY_RULES) {
    if (predicate(name)) return category;
  }
  return "Other";
}

function printConditionList(): void {
  console.log("\nAvailable Condition Presets:\n");

  const conditions = getAvailableConditions();
  const categories = new Map<string, string[]>();

  for (const name of conditions) {
    const category = categorizeCondition(name);
    const list = categories.get(category) ?? [];
    list.push(name);
    categories.set(category, list);
  }

  for (const [category, names] of categories) {
    console.log(`${category}:`);
    for (const name of names) {
      console.log(`  - ${name}`);
    }
    console.log("");
  }
}

async function main(): Promise<void> {
  const parsed = parseScreenArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exit(1);
  }
  const options = parsed.args;

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
