/**
 * CLI command: live
 *
 * Start live paper trading with one or more agents.
 * Now delegates to TradingSession for core logic.
 */

import { DEFAULT_PORTFOLIO_GUARD } from "../config/portfolio.js";
import { loadTradingConfig, mergeConfigWithOpts } from "../config/trading-config.js";
import { DEFAULT_TRADING_COSTS } from "../config/trading-costs.js";
import { getStrategyIds } from "../strategy/registry.js";
import { createTradingSession } from "../trading/session.js";
import type { SessionOptions } from "../trading/session.js";
import { createLogger, setJsonOutput, setLogLevel } from "../util/logger.js";
import type { LogLevel } from "../util/logger.js";

const log = createLogger("LIVE");

export type LiveCommandOptions = SessionOptions & { config?: string };

export async function liveCommand(rawOpts: LiveCommandOptions): Promise<void> {
  // Load config file and merge with CLI options
  const config = loadTradingConfig(rawOpts.config);
  const opts = mergeConfigWithOpts(config, rawOpts) as LiveCommandOptions;

  // Apply config-level log settings
  if (config?.logLevel) setLogLevel(config.logLevel as LogLevel);
  if (config?.logJson) setJsonOutput(true);

  // Pass webhook config from trading.json to session options
  if (config?.webhook && !opts.webhook) {
    opts.webhook = config.webhook;
  }

  // Early validation — fail fast before session.init()
  if (!opts.strategy && !opts.all) {
    log.error(
      `No strategy specified.\nHint: Use --strategy <id> or --all. Run 'list strategies' to see available options.\nAvailable: ${getStrategyIds().join(", ")}`,
    );
    process.exit(1);
  }

  const session = createTradingSession(opts);

  try {
    await session.init();
  } catch (err) {
    log.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const capital = session.getCapital();
  const strategies = session.getStrategies();
  const allSymbols = session.getSymbols();
  const agentCount = session.getManager().getAgents().length;
  const mode = session.getMode();
  const tc = DEFAULT_TRADING_COSTS;

  // Startup summary banner
  console.log("");
  console.log(`\u2554${"\u2550".repeat(52)}\u2557`);
  console.log(`\u2551  ALPACA PAPER TRADING - STARTUP SUMMARY${" ".repeat(11)}\u2551`);
  console.log(`\u2560${"\u2550".repeat(52)}\u2563`);
  console.log(`\u2551  Mode:       ${mode.padEnd(38)}\u2551`);
  console.log(`\u2551  Strategies: ${String(strategies.length).padEnd(38)}\u2551`);
  console.log(`\u2551  Symbols:    ${allSymbols.join(", ").slice(0, 38).padEnd(38)}\u2551`);
  console.log(`\u2551  Agents:     ${String(agentCount).padEnd(38)}\u2551`);
  console.log(`\u2551  Capital:    ${`$${capital.toLocaleString()} per agent`.padEnd(38)}\u2551`);
  console.log(`\u2551  Tax Rate:   ${`${tc.taxRate}%`.padEnd(38)}\u2551`);
  console.log(
    `\u2551  Commission: ${`$${tc.commission} + ${tc.commissionRate}%`.padEnd(38)}\u2551`,
  );
  console.log(`\u2551  Slippage:   ${`${tc.slippage}%`.padEnd(38)}\u2551`);
  console.log(`\u255A${"\u2550".repeat(52)}\u255D`);

  // Agent count vs maxOpenPositions guard check
  const maxPositions = DEFAULT_PORTFOLIO_GUARD.maxOpenPositions ?? Number.POSITIVE_INFINITY;
  if (agentCount > maxPositions) {
    log.warn(
      `Agent count (${agentCount}) > maxOpenPositions (${maxPositions}). Not all agents can hold positions simultaneously.`,
    );
  }

  await session.start();

  log.info("Listening for trades... (Ctrl+C to stop)");

  // Graceful shutdown
  const shutdown = () => {
    session.stop().then(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Emergency handlers
  process.on("uncaughtException", (err) => {
    log.error("Crash: Uncaught exception:", err);
    // Save state via session's stop (best effort)
    try {
      const s = session.getManager().getState();
      session.getStore().save(s.agents, s.portfolioGuardState);
    } catch {
      // ignore
    }
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    log.error("Crash: Unhandled rejection:", reason);
    try {
      const s = session.getManager().getState();
      session.getStore().save(s.agents, s.portfolioGuardState);
    } catch {
      // ignore
    }
  });
}
