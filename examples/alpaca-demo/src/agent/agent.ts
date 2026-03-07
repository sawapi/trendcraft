/**
 * Agent — a single strategy x symbol unit
 *
 * Wraps a ManagedSession with metrics tracking and state persistence.
 */

import type { streaming, NormalizedCandle } from "trendcraft";
import type { StrategyDefinition } from "../strategy/types.js";
import type { AgentMetrics, AgentState, AgentTier } from "./types.js";
import { createSessionFromStrategy } from "../strategy/factory.js";
import type { OrderIntent } from "../executor/types.js";

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

  let session = createSessionFromStrategy({
    strategy,
    capital: opts?.capital ?? strategy.position.capital,
    warmUp: opts?.warmUp,
    fromState: opts?.fromState?.sessionState ?? undefined,
  });

  let dailyPnlAccumulator = opts?.fromState?.metrics.dailyPnl ?? 0;

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
    const account = session.getAccount();
    const trades = session.getTrades();
    const wins = trades.filter((t) => t.return > 0);

    // Calculate Sharpe (simplified: annualized from trade returns)
    let sharpe = 0;
    if (trades.length >= 2) {
      const returns = trades.map((t) => t.returnPercent / 100);
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance =
        returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
      const std = Math.sqrt(variance);
      if (std > 0) {
        sharpe = (mean / std) * Math.sqrt(252);
      }
    }

    // Calculate profit factor
    const grossProfit = trades
      .filter((t) => t.return > 0)
      .reduce((sum, t) => sum + t.return, 0);
    const grossLoss = Math.abs(
      trades
        .filter((t) => t.return < 0)
        .reduce((sum, t) => sum + t.return, 0),
    );
    const profitFactor =
      grossLoss > 0
        ? grossProfit / grossLoss
        : grossProfit > 0
          ? Infinity
          : 0;

    return {
      totalTrades: trades.length,
      winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
      sharpeRatio: sharpe,
      maxDrawdown: account.maxDrawdownPercent,
      profitFactor,
      totalReturn: account.totalRealizedPnl,
      totalReturnPercent:
        ((account.equity - account.initialCapital) / account.initialCapital) *
        100,
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
      const events = session.onTrade(trade);
      const intents = eventsToIntents(events);
      return { events, intents };
    },

    close() {
      const events = session.close();
      const intents = eventsToIntents(events);
      return { events, intents };
    },

    getMetrics,

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
      session = createSessionFromStrategy({
        strategy,
        capital: opts?.capital ?? strategy.position.capital,
        fromState: state.sessionState ?? undefined,
      });
    },
  };
}
