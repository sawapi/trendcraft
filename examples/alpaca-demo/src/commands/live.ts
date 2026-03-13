/**
 * CLI command: live
 *
 * Start live paper trading with one or more agents.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StrategyDefinition } from "trendcraft";
import { createAgentManager } from "../agent/manager.js";
import { createMarketState } from "../agent/market-state.js";
import { fetchCachedBars } from "../alpaca/cache.js";
import { createAlpacaClient } from "../alpaca/client.js";
import { monthsAgo, today } from "../alpaca/historical.js";
import type { AlpacaTimeframe } from "../alpaca/historical.js";
import { createAlpacaWebSocket } from "../alpaca/websocket.js";
import { loadEnv } from "../config/env.js";
import { DEFAULT_PORTFOLIO_GUARD } from "../config/portfolio.js";
import { DEFAULT_SYMBOLS } from "../config/symbols.js";
import { DEFAULT_TRADING_COSTS } from "../config/trading-costs.js";
import { applyExcludeList, getUniverse, getUniverseIds } from "../config/universe.js";
import { createDryRunExecutor } from "../executor/dry-run-executor.js";
import { createPaperExecutor } from "../executor/paper-executor.js";
import { formatReconciliation, reconcilePositions } from "../executor/reconciler.js";
import type { OrderExecutor } from "../executor/types.js";
import { createStateStore } from "../persistence/store.js";
import { loadCustomStrategies, loadOverrides, saveOverrides } from "../review/applier.js";
import { loadTodayIntraSessionReviews, saveIntraSessionRecord } from "../review/history.js";
import { buildIntraSessionReport } from "../review/intra-session-report.js";
import { validateIntraSessionActions } from "../review/intra-session-safety.js";
import { scheduleIntraSessionReview } from "../review/intra-session-scheduler.js";
import { reviewIntraSession } from "../review/llm-client.js";
import { scheduleReview } from "../review/scheduler.js";
import type { IntraSessionReviewRecord } from "../review/types.js";
import { scanUniverse } from "../scanner/index.js";
import { compileTemplate } from "../strategy/compiler.js";
import {
  applyStrategyOverrides,
  getAllStrategies,
  getMarketFilters,
  getStrategy,
  loadCustomStrategiesFromTemplates,
} from "../strategy/registry.js";
import {
  type ParameterOverride,
  applyOverrides as applyTemplateOverrides,
  getPresetTemplate,
  isSwingStrategy,
} from "../strategy/template.js";
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
  noIntraReview?: boolean;
  intraInterval?: string;
  verbose?: boolean;
  autoScan?: boolean;
  universe?: string;
  sector?: string;
  industry?: string;
  exclude?: string;
  top?: string;
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
    const ids = opts.strategy.split(",").map((id: string) => id.trim());
    strategies = [];
    for (const id of ids) {
      const s = getStrategy(id);
      if (!s) {
        console.error(`Unknown strategy: ${id}`);
        process.exit(1);
      }
      strategies.push(s);
    }
  } else if (opts.all) {
    strategies = getAllStrategies();
  } else {
    console.error("Specify --strategy <id> or --all");
    process.exit(1);
  }

  // Determine symbols
  let symbols: string[];
  if (opts.symbol) {
    symbols = [opts.symbol.toUpperCase()];
  } else if (opts.symbols) {
    symbols = opts.symbols.split(",").map((s) => s.trim().toUpperCase());
  } else if (opts.autoScan) {
    const universeId = opts.universe ?? "mega30";
    const universe = getUniverse(universeId, opts.sector, opts.industry);
    if (!universe) {
      console.error(`Unknown universe: ${universeId}. Available: ${getUniverseIds().join(", ")}`);
      process.exit(1);
    }
    const filtered = applyExcludeList(universe, opts.exclude);
    const top = opts.top ? Number.parseInt(opts.top, 10) : 5;
    const scanResult = await scanUniverse(env, filtered, universeId, { top });
    if (scanResult.candidates.length === 0) {
      console.error("[SCAN] No candidates found. Cannot start live trading.");
      process.exit(1);
    }
    symbols = scanResult.candidates.map((c) => c.symbol);
    console.log(`[SCAN] Selected ${symbols.length} symbols: ${symbols.join(", ")}`);
  } else {
    symbols = DEFAULT_SYMBOLS.slice(0, 2); // Default to first 2 symbols for live
  }

  // Create executor
  const executor: OrderExecutor = opts.dryRun
    ? createDryRunExecutor()
    : createPaperExecutor(client);

  // State management
  const store = createStateStore();
  const marketState = createMarketState();
  const manager = createAgentManager({
    capital,
    portfolioGuard: DEFAULT_PORTFOLIO_GUARD,
    marketState,
  });

  // Load market filters from strategy templates/overrides
  for (const [strategyId, filter] of getMarketFilters()) {
    manager.setMarketFilter(strategyId, filter);
  }
  function saveState(): void {
    const s = manager.getState();
    store.save(s.agents, s.portfolioGuardState);
  }

  // Try to restore state (skip inactive agents and filter to current strategies/symbols)
  const savedState = store.load();
  const activeStrategyIds = new Set(strategies.map((s) => s.id));
  const activeSymbols = new Set(symbols);
  if (savedState) {
    const strategyMap = new Map(getAllStrategies().map((s) => [s.id, s]));
    const activeAgents = savedState.agents.filter((a) => {
      if ((a as typeof a & { active?: boolean }).active === false) return false;
      // Only restore agents matching current strategies and symbols
      return activeStrategyIds.has(a.strategyId) && activeSymbols.has(a.symbol);
    });
    const skipped = savedState.agents.length - activeAgents.length;
    manager.restoreStates(activeAgents, strategyMap, savedState.portfolioGuardState);
    console.log(
      `Restored ${activeAgents.length} agents from saved state${skipped > 0 ? ` (${skipped} skipped)` : ""}`,
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

  // Ensure benchmark symbols are subscribed for market filter tracking
  const benchmarkSymbols = new Set<string>();
  for (const [, filter] of getMarketFilters()) {
    benchmarkSymbols.add(filter.symbol ?? "SPY");
  }
  const allSymbols = [...new Set([...manager.getSymbols(), ...benchmarkSymbols])];
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

  // Verbose ticker tracking
  const tickerStats = new Map<string, { count: number; last: number; volume: number }>();

  ws.onTrade((symbol, trade) => {
    // Update market state for benchmark tracking
    marketState.onTrade(symbol, trade.price, trade.time);

    if (opts.verbose) {
      const stat = tickerStats.get(symbol) ?? { count: 0, last: 0, volume: 0 };
      stat.count++;
      stat.last = trade.price;
      stat.volume += trade.volume;
      tickerStats.set(symbol, stat);
    }

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

  // Verbose ticker summary (every 30s)
  const VERBOSE_INTERVAL = 30 * 1000;
  const verboseTimer = opts.verbose
    ? setInterval(() => {
        if (tickerStats.size === 0) return;
        const parts: string[] = [];
        for (const [sym, stat] of tickerStats) {
          parts.push(`${sym} $${stat.last.toFixed(2)} (${stat.count} trades, vol ${stat.volume})`);
        }
        const time = new Date().toLocaleTimeString("en-US", { hour12: false });
        console.log(`[TICKER ${time}] ${parts.join(" | ")}`);
        // Reset counts for next interval
        for (const stat of tickerStats.values()) {
          stat.count = 0;
          stat.volume = 0;
        }
      }, VERBOSE_INTERVAL)
    : null;

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
    if (process.env.ANTHROPIC_API_KEY) {
      cancelReview = scheduleReview({
        onReview: () => executeReviewCycle({ apply: true }),
        onError: (err) => console.error("[SCHEDULER] Review error:", err),
      });
      console.log("Auto-review scheduler enabled (16:05 ET daily).");
    } else {
      console.log("[SCHEDULER] ANTHROPIC_API_KEY not set — auto-review disabled.");
    }
  }

  // Intra-session review scheduler
  const sessionStartTime = Date.now();
  let intraReviewNumber = loadTodayIntraSessionReviews().length;
  let cancelIntraReview: (() => void) | null = null;
  if (!opts.noIntraReview && process.env.ANTHROPIC_API_KEY) {
    const intraIntervalMin = Number.parseInt(opts.intraInterval ?? "30", 10);
    cancelIntraReview = scheduleIntraSessionReview({
      intervalMs: intraIntervalMin * 60 * 1000,
      onReview: async () => {
        intraReviewNumber++;
        const reviewNum = intraReviewNumber;
        console.log(`\n[INTRA] Starting intra-session review #${reviewNum}...`);

        // 1. Build report
        const report = buildIntraSessionReport(manager, sessionStartTime, reviewNum, marketState);

        // 2. Call LLM
        let recommendation: import("../review/types.js").LLMRecommendation;
        try {
          recommendation = await reviewIntraSession(report);
        } catch (err) {
          console.error("[INTRA] LLM call failed:", err instanceof Error ? err.message : err);
          return;
        }

        console.log(`[INTRA] Summary: ${recommendation.summary}`);
        console.log(`[INTRA] Actions proposed: ${recommendation.actions.length}`);

        // 3. Validate actions
        const todayIntraReviews = loadTodayIntraSessionReviews();
        const agentPositions = new Map<string, boolean>();
        for (const agent of manager.getAgents()) {
          const st = agent.getState();
          const hasPos =
            st.sessionState?.trackerState?.position != null &&
            st.sessionState.trackerState.position.shares > 0;
          agentPositions.set(agent.id, hasPos);
        }

        const { valid, rejected } = validateIntraSessionActions(
          recommendation,
          todayIntraReviews,
          agentPositions,
        );

        if (rejected.length > 0) {
          console.log(`[INTRA] Rejected: ${rejected.length}`);
          for (const r of rejected) {
            console.log(`  - [${r.action.action}] ${r.reason}`);
          }
        }

        // 4. Apply valid actions
        const appliedActions: IntraSessionReviewRecord["appliedActions"] = [];
        const rejectedActions: IntraSessionReviewRecord["rejectedActions"] = rejected;

        for (const action of valid) {
          try {
            if (action.action === "adjust_params") {
              // Build override and save to strategy-overrides.json
              const currentOverrides = loadOverrides();
              const override: ParameterOverride = {
                strategyId: action.strategyId,
                overrides: {
                  ...(action.changes.indicators && { indicators: action.changes.indicators }),
                  ...(action.changes.position && { position: action.changes.position }),
                  ...(action.changes.guards && { guards: action.changes.guards }),
                  ...(action.changes.marketFilter !== undefined && {
                    marketFilter: action.changes.marketFilter,
                  }),
                  ...(action.changes.entry && { entry: action.changes.entry }),
                  ...(action.changes.exit && { exit: action.changes.exit }),
                },
                appliedAt: Date.now(),
                reasoning: `[intra-#${reviewNum}] ${action.reasoning}`,
              };

              // Merge with existing
              const idx = currentOverrides.findIndex((o) => o.strategyId === action.strategyId);
              if (idx >= 0) {
                currentOverrides[idx] = {
                  ...currentOverrides[idx],
                  overrides: { ...currentOverrides[idx].overrides, ...override.overrides },
                  appliedAt: override.appliedAt,
                  reasoning: `${currentOverrides[idx].reasoning} | ${override.reasoning}`,
                };
              } else {
                currentOverrides.push(override);
              }
              saveOverrides(currentOverrides);

              // Hot-swap: recompile template and replace agent strategy
              const baseTemplate = getPresetTemplate(action.strategyId);
              if (baseTemplate) {
                const finalOverride = currentOverrides.find(
                  (o) => o.strategyId === action.strategyId,
                )!;
                const modified = applyTemplateOverrides(baseTemplate, finalOverride);
                const compiled = compileTemplate(modified);
                if (compiled.ok) {
                  const swapped = manager.replaceAgentStrategy(
                    `${action.strategyId}:${report.agents.find((a) => a.strategyId === action.strategyId)?.symbol ?? ""}`,
                    compiled.strategy,
                  );
                  // Try all agents for this strategy
                  if (!swapped) {
                    for (const agent of manager.getAgents()) {
                      if (agent.strategyId === action.strategyId) {
                        manager.replaceAgentStrategy(agent.id, compiled.strategy);
                      }
                    }
                  }
                  // Update market filter if changed
                  if (action.changes.marketFilter !== undefined) {
                    manager.setMarketFilter(action.strategyId, action.changes.marketFilter);
                  }
                  console.log(`[INTRA] Applied adjust_params for ${action.strategyId}`);
                } else {
                  console.warn(
                    `[INTRA] Template compile failed for ${action.strategyId}: ${compiled.error}`,
                  );
                }
              }

              appliedActions.push({ action });
            } else if (action.action === "kill_agent") {
              const agent = manager.getAgent(action.agentId);
              if (agent) {
                const { intents } = agent.close();
                for (const intent of intents) {
                  await executor.execute(intent);
                }
                manager.removeAgent(action.agentId);
                console.log(`[INTRA] Killed agent ${action.agentId}`);
                appliedActions.push({ action });
              } else {
                rejectedActions.push({ action, reason: `Agent "${action.agentId}" not found` });
              }
            } else if (action.action === "revive_agent") {
              const [strategyId, symbol] = action.agentId.split(":");
              const strategy = getStrategy(strategyId);
              if (strategy && symbol) {
                const { timeframe, lookbackMonths } = getWarmUpTimeframe(strategy.intervalMs);
                const warmUp = await fetchCachedBars(env, {
                  symbol,
                  timeframe,
                  start: monthsAgo(lookbackMonths),
                  end: today(),
                  limit: 200,
                });
                manager.addAgent(strategy, symbol, warmUp);
                console.log(`[INTRA] Revived agent ${action.agentId}`);
                appliedActions.push({ action });
              } else {
                rejectedActions.push({ action, reason: `Strategy "${strategyId}" not found` });
              }
            }
          } catch (err) {
            console.error(`[INTRA] Failed to apply ${action.action}:`, err);
            rejectedActions.push({
              action,
              reason: err instanceof Error ? err.message : String(err),
            });
          }
        }

        // 5. Save intra-session record
        const record: IntraSessionReviewRecord = {
          timestamp: Date.now(),
          reviewNumber: reviewNum,
          llmResponse: recommendation,
          appliedActions,
          rejectedActions,
        };
        const path = saveIntraSessionRecord(record);
        console.log(`[INTRA] Review #${reviewNum} saved: ${path}`);

        // Save state after changes
        saveState();
      },
      onError: (err) => console.error("[INTRA] Scheduler error:", err),
    });
    console.log(`Intra-session review enabled (every ${intraIntervalMin}min during market hours).`);
  }

  // Graceful shutdown
  async function shutdown(): Promise<void> {
    console.log("\nShutting down...");

    clearInterval(saveTimer);
    clearInterval(leaderboardTimer);
    clearInterval(heartbeatTimer);
    if (verboseTimer) clearInterval(verboseTimer);
    if (reconcileTimer) clearInterval(reconcileTimer);
    if (cancelReview) cancelReview();
    if (cancelIntraReview) cancelIntraReview();

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
