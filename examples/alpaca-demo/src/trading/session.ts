/**
 * TradingSession — extracted core logic from live command
 *
 * Provides a reusable session that can be driven by both the CLI (liveCommand)
 * and the TUI console.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StrategyDefinition } from "trendcraft";
import { createAgentManager } from "../agent/manager.js";
import type { AgentManager } from "../agent/manager.js";
import { createMarketState } from "../agent/market-state.js";
import type { MarketState } from "../agent/market-state.js";
import { fetchCachedBars } from "../alpaca/cache.js";
import { createAlpacaClient } from "../alpaca/client.js";
import { monthsAgo, today } from "../alpaca/historical.js";
import type { AlpacaTimeframe } from "../alpaca/historical.js";
import { createAlpacaWebSocket } from "../alpaca/websocket.js";
import { executeReviewCycle } from "../commands/review.js";
import type { AlpacaEnv } from "../config/env.js";
import { loadEnv } from "../config/env.js";
import { INTERVALS } from "../config/intervals.js";
import { DEFAULT_MAX_SECTOR_POSITIONS, DEFAULT_PORTFOLIO_GUARD } from "../config/portfolio.js";
import { DEFAULT_SYMBOLS } from "../config/symbols.js";
import { applyExcludeList, getUniverse, getUniverseIds } from "../config/universe.js";
import { createDryRunExecutor } from "../executor/dry-run-executor.js";
import { createPaperExecutor } from "../executor/paper-executor.js";
import { formatReconciliation, reconcilePositions } from "../executor/reconciler.js";
import type { OrderExecutor } from "../executor/types.js";
import { createStateStore } from "../persistence/store.js";
import type { StateStore } from "../persistence/store.js";
import { loadCustomStrategies, loadOverrides } from "../review/applier.js";
import { loadTodayIntraSessionReviews, saveIntraSessionRecord } from "../review/history.js";
import { applyIntraSessionActions } from "../review/intra-session-applier.js";
import { buildIntraSessionReport } from "../review/intra-session-report.js";
import { validateIntraSessionActions } from "../review/intra-session-safety.js";
import { scheduleIntraSessionReview } from "../review/intra-session-scheduler.js";
import { reviewIntraSession } from "../review/llm-client.js";
import { scheduleReview } from "../review/scheduler.js";
import type { IntraSessionReviewRecord, LLMRecommendation } from "../review/types.js";
import { buildSectorMap } from "../risk/correlation-guard.js";
import { createEarningsGuard, fetchEarningsCalendar } from "../risk/earnings-guard.js";
import { scanUniverse } from "../scanner/index.js";
import { preflightOptimize } from "../strategy/auto-optimizer.js";
import {
  applyStrategyOverrides,
  getAllStrategies,
  getMarketFilters,
  getStrategy,
  loadCustomStrategiesFromTemplates,
} from "../strategy/registry.js";
import { createStrategyRotator } from "../strategy/rotator.js";
import type { RegimeSnapshot, StrategyRotator } from "../strategy/rotator.js";
import { isSwingStrategy } from "../strategy/template.js";
import { evaluateAgent, formatLiveLeaderboard, getLeaderboard } from "../tracker/leaderboard.js";
import type { TradingEvent } from "./events.js";

const DATA_DIR = resolve(import.meta.dirname, "../../data");
const HEARTBEAT_PATH = resolve(DATA_DIR, "heartbeat.json");

export type SessionOptions = {
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

export type TradingSession = {
  /** Initialize the session (resolve strategies, symbols, create agents) */
  init(): Promise<void>;
  /** Start WebSocket connection and periodic tasks */
  start(): Promise<void>;
  /** Stop trading and save state */
  stop(): Promise<void>;
  /** Get the agent manager */
  getManager(): AgentManager;
  /** Get the market state tracker */
  getMarketState(): MarketState;
  /** Get the order executor */
  getExecutor(): OrderExecutor;
  /** Get the state store */
  getStore(): StateStore;
  /** Whether the session is currently running */
  isRunning(): boolean;
  /** Whether the session has been initialized */
  isInitialized(): boolean;
  /** Subscribe to trading events */
  onEvent(handler: (event: TradingEvent) => void): () => void;
  /** Get resolved strategies */
  getStrategies(): StrategyDefinition[];
  /** Get resolved symbols */
  getSymbols(): string[];
  /** Get session mode string */
  getMode(): string;
  /** Get session start time */
  getStartTime(): number;
  /** Get the capital per agent */
  getCapital(): number;
  /** Get the environment config */
  getEnv(): AlpacaEnv;
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
    if (age > INTERVALS.staleHeartbeatMs) {
      return { stale: true, lastTime: data.time };
    }
  } catch {
    // Corrupted heartbeat file
  }
  return { stale: false };
}

