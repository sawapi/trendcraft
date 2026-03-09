/**
 * Agent types
 */

import type { streaming } from "trendcraft";

export type AgentTier = "backtest" | "paper" | "live";

export type AgentMetrics = {
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  totalReturn: number;
  totalReturnPercent: number;
  dailyPnl: number;
  startedAt: number;
  /** Cumulative gross return (before commission/tax) */
  grossReturn: number;
  /** Cumulative commission paid */
  totalCommission: number;
  /** Cumulative estimated tax on realized gains */
  estimatedTax: number;
};

export type AgentState = {
  id: string;
  strategyId: string;
  symbol: string;
  tier: AgentTier;
  active: boolean;
  metrics: AgentMetrics;
  sessionState: streaming.ManagedSessionState | null;
  lastUpdated: number;
};

export type ManagerState = {
  agents: AgentState[];
  portfolioGuardState?: streaming.PortfolioGuardState;
};
