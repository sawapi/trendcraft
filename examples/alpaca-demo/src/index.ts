#!/usr/bin/env node
/**
 * Alpaca Demo — Multi-Agent Paper Trading System
 *
 * CLI entry point using commander.
 */

import { Command } from "commander";
import { backtestCommand } from "./commands/backtest.js";
import { liveCommand } from "./commands/live.js";
import { preflightCommand } from "./commands/preflight.js";
import { promoteCommand } from "./commands/promote.js";
import { reportCommand } from "./commands/report.js";
import { reviewCommand } from "./commands/review.js";
import { scanCommand } from "./commands/scan.js";
import { statusCommand } from "./commands/status.js";
import { updateUniverseCommand } from "./commands/update-universe.js";
import { getUniverseIds } from "./config/universe.js";
import { getAllIndustries, getAllSectors } from "./sec/index.js";
import { getStrategyIds } from "./strategy/registry.js";
import { consoleCommand } from "./tui/index.js";

const program = new Command();

program
  .name("alpaca-demo")
  .description("Multi-agent paper trading system using TrendCraft + Alpaca")
  .version("0.1.0");

program
  .command("backtest")
  .description("Run backtest tournament on historical data")
  .option("-s, --symbols <symbols>", "Comma-separated symbol list (e.g., AAPL,SPY)")
  .option("-p, --period <days>", "Override lookback period in days")
  .option("-c, --capital <amount>", "Initial capital per strategy", "100000")
  .option("-t, --timeframe <tf>", "Override timeframe for all strategies (1Min, 5Min, 1Hour, 1Day)")
  .action(backtestCommand);

program
  .command("live")
  .description("Start live paper trading")
  .option("-S, --strategy <id>", `Strategy ID (${getStrategyIds().join(", ")})`)
  .option("-s, --symbol <symbol>", "Single symbol")
  .option("--symbols <symbols>", "Comma-separated symbol list")
  .option("-a, --all", "Use all strategies")
  .option("-d, --dry-run", "Dry run (no real orders)")
  .option("-c, --capital <amount>", "Capital per agent", "100000")
  .option("--no-auto-review", "Disable automatic daily review after market close")
  .option("-v, --verbose", "Show ticker summary every 30s")
  .option("--auto-scan", "Auto-scan universe to select symbols before trading")
  .option(
    "-u, --universe <id>",
    `Universe for auto-scan (${getUniverseIds().join(", ")})`,
    "mega30",
  )
  .option("--sector <sector>", `Sector filter for SEC universe (${getAllSectors().join(", ")})`)
  .option(
    "--industry <industry>",
    `Industry filter for SEC universe (${getAllIndustries().join(", ")})`,
  )
  .option("--exclude <file>", "Exclude symbols file (default: data/exclude-symbols.txt)")
  .option("-n, --top <n>", "Number of top symbols from scan", "5")
  .option("--no-intra-review", "Disable intra-session LLM reviews")
  .option("--intra-interval <min>", "Intra-session review interval in minutes", "30")
  .action(liveCommand);

program
  .command("scan")
  .description("Scan symbol universe and rank candidates for trading")
  .option("-u, --universe <id>", `Universe to scan (${getUniverseIds().join(", ")})`, "mega30")
  .option("-s, --symbols <symbols>", "Comma-separated symbol list (overrides universe)")
  .option("--sector <sector>", `Sector filter for SEC universe (${getAllSectors().join(", ")})`)
  .option(
    "--industry <industry>",
    `Industry filter for SEC universe (${getAllIndustries().join(", ")})`,
  )
  .option("--exclude <file>", "Exclude symbols file (default: data/exclude-symbols.txt)")
  .option("-n, --top <n>", "Number of top candidates", "10")
  .option("--min-atr <pct>", "Minimum ATR% threshold", "1.0")
  .option("--min-volume <ratio>", "Minimum volume ratio vs 20-day avg", "0.5")
  .option("--rsi-min <value>", "Minimum RSI filter")
  .option("--rsi-max <value>", "Maximum RSI filter")
  .option("--lookback <days>", "Lookback period in days", "250")
  .option("--concurrency <n>", "Max concurrent API requests", "5")
  // Fundamental filters
  .option("--max-per <n>", "Maximum PER (Price/Earnings)")
  .option("--max-pbr <n>", "Maximum PBR (Price/Book)")
  .option("--max-psr <n>", "Maximum PSR (Price/Sales)")
  .option("--min-revenue-growth <pct>", "Minimum revenue growth % (YoY)")
  .option("--min-eps-growth <pct>", "Minimum EPS growth % (YoY)")
  .option("--min-gross-margin <pct>", "Minimum gross margin %")
  .option("--min-op-margin <pct>", "Minimum operating margin %")
  .option("--min-roe <pct>", "Minimum ROE %")
  .option("--max-de-ratio <n>", "Maximum Debt/Equity ratio")
  .action(scanCommand);