export function createTradingSession(opts: SessionOptions): TradingSession {
  const env = loadEnv();
  const capital = Number.parseInt(opts.capital ?? "100000", 10);
  const client = createAlpacaClient(env);

  let strategies: StrategyDefinition[] = [];
  let symbols: string[] = [];
  let manager: AgentManager;
  let marketState: MarketState;
  let executor: OrderExecutor;
  let store: StateStore;
  let running = false;
  let initialized = false;
  let sessionStartTime = 0;

  // Event handling
  const eventHandlers = new Set<(event: TradingEvent) => void>();
  function emit(event: TradingEvent): void {
    for (const handler of eventHandlers) {
      try {
        handler(event);
      } catch {
        // Don't crash on handler errors
      }
    }
  }

  // Timer references for cleanup
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let saveTimer: ReturnType<typeof setInterval> | null = null;
  let leaderboardTimer: ReturnType<typeof setInterval> | null = null;
  let verboseTimer: ReturnType<typeof setInterval> | null = null;
  let reconcileTimer: ReturnType<typeof setInterval> | null = null;
  let cancelReview: (() => void) | null = null;
  let cancelIntraReview: (() => void) | null = null;
  let rotationTimer: ReturnType<typeof setInterval> | null = null;
  let intraReviewNumber = 0;
  let rotator: StrategyRotator | null = null;

  // WebSocket reference
  let ws: ReturnType<typeof createAlpacaWebSocket> | null = null;

  // Verbose ticker tracking
  const tickerStats = new Map<string, { count: number; last: number; volume: number }>();

  function saveState(): void {
    const s = manager.getState();
    store.save(s.agents, s.portfolioGuardState);
    emit({ type: "state-saved", agentCount: s.agents.length });
  }

  const session: TradingSession = {
    async init() {
      // Dead-man's switch
      const heartbeat = checkStaleHeartbeat();
      if (heartbeat.stale && !opts.dryRun) {
        console.warn(
          `[RECOVERY] Stale heartbeat detected (last: ${new Date(heartbeat.lastTime as number).toISOString()})`,
        );
        const allStrats = getAllStrategies();
        const hasSwing = allStrats.some((s) => isSwingStrategy(s));
        if (hasSwing) {
          console.warn("[RECOVERY] Swing strategies detected — skipping blanket position close.");
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

      // Load overrides and custom strategies
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
      if (opts.strategy) {
        const ids = opts.strategy.split(",").map((id: string) => id.trim());
        strategies = [];
        for (const id of ids) {
          const s = getStrategy(id);
          if (!s) {
            throw new Error(`Unknown strategy: ${id}`);
          }
          strategies.push(s);
        }
      } else if (opts.all) {
        strategies = getAllStrategies();
      } else {
        throw new Error("Specify --strategy <id> or --all");
      }

      // Determine symbols
      if (opts.symbol) {
        symbols = [opts.symbol.toUpperCase()];
      } else if (opts.symbols) {
        symbols = opts.symbols.split(",").map((s) => s.trim().toUpperCase());
      } else if (opts.autoScan) {
        const universeId = opts.universe ?? "mega30";
        const universe = getUniverse(universeId, opts.sector, opts.industry);
        if (!universe) {
          throw new Error(
            `Unknown universe: ${universeId}. Available: ${getUniverseIds().join(", ")}`,
          );
        }
        const filtered = applyExcludeList(universe, opts.exclude);
        const top = opts.top ? Number.parseInt(opts.top, 10) : 5;
        const scanResult = await scanUniverse(env, filtered, universeId, { top });
        if (scanResult.candidates.length === 0) {
          throw new Error("No candidates found. Cannot start live trading.");
        }
        symbols = scanResult.candidates.map((c) => c.symbol);
        console.log(`[SCAN] Selected ${symbols.length} symbols: ${symbols.join(", ")}`);
      } else {
        symbols = DEFAULT_SYMBOLS.slice(0, 2);
      }

      // Create executor
      executor = opts.dryRun ? createDryRunExecutor() : createPaperExecutor(client);

      // State management
      store = createStateStore();
      marketState = createMarketState();
      const sectorMap = buildSectorMap();
      if (sectorMap.size > 0) {
        console.log(`Loaded sector map: ${sectorMap.size} symbols`);
      }
      const earningsGuard = createEarningsGuard({ bufferDays: 2, bufferDaysAfter: 1 });
      manager = createAgentManager({
        capital,
        portfolioGuard: DEFAULT_PORTFOLIO_GUARD,
        marketState,
        sectorMap,
        maxSectorPositions: DEFAULT_MAX_SECTOR_POSITIONS,
        earningsGuard,
      });

      // Fetch earnings calendar
      try {
        const earnings = await fetchEarningsCalendar(
          env.baseUrl,
          env.apiKey,
          env.apiSecret,
          symbols,
        );
        if (earnings.length > 0) {
          earningsGuard.addEarnings(earnings);
          console.log(`Loaded ${earnings.length} earnings date(s)`);
        }
      } catch {
        console.warn("Failed to fetch earnings calendar — continuing without it");
      }

      // Load market filters
      for (const [strategyId, filter] of getMarketFilters()) {
        manager.setMarketFilter(strategyId, filter);
      }

      // Restore state
      const savedState = store.load();
      const activeStrategyIds = new Set(strategies.map((s) => s.id));
      const activeSymbols = new Set(symbols);
      if (savedState) {
        const strategyMap = new Map(getAllStrategies().map((s) => [s.id, s]));
        const activeAgents = savedState.agents.filter((a) => {
          if (a.active === false) return false;
          return activeStrategyIds.has(a.strategyId) && activeSymbols.has(a.symbol);
        });
        const skipped = savedState.agents.length - activeAgents.length;
        manager.restoreStates(activeAgents, strategyMap, savedState.portfolioGuardState);
        console.log(
          `Restored ${activeAgents.length} agents from saved state${skipped > 0 ? ` (${skipped} skipped)` : ""}`,
        );
      }

      // Create new agents for missing combos
      const existingAgentIds = new Set(manager.getAgents().map((a) => a.id));
      for (const strategy of strategies) {
        for (const symbol of symbols) {
          const agentId = `${strategy.id}:${symbol}`;
          if (existingAgentIds.has(agentId)) continue;

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
          emit({ type: "agent-created", agentId, symbol, strategyId: strategy.id });
          console.log(`  Agent created: ${agentId} (${warmUp.length} warm-up candles)`);
        }
      }

      // Preflight Walk-Forward optimization
      try {
        const { getPresetTemplate } = await import("../strategy/template.js");
        const templates = strategies
          .map((s) => getPresetTemplate(s.id))
          .filter((t): t is NonNullable<typeof t> => t != null);
        if (templates.length > 0) {
          const candlesBySymbol = new Map<string, import("trendcraft").NormalizedCandle[]>();
          for (const symbol of symbols) {
            const { timeframe, lookbackMonths } = getWarmUpTimeframe(strategies[0].intervalMs);
            const candles = await fetchCachedBars(env, {
              symbol,
              timeframe,
              start: monthsAgo(lookbackMonths),
              end: today(),
              limit: 500,
            });
            if (candles.length > 0) candlesBySymbol.set(symbol, candles);
          }
          const pfOverrides = preflightOptimize(templates, candlesBySymbol);
          if (pfOverrides.length > 0) {
            const { applied } = applyStrategyOverrides(pfOverrides);
            if (applied > 0) {
              console.log(`[OPTIMIZER] Applied ${applied} preflight optimization(s)`);
            }
          }
        }
      } catch (err) {
        console.warn(
          `[OPTIMIZER] Preflight optimization failed: ${err instanceof Error ? err.message : err}`,
        );
      }

      // Initialize strategy rotator
      rotator = createStrategyRotator(strategies.map((s) => s.id));

      initialized = true;
    },

    async start() {
      if (!initialized) throw new Error("Session not initialized. Call init() first.");
      if (running) return;

      sessionStartTime = Date.now();

      // Startup reconciliation
      if (!opts.dryRun) {
        try {
          const result = await reconcilePositions(client, manager);
          if (result.discrepancies.length > 0 || result.orphanedPositions.length > 0) {
            console.warn("[STARTUP] Position discrepancies detected:");
            console.warn(formatReconciliation(result));
            emit({
              type: "reconciliation",
              discrepancies: result.discrepancies.length,
              orphaned: result.orphanedPositions.length,
            });
          } else {
            console.log("[STARTUP] Position reconciliation OK — no discrepancies.");
          }
        } catch (err) {
          console.error("[STARTUP] Reconciliation failed:", err);
        }
      }

      // Connect WebSocket
      const benchmarkSymbols = new Set<string>();
      for (const [, filter] of getMarketFilters()) {
        benchmarkSymbols.add(filter.symbol ?? "SPY");
      }
      const allSymbols = [...new Set([...manager.getSymbols(), ...benchmarkSymbols])];

      ws = createAlpacaWebSocket(env);
      ws.onTrade((symbol, trade) => {
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
          emit({
            type: "trade-executed",
            agentId: intent.agentId,
            symbol: intent.symbol,
            side: intent.side,
            shares: intent.shares,
            reason: intent.reason,
            pnl: intent.pnl,
          });
        }
      });

      ws.subscribe(allSymbols);
      emit({ type: "websocket-connected" });

      // Periodic tasks
      writeHeartbeat();
      heartbeatTimer = setInterval(writeHeartbeat, INTERVALS.heartbeatMs);
      saveTimer = setInterval(saveState, INTERVALS.stateSaveMs);

      leaderboardTimer = setInterval(() => {
        const agents = manager.getAgents();
        const board = getLeaderboard(agents);
        console.log(formatLiveLeaderboard(board));
        for (const agent of agents) {
          const decision = evaluateAgent(agent);
          if (decision.action !== "hold") {
            console.log(`  [${decision.action.toUpperCase()}] ${agent.id}: ${decision.reason}`);
          }
        }
        emit({ type: "leaderboard-updated" });
      }, INTERVALS.leaderboardMs);

      if (opts.verbose) {
        verboseTimer = setInterval(() => {
          if (tickerStats.size === 0) return;
          const parts: string[] = [];
          for (const [sym, stat] of tickerStats) {
            parts.push(
              `${sym} $${stat.last.toFixed(2)} (${stat.count} trades, vol ${stat.volume})`,
            );
          }
          const time = new Date().toLocaleTimeString("en-US", { hour12: false });
          console.log(`[TICKER ${time}] ${parts.join(" | ")}`);
          for (const stat of tickerStats.values()) {
            stat.count = 0;
            stat.volume = 0;
          }
        }, INTERVALS.verboseMs);
      }

      if (!opts.dryRun) {
        reconcileTimer = setInterval(async () => {
          try {
            const result = await reconcilePositions(client, manager);
            if (result.discrepancies.length > 0 || result.orphanedPositions.length > 0) {
              console.warn(formatReconciliation(result));
              emit({
                type: "reconciliation",
                discrepancies: result.discrepancies.length,
                orphaned: result.orphanedPositions.length,
              });
            }
          } catch (err) {
            console.error("[RECONCILE] Error:", err);
          }
        }, INTERVALS.reconcileMs);
      }

      // Strategy rotation based on regime (every 5 minutes)
      if (rotator) {
        const rot = rotator;
        rotationTimer = setInterval(
          () => {
            // Build aggregate regime from SPY (or first benchmark symbol)
            const spySnapshot = marketState.getSnapshot("SPY");
            if (!spySnapshot) return;

            const regime: RegimeSnapshot = {
              trend: spySnapshot.trendDirection ?? "sideways",
              volatility: spySnapshot.volatilityRegime ?? "normal",
              trendStrength: 20, // Default; will be updated by regime indicator
            };

            const { activate, deactivate } = rot.onRegimeChange(regime);
            for (const id of deactivate) {
              manager.deactivateStrategy(id);
              console.log(
                `[ROTATION] Deactivated: ${id} (regime: ${regime.trend}, ADX~${regime.trendStrength})`,
              );
            }
            for (const id of activate) {
              manager.activateStrategy(id);
              console.log(
                `[ROTATION] Activated: ${id} (regime: ${regime.trend}, ADX~${regime.trendStrength})`,
              );
            }
            if (activate.length > 0 || deactivate.length > 0) {
              emit({ type: "leaderboard-updated" });
            }
          },
          5 * 60 * 1000,
        );
      }

      // Auto-review scheduler
      if (!opts.noAutoReview && process.env.ANTHROPIC_API_KEY) {
        cancelReview = scheduleReview({
          onReview: () => executeReviewCycle({ apply: true }),
          onError: (err) => {
            console.error("[SCHEDULER] Review error:", err);
            emit({ type: "error", message: String(err), source: "review-scheduler" });
          },
        });
        console.log("Auto-review scheduler enabled (16:05 ET daily).");
      }

      // Intra-session review scheduler
      intraReviewNumber = loadTodayIntraSessionReviews().length;
      if (!opts.noIntraReview && process.env.ANTHROPIC_API_KEY) {
        const intraIntervalMin = Number.parseInt(opts.intraInterval ?? "30", 10);
        cancelIntraReview = scheduleIntraSessionReview({
          intervalMs: intraIntervalMin * 60 * 1000,
          onReview: async () => {
            intraReviewNumber++;
            const reviewNum = intraReviewNumber;
            emit({ type: "review-started", reviewType: "intra-session", reviewNumber: reviewNum });
            console.log(`\n[INTRA] Starting intra-session review #${reviewNum}...`);

            const report = buildIntraSessionReport(
              manager,
              sessionStartTime,
              reviewNum,
              marketState,
            );

            let recommendation: LLMRecommendation;
            try {
              recommendation = await reviewIntraSession(report);
            } catch (err) {
              console.error("[INTRA] LLM call failed:", err instanceof Error ? err.message : err);
              emit({ type: "error", message: String(err), source: "intra-review" });
              return;
            }

            console.log(`[INTRA] Summary: ${recommendation.summary}`);
            console.log(`[INTRA] Actions proposed: ${recommendation.actions.length}`);

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

            const { appliedActions, rejectedActions } = await applyIntraSessionActions(
              valid,
              rejected,
              {
                manager,
                executor,
                reviewNum,
                agents: report.agents,
                fetchWarmUp: async (strategy, symbol) => {
                  const { timeframe, lookbackMonths } = getWarmUpTimeframe(strategy.intervalMs);
                  return fetchCachedBars(env, {
                    symbol,
                    timeframe,
                    start: monthsAgo(lookbackMonths),
                    end: today(),
                    limit: 200,
                  });
                },
              },
            );

            const record: IntraSessionReviewRecord = {
              timestamp: Date.now(),
              reviewNumber: reviewNum,
              llmResponse: recommendation,
              appliedActions,
              rejectedActions,
            };
            const path = saveIntraSessionRecord(record);
            console.log(`[INTRA] Review #${reviewNum} saved: ${path}`);
            emit({
              type: "review-completed",
              reviewType: "intra-session",
              appliedCount: appliedActions.length,
              rejectedCount: rejectedActions.length,
            });

            saveState();
          },
          onError: (err) => {
            console.error("[INTRA] Scheduler error:", err);
            emit({ type: "error", message: String(err), source: "intra-scheduler" });
          },
        });
        console.log(
          `Intra-session review enabled (every ${Number.parseInt(opts.intraInterval ?? "30", 10)}min during market hours).`,
        );
      }

      running = true;
      const mode = opts.dryRun ? "DRY RUN" : "PAPER TRADING";
      emit({ type: "session-started", mode, agentCount: manager.getAgents().length, symbols });
    },

    async stop() {
      if (!running) return;
      console.log("\nShutting down...");

      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (saveTimer) clearInterval(saveTimer);
      if (leaderboardTimer) clearInterval(leaderboardTimer);
      if (verboseTimer) clearInterval(verboseTimer);
      if (reconcileTimer) clearInterval(reconcileTimer);
      if (rotationTimer) clearInterval(rotationTimer);
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

      saveState();

      const board = getLeaderboard(manager.getAgents());
      console.log(formatLiveLeaderboard(board));

      if (ws) ws.close();

      running = false;
      emit({ type: "session-stopped" });
    },

    getManager() {
      return manager;
    },

    getMarketState() {
      return marketState;
    },

    getExecutor() {
      return executor;
    },

    getStore() {
      return store;
    },

    isRunning() {
      return running;
    },

    isInitialized() {
      return initialized;
    },

    onEvent(handler) {
      eventHandlers.add(handler);
      return () => {
        eventHandlers.delete(handler);
      };
    },

    getStrategies() {
      return strategies;
    },

    getSymbols() {
      return symbols;
    },

    getMode() {
      return opts.dryRun ? "DRY RUN" : "PAPER TRADING";
    },

    getStartTime() {
      return sessionStartTime;
    },

    getCapital() {
      return capital;
    },

    getEnv() {
      return env;
    },
  };

  return session;
}
