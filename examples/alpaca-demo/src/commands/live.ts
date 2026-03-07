/**
 * CLI command: live
 *
 * Start live paper trading with one or more agents.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "../config/env.js";
import { DEFAULT_SYMBOLS } from "../config/symbols.js";
import {
  getAllStrategies,
  getStrategy,
  loadCustomStrategiesFromTemplates,
  applyStrategyOverrides,
} from "../strategy/registry.js";
import { monthsAgo, today } from "../alpaca/historical.js";
import { fetchCachedBars } from "../alpaca/cache.js";
import { createAlpacaClient } from "../alpaca/client.js";
import { createAlpacaWebSocket } from "../alpaca/websocket.js";
import { createAgentManager } from "../agent/manager.js";
import { createPaperExecutor } from "../executor/paper-executor.js";
import { createDryRunExecutor } from "../executor/dry-run-executor.js";
import { reconcilePositions, formatReconciliation } from "../executor/reconciler.js";
import { createStateStore } from "../persistence/store.js";
import { getLeaderboard, formatLiveLeaderboard, evaluateAgent } from "../tracker/leaderboard.js";
import { loadOverrides, loadCustomStrategies } from "../review/applier.js";
import type { StrategyDefinition } from "../strategy/types.js";
import type { OrderExecutor } from "../executor/types.js";
import { scheduleReview } from "../review/scheduler.js";
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
  writeFileSync(
    HEARTBEAT_PATH,
    JSON.stringify({ pid: process.pid, time: Date.now() }),
    "utf-8",
  );
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
  const capital = parseInt(opts.capital ?? "100000", 10);
  const client = createAlpacaClient(env);

  // Dead-man's switch: check for stale heartbeat from crashed process
  const heartbeat = checkStaleHeartbeat();
  if (heartbeat.stale) {
    console.warn(
      `[RECOVERY] Stale heartbeat detected (last: ${new Date(heartbeat.lastTime!).toISOString()})`,
    );
    console.warn("[RECOVERY] Closing all positions from previous session...");
    try {
      await client.closeAllPositions();
      console.warn("[RECOVERY] All positions closed.");
    } catch (err) {
      console.error("[RECOVERY] Failed to close positions:", err);
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
    const { loaded, errors } = loadCustomStrategiesFromTemplates(
      customTemplates,
      overrides,
    );
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
  const manager = createAgentManager({ capital });

  // Try to restore state (skip inactive agents)
  const savedState = store.load();
  if (savedState) {
    const strategyMap = new Map(
      getAllStrategies().map((s) => [s.id, s]),
    );
    const activeAgents = savedState.agents.filter(
      (a) => (a as typeof a & { active?: boolean }).active !== false,
    );
    const skipped = savedState.agents.length - activeAgents.length;
    manager.restoreStates(activeAgents, strategyMap);
    console.log(
      `Restored ${activeAgents.length} agents from saved state` +
        (skipped > 0 ? ` (${skipped} inactive skipped)` : ""),
    );
  }

  // Create new agents for any strategy/symbol combos not already restored
  const existingAgentIds = new Set(manager.getAgents().map((a) => a.id));

  for (const strategy of strategies) {
    for (const symbol of symbols) {
      const agentId = `${strategy.id}:${symbol}`;
      if (existingAgentIds.has(agentId)) continue;

      // Fetch warm-up data (200 bars of 1-minute candles)
      console.log(`Fetching warm-up data for ${strategy.id}:${symbol}...`);
      const warmUp = await fetchCachedBars(env, {
        symbol,
        timeframe: "1Min",
        start: monthsAgo(1),
        end: today(),
        limit: 200,
      });

      manager.addAgent(strategy, symbol, warmUp);
      console.log(`  Agent created: ${agentId} (${warmUp.length} warm-up candles)`);
    }
  }

  const allSymbols = manager.getSymbols();
  console.log(
    `\nStarting live trading: ${manager.getAgents().length} agents on ${allSymbols.join(", ")}`,
  );
  console.log(opts.dryRun ? "Mode: DRY RUN (no real orders)" : "Mode: PAPER TRADING");

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
    store.save(manager.getAllStates());
  }, STATE_SAVE_INTERVAL);

  const leaderboardTimer = setInterval(() => {
    const agents = manager.getAgents();
    const board = getLeaderboard(agents);
    console.log(formatLiveLeaderboard(board));

    // Evaluate promotion/demotion
    for (const agent of agents) {
      const decision = evaluateAgent(agent);
      if (decision.action !== "hold") {
        console.log(
          `  [${decision.action.toUpperCase()}] ${agent.id}: ${decision.reason}`,
        );
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

    // Close all positions
    const closeIntents = manager.closeAll();
    for (const intent of closeIntents) {
      await executor.execute(intent);
    }

    // Save final state
    store.save(manager.getAllStates());

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
    store.save(manager.getAllStates());
    if (!opts.dryRun) {
      client.closeAllPositions().catch(() => {});
    }
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[CRASH] Unhandled rejection:", reason);
    store.save(manager.getAllStates());
  });

  console.log("\nListening for trades... (Ctrl+C to stop)\n");
}
