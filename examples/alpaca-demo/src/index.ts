#!/usr/bin/env node
/**
 * Alpaca Demo — Multi-Agent Paper Trading System
 *
 * CLI entry point using commander.
 */

import { Command } from "commander";
import { backtestCommand } from "./commands/backtest.js";
import { liveCommand } from "./commands/live.js";
import { promoteCommand } from "./commands/promote.js";
import { reviewCommand } from "./commands/review.js";
import { statusCommand } from "./commands/status.js";
import { getStrategyIds } from "./strategy/registry.js";

const program = new Command();

program
  .name("alpaca-demo")
  .description("Multi-agent paper trading system using TrendCraft + Alpaca")
  .version("0.1.0");

program
  .command("backtest")
  .description("Run backtest tournament on historical data")
  .option("-s, --symbols <symbols>", "Comma-separated symbol list (e.g., AAPL,SPY)")
  .option("-p, --period <months>", "Lookback period in months", "6")
  .option("-c, --capital <amount>", "Initial capital per strategy", "100000")
  .option("-t, --timeframe <tf>", "Bar timeframe (1Min, 5Min, 1Hour, 1Day)", "1Day")
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
  .action(liveCommand);

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

program.parse();
