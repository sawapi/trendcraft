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
import { DEFAULT_TRADING_COSTS } from "../config/trading-costs.js";
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

  // Cost tracking accumulators (restored from state if available)
  let grossReturnAccumulator = opts?.fromState?.metrics.grossReturn ?? 0;
  let totalCommissionAccumulator = opts?.fromState?.metrics.totalCommission ?? 0;
  let estimatedTaxAccumulator = opts?.fromState?.metrics.estimatedTax ?? 0;

  // Cost config from strategy position options
  const costConfig = {
    commission: strategy.position.commission ?? DEFAULT_TRADING_COSTS.commission,
    commissionRate: strategy.position.commissionRate ?? DEFAULT_TRADING_COSTS.commissionRate,
    taxRate: strategy.position.taxRate ?? DEFAULT_TRADING_COSTS.taxRate,
  };

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

        // Reverse-engineer gross return and cost breakdown from net return.
        // Engine formula: net = gross - exitCommission - tax
        //   exitCommission = commission + exitValue * (commissionRate / 100)
        //   tax = gross > 0 ? gross * (taxRate / 100) : 0
        const netReturn = event.trade.return;
        const exitValue = event.trade.exitPrice * event.fill.shares;
        const exitCommission =
          costConfig.commission + exitValue * (costConfig.commissionRate / 100);

        // Solve for gross: if gross > 0, net = gross * (1 - taxRate/100) - exitCommission
        //   → gross = (net + exitCommission) / (1 - taxRate/100)
        // If gross <= 0: net = gross - exitCommission → gross = net + exitCommission
        const grossCandidate = netReturn + exitCommission;
        let grossReturn: number;
        let tax: number;
        if (grossCandidate > 0 && costConfig.taxRate > 0) {
          grossReturn = (netReturn + exitCommission) / (1 - costConfig.taxRate / 100);
          tax = grossReturn * (costConfig.taxRate / 100);
        } else {
          grossReturn = grossCandidate;
          tax = 0;
        }

        grossReturnAccumulator += grossReturn;
        totalCommissionAccumulator += exitCommission;
        estimatedTaxAccumulator += tax;
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
      grossReturn: grossReturnAccumulator,
      totalCommission: totalCommissionAccumulator,
      estimatedTax: estimatedTaxAccumulator,
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
      grossReturnAccumulator = state.metrics.grossReturn ?? 0;
      totalCommissionAccumulator = state.metrics.totalCommission ?? 0;
      estimatedTaxAccumulator = state.metrics.estimatedTax ?? 0;
      session = createSessionFromStrategy(strategy, {
        capital: opts?.capital ?? strategy.position.capital,
        fromState: state.sessionState ?? undefined,
      });
    },
  };
}
