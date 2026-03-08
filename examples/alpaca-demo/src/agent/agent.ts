/**
 * Agent — a single strategy x symbol unit
 *
 * Wraps a ManagedSession with metrics tracking and state persistence.
 */

import {
  type NormalizedCandle,
  type StrategyDefinition,
  type Trade,
  calculateRuntimeMetrics,
  createSessionFromStrategy,
  type streaming,
} from "trendcraft";
import type { OrderIntent } from "../executor/types.js";
import type { AgentMetrics, AgentState, AgentTier } from "./types.js";

export type Agent = {
  readonly id: string;
  readonly strategyId: string;
  readonly symbol: string;
  tier: AgentTier;
  feedTrade(trade: streaming.Trade): {
    events: streaming.ManagedEvent[];
    intents: OrderIntent[];
  };
  close(): { events: streaming.ManagedEvent[]; intents: OrderIntent[] };
  getMetrics(): AgentMetrics;
  getTrades(): Trade[];
  getState(): AgentState;
  restore(state: AgentState): void;
};

export function createAgent(
  strategy: StrategyDefinition,
  symbol: string,
  opts?: {
    capital?: number;
    warmUp?: NormalizedCandle[];
    tier?: AgentTier;
    fromState?: AgentState;
  },
): Agent {
  const id = `${strategy.id}:${symbol}`;
  let tier: AgentTier = opts?.tier ?? "paper";
  const startedAt = opts?.fromState?.metrics.startedAt ?? Date.now();

  let session = createSessionFromStrategy(strategy, {
    capital: opts?.capital ?? strategy.position.capital,
    warmUp: opts?.warmUp,
    fromState: opts?.fromState?.sessionState ?? undefined,
  });

  let dailyPnlAccumulator = opts?.fromState?.metrics.dailyPnl ?? 0;

  // Signal lifecycle state
  const lifecycle = strategy.signalLifecycle;
  let barsSinceLastTrade = Number.POSITIVE_INFINITY;
  let consecutiveEntryBars = 0;
  let lastBarTime = 0;

  function isNewBar(time: number): boolean {
    if (time - lastBarTime >= strategy.intervalMs) {
      lastBarTime = time;
      return true;
    }
    return false;
  }

  function eventsToIntents(events: streaming.ManagedEvent[]): OrderIntent[] {
    const intents: OrderIntent[] = [];

    for (const event of events) {
      if (event.type === "position-opened") {
        intents.push({
          agentId: id,
          symbol,
          side: event.fill.side,
          shares: event.fill.shares,
          reason: "entry",
          time: event.fill.time,
        });
      } else if (event.type === "position-closed") {
        intents.push({
          agentId: id,
          symbol,
          side: event.fill.side,
          shares: event.fill.shares,
          reason: event.fill.reason,
          time: event.fill.time,
          pnl: event.trade.return,
        });
        dailyPnlAccumulator += event.trade.return;
      }
    }

    return intents;
  }

  function getMetrics(): AgentMetrics {
    const trades = session.getTrades();
    const account = session.getAccount();
    const rm = calculateRuntimeMetrics(trades, {
      initialCapital: account.initialCapital,
    });
    return {
      totalTrades: rm.tradeCount,
      winRate: rm.winRate,
      sharpeRatio: rm.sharpeRatio,
      maxDrawdown: account.maxDrawdownPercent,
      profitFactor: rm.profitFactor,
      totalReturn: rm.totalReturn,
      totalReturnPercent: rm.totalReturnPercent,
      dailyPnl: dailyPnlAccumulator,
      startedAt,
    };
  }

  return {
    get id() {
      return id;
    },
    get strategyId() {
      return strategy.id;
    },
    get symbol() {
      return symbol;
    },
    get tier() {
      return tier;
    },
    set tier(t: AgentTier) {
      tier = t;
    },

    feedTrade(trade: streaming.Trade) {
      const newBar = isNewBar(trade.time);
      const events = session.onTrade(trade);
      let intents = eventsToIntents(events);

      if (newBar) {
        barsSinceLastTrade++;
      }

      if (lifecycle && intents.length > 0) {
        const filtered: OrderIntent[] = [];
        for (const intent of intents) {
          // Always allow exit intents (stop-loss, take-profit, trailing-stop, exit)
          if (intent.reason !== "entry") {
            filtered.push(intent);
            continue;
          }

          // Cooldown: suppress entry if too recent
          if (lifecycle.cooldown?.bars && barsSinceLastTrade < lifecycle.cooldown.bars) {
            continue;
          }

          // Debounce: require consecutive bars with entry signals
          if (lifecycle.debounce?.bars) {
            if (newBar) {
              consecutiveEntryBars++;
            }
            if (consecutiveEntryBars < lifecycle.debounce.bars) {
              continue;
            }
            consecutiveEntryBars = 0;
          }

          filtered.push(intent);
        }
        intents = filtered;
      }

      // Track entry execution for cooldown
      if (intents.some((i) => i.reason === "entry")) {
        barsSinceLastTrade = 0;
        consecutiveEntryBars = 0;
      }

      return { events, intents };
    },

    close() {
      const events = session.close();
      const intents = eventsToIntents(events);
      return { events, intents };
    },

    getMetrics,

    getTrades(): Trade[] {
      return session.getTrades();
    },

    getState(): AgentState {
      return {
        id,
        strategyId: strategy.id,
        symbol,
        tier,
        active: true,
        metrics: getMetrics(),
        sessionState: session.getState(),
        lastUpdated: Date.now(),
      };
    },

    restore(state: AgentState) {
      tier = state.tier;
      dailyPnlAccumulator = state.metrics.dailyPnl;
      session = createSessionFromStrategy(strategy, {
        capital: opts?.capital ?? strategy.position.capital,
        fromState: state.sessionState ?? undefined,
      });
    },
  };
}
