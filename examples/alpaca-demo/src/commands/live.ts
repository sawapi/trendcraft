/**
 * CLI command: live
 *
 * Start live paper trading with one or more agents.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StrategyDefinition } from "trendcraft";
import { createAgentManager } from "../agent/manager.js";
import { fetchCachedBars } from "../alpaca/cache.js";
import { createAlpacaClient } from "../alpaca/client.js";
import { monthsAgo, today } from "../alpaca/historical.js";
import type { AlpacaTimeframe } from "../alpaca/historical.js";
import { createAlpacaWebSocket } from "../alpaca/websocket.js";
import { loadEnv } from "../config/env.js";
import { DEFAULT_PORTFOLIO_GUARD } from "../config/portfolio.js";
import { DEFAULT_SYMBOLS } from "../config/symbols.js";
import { DEFAULT_TRADING_COSTS } from "../config/trading-costs.js";
import { createDryRunExecutor } from "../executor/dry-run-executor.js";
import { createPaperExecutor } from "../executor/paper-executor.js";
import { formatReconciliation, reconcilePositions } from "../executor/reconciler.js";
import type { OrderExecutor } from "../executor/types.js";
import { createStateStore } from "../persistence/store.js";
import { loadCustomStrategies, loadOverrides } from "../review/applier.js";
import { scheduleReview } from "../review/scheduler.js";
import {
  applyStrategyOverrides,
  getAllStrategies,
  getStrategy,
  loadCustomStrategiesFromTemplates,
} from "../strategy/registry.js";
import { isSwingStrategy } from "../strategy/template.js";
import { evaluateAgent, formatLiveLeaderboard, getLeaderboard } from "../tracker/leaderboard.js";
import { executeReviewCycle } from "./review.js";

const DATA_DIR = resolve(import.meta.dirname, "../../data");
const HEARTBEAT_PATH = resolve(DATA_DIR, "heartbeat.json");
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_HEARTBEAT_MS = 10 * 60 * 1000; // 10 minutes

export type LiveCommandOptions = {
  strategy?: string;
  symbol?: string;
  symbols?: string;
  dryRun?: boolean;
  all?: boolean;
  capital?: string;
  noAutoReview?: boolean;
};

function writeHeartbeat(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(HEARTBEAT_PATH, JSON.stringify({ pid: process.pid, time: Date.now() }), "utf-8");
}

function getWarmUpTimeframe(intervalMs: number): {
  timeframe: AlpacaTimeframe;
  lookbackMonths: number;
} {
  if (intervalMs >= 86_400_000) return { timeframe: "1Day", lookbackMonths: 12 };
  if (intervalMs >= 3_600_000) return { timeframe: "1Hour", lookbackMonths: 3 };
  return { timeframe: "1Min", lookbackMonths: 1 };
}

function checkStaleHeartbeat(): { stale: boolean; lastTime?: number } {
  if (!existsSync(HEARTBEAT_PATH)) return { stale: false };
  try {
    const data = JSON.parse(readFileSync(HEARTBEAT_PATH, "utf-8"));
    const age = Date.now() - data.time;
    if (age > STALE_HEARTBEAT_MS) {
      return { stale: true, lastTime: data.time };
    }
  } catch {
    // Corrupted heartbeat file
  }
  return { stale: false };
}

export async function liveCommand(opts: LiveCommandOptions): Promise<void> {
  const env = loadEnv();
  const capital = Number.parseInt(opts.capital ?? "100000", 10);
  const client = createAlpacaClient(env);

  // Dead-man's switch: check for stale heartbeat from crashed process
  const heartbeat = checkStaleHeartbeat();
  if (heartbeat.stale && !opts.dryRun) {
    console.warn(
      `[RECOVERY] Stale heartbeat detected (last: ${new Date(heartbeat.lastTime as number).toISOString()})`,
    );
    // Check if any active strategies are swing (overnight-holding).
    // If so, only warn — don't blindly close all positions.
    const allStrats = getAllStrategies();
    const hasSwing = allStrats.some((s) => isSwingStrategy(s));
    if (hasSwing) {
      console.warn("[RECOVERY] Swing strategies detected — skipping blanket position close.");
      console.warn("[RECOVERY] Swing positions may still be open from previous session.");
    } else {
      console.warn("[RECOVERY] Closing all positions from previous session...");
      try {
        await client.closeAllPositions();
        console.warn("[RECOVERY] All positions closed.");
      } catch (err) {
        console.error("[RECOVERY] Failed to close positions:", err);
      }
    }
  }

  // Load strategy overrides and custom strategies
  const overrides = loadOverrides();
  if (overrides.length > 0) {
    const { applied, errors } = applyStrategyOverrides(overrides);
    if (applied > 0) console.log(`Applied ${applied} strategy override(s)`);
    for (const err of errors) console.warn(`Override error: ${err}`);
  }

  const customTemplates = loadCustomStrategies();
  if (customTemplates.length > 0) {
    const { loaded, errors } = loadCustomStrategiesFromTemplates(customTemplates, overrides);
    if (loaded > 0) console.log(`Loaded ${loaded} custom strategy(ies)`);
    for (const err of errors) console.warn(`Custom strategy error: ${err}`);
  }

  // Determine strategies
  let strategies: StrategyDefinition[];
  if (opts.strategy) {
    const s = getStrategy(opts.strategy);
    if (!s) {
      console.error(`Unknown strategy: ${opts.strategy}`);
      process.exit(1);
    }
    strategies = [s];
  } else if (opts.all) {
    strategies = getAllStrategies();
  } else {
    console.error("Specify --strategy <id> or --all");
    process.exit(1);
  }

  // Determine symbols
  const symbols = opts.symbol
    ? [opts.symbol.toUpperCase()]
    : opts.symbols
      ? opts.symbols.split(",").map((s) => s.trim().toUpperCase())
      : DEFAULT_SYMBOLS.slice(0, 2); // Default to first 2 symbols for live

  // Create executor
  const executor: OrderExecutor = opts.dryRun
    ? createDryRunExecutor()
    : createPaperExecutor(client);

  // State management
  const store = createStateStore();
  const manager = createAgentManager({ capital, portfolioGuard: DEFAULT_PORTFOLIO_GUARD });
  function saveState(): void {
    const s = manager.getState();
    store.save(s.agents, s.portfolioGuardState);
  }

  // Try to restore state (skip inactive agents)
  const savedState = store.load();
  if (savedState) {
    const strategyMap = new Map(getAllStrategies().map((s) => [s.id, s]));
    const activeAgents = savedState.agents.filter(
      (a) => (a as typeof a & { active?: boolean }).active !== false,
    );
    const skipped = savedState.agents.length - activeAgents.length;
    manager.restoreStates(activeAgents, strategyMap, savedState.portfolioGuardState);
    console.log(
      `Restored ${activeAgents.length} agents from saved state${skipped > 0 ? ` (${skipped} inactive skipped)` : ""}`,
    );
  }

  // Create new agents for any strategy/symbol combos not already restored
  const existingAgentIds = new Set(manager.getAgents().map((a) => a.id));

  for (const strategy of strategies) {
    for (const symbol of symbols) {
      const agentId = `${strategy.id}:${symbol}`;
      if (existingAgentIds.has(agentId)) continue;

      // Fetch warm-up data with timeframe matching the strategy interval
      const { timeframe, lookbackMonths } = getWarmUpTimeframe(strategy.intervalMs);
      console.log(`Fetching warm-up data for ${strategy.id}:${symbol} (${timeframe})...`);
      const warmUp = await fetchCachedBars(env, {
        symbol,
        timeframe,
        start: monthsAgo(lookbackMonths),
        end: today(),
        limit: 200,
      });

      manager.addAgent(strategy, symbol, warmUp);
      console.log(`  Agent created: ${agentId} (${warmUp.length} warm-up candles)`);
    }
  }

  const allSymbols = manager.getSymbols();
  const agentCount = manager.getAgents().length;

  // Startup summary banner
  const mode = opts.dryRun ? "DRY RUN" : "PAPER TRADING";
  const stratNames = strategies.map((s) => s.id).join(", ");
  const symNames = allSymbols.join(", ");
  const tc = DEFAULT_TRADING_COSTS;

  console.log("");
  console.log(`\u2554${"\u2550".repeat(52)}\u2557`);
  console.log(`\u2551  ALPACA PAPER TRADING - STARTUP SUMMARY${" ".repeat(11)}\u2551`);
  console.log(`\u2560${"\u2550".repeat(52)}\u2563`);
  console.log(`\u2551  Mode:       ${mode.padEnd(38)}\u2551`);
  console.log(`\u2551  Strategies: ${String(strategies.length).padEnd(38)}\u2551`);
  console.log(`\u2551  Symbols:    ${symNames.slice(0, 38).padEnd(38)}\u2551`);
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
    console.warn(
      `\n[WARNING] Agent count (${agentCount}) > maxOpenPositions (${maxPositions}). Not all agents can hold positions simultaneously.`,
    );
  }

  // Connect WebSocket
  const ws = createAlpacaWebSocket(env);

  ws.onTrade((symbol, trade) => {
    const intents = manager.onTrade(symbol, trade);
    for (const intent of intents) {
      executor.execute(intent);
    }
  });

  ws.subscribe(allSymbols);

  // Periodic tasks
  const STATE_SAVE_INTERVAL = 5 * 60 * 1000; // 5 min
  const LEADERBOARD_INTERVAL = 60 * 60 * 1000; // 1 hour
  const RECONCILE_INTERVAL = 15 * 60 * 1000; // 15 min

  // Start heartbeat
  writeHeartbeat();
  const heartbeatTimer = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);

  const saveTimer = setInterval(() => {
    saveState();
  }, STATE_SAVE_INTERVAL);

  const leaderboardTimer = setInterval(() => {
    const agents = manager.getAgents();
    const board = getLeaderboard(agents);
    console.log(formatLiveLeaderboard(board));

    // Evaluate promotion/demotion
    for (const agent of agents) {
      const decision = evaluateAgent(agent);
      if (decision.action !== "hold") {
        console.log(`  [${decision.action.toUpperCase()}] ${agent.id}: ${decision.reason}`);
      }
    }
  }, LEADERBOARD_INTERVAL);

  // Position reconciliation (skip in dry-run mode)
  const reconcileTimer = opts.dryRun
    ? null
    : setInterval(async () => {
        try {
          const result = await reconcilePositions(client, manager);
          if (result.discrepancies.length > 0 || result.orphanedPositions.length > 0) {
            console.warn(formatReconciliation(result));
          }
        } catch (err) {
          console.error("[RECONCILE] Error:", err);
        }
      }, RECONCILE_INTERVAL);

  // Auto-review scheduler
  let cancelReview: (() => void) | null = null;
  if (!opts.noAutoReview) {
    cancelReview = scheduleReview({
      onReview: () => executeReviewCycle({ apply: true }),
      onError: (err) => console.error("[SCHEDULER] Review error:", err),
    });
    console.log("Auto-review scheduler enabled (16:05 ET daily).");
  }

  // Graceful shutdown
  async function shutdown(): Promise<void> {
    console.log("\nShutting down...");

    clearInterval(saveTimer);
    clearInterval(leaderboardTimer);
    clearInterval(heartbeatTimer);
    if (reconcileTimer) clearInterval(reconcileTimer);
    if (cancelReview) cancelReview();

    // Close day-trade positions, keep swing positions
    const agents = manager.getAgents();
    for (const agent of agents) {
      const strategy = getStrategy(agent.strategyId);
      if (strategy && isSwingStrategy(strategy)) {
        console.log(`[SHUTDOWN] Keeping position for swing agent: ${agent.id}`);
        continue;
      }
      const { intents } = agent.close();
      for (const intent of intents) {
        await executor.execute(intent);
      }
    }

    // Save final state
    saveState();

    // Print final leaderboard
    const board = getLeaderboard(manager.getAgents());
    console.log(formatLiveLeaderboard(board));

    ws.close();
    process.exit(0);
  }

  process.on("SIGINT", () => {
    shutdown();
  });
  process.on("SIGTERM", () => {
    shutdown();
  });

  // Emergency handlers: save state and close positions on crash
  process.on("uncaughtException", (err) => {
    console.error("[CRASH] Uncaught exception:", err);
    saveState();
    if (!opts.dryRun) {
      // Only close all if no swing strategies are active
      const hasSwing = strategies.some((s) => isSwingStrategy(s));
      if (!hasSwing) {
        client.closeAllPositions().catch(() => {});
      } else {
        console.warn("[CRASH] Swing strategies active — skipping blanket position close.");
      }
    }
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[CRASH] Unhandled rejection:", reason);
    saveState();
  });

  console.log("\nListening for trades... (Ctrl+C to stop)\n");
}