program.command("status").description("Show agent status and leaderboard").action(statusCommand);

program
  .command("promote")
  .description("Manually promote/demote an agent tier")
  .requiredOption("--agent <id>", "Agent ID (e.g., rsi-mean-reversion:AAPL)")
  .requiredOption("--tier <tier>", "Target tier (backtest, paper, live)")
  .action(promoteCommand);

program
  .command("review")
  .description("Generate review report and optionally apply LLM recommendations")
  .option("--report-only", "Generate report only (no LLM API call)")
  .option("--apply", "Apply validated LLM recommendations")
  .option("--days <n>", "Number of days of review history for LLM context", "7")
  .option("--from-backtest", "Review backtest results instead of live state")
  .option("-s, --symbols <symbols>", "Symbols for backtest (comma-separated)")
  .option("-p, --period <months>", "Backtest lookback period in months", "3")
  .option("-t, --timeframe <tf>", "Backtest timeframe (1Min, 1Day, etc.)", "1Day")
  .option("-c, --capital <amount>", "Capital for backtest", "100000")
  .action(reviewCommand);

program
  .command("preflight")
  .description("Run pre-launch checks before paper trading")
  .action(preflightCommand);

program
  .command("report")
  .description("Generate trade CSV export and/or tax summary report")
  .option("-y, --year <year>", "Tax year to report", String(new Date().getFullYear()))
  .option("-f, --format <format>", "Output format: csv, tax, or both", "both")
  .option("-o, --output <dir>", "Output directory", "./data")
  .action(reportCommand);

program
  .command("console")
  .description("Launch interactive TUI trading console")
  .option("-S, --strategy <id>", `Strategy ID (${getStrategyIds().join(", ")})`)
  .option("-s, --symbol <symbol>", "Single symbol")
  .option("--symbols <symbols>", "Comma-separated symbol list")
  .option("-a, --all", "Use all strategies")
  .option("-d, --dry-run", "Dry run (no real orders)")
  .option("-c, --capital <amount>", "Capital per agent", "100000")
  .option("--no-auto-review", "Disable automatic daily review after market close")
  .option("--no-intra-review", "Disable intra-session LLM reviews")
  .option("--intra-interval <min>", "Intra-session review interval in minutes", "30")
  .option("--auto-scan", "Auto-scan universe to select symbols before trading")
  .option(
    "-u, --universe <id>",
    `Universe for auto-scan (${getUniverseIds().join(", ")})`,
    "mega30",
  )
  .option("--sector <sector>", `Sector filter for SEC universe (${getAllSectors().join(", ")})`)
  .option(
    "--industry <industry>",
    `Industry filter for SEC universe (${getAllIndustries().join(", ")})`,
  )
  .option("--exclude <file>", "Exclude symbols file (default: data/exclude-symbols.txt)")
  .option("-n, --top <n>", "Number of top symbols from scan", "5")
  .action(consoleCommand);

program
  .command("update-universe")
  .description("Build/refresh SEC EDGAR universe cache with sector classification")
  .option("-f, --force", "Force full rebuild (ignore existing cache)")
  .option("--no-alpaca-filter", "Skip Alpaca tradable filter")
  .option("--with-fundamentals", "Also fetch financial data (EPS, revenue, etc.)")
  .option("--fundamentals-only", "Only update fundamentals cache (skip SIC rebuild)")
  .option("--repair-fundamentals", "Re-fetch only entries with missing data (e.g., EPS fix)")
  .action(updateUniverseCommand);

program.parse();
