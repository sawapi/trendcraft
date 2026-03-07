/**
 * Review system types — daily review, LLM actions, and history
 */

import type { AgentMetrics, AgentTier } from "../agent/types.js";
import type { ConditionRule, IndicatorRef, StrategyTemplate } from "../strategy/template.js";
import type { PromotionDecision } from "../tracker/leaderboard.js";

// --- Daily Report ---

export type AgentReport = {
  agentId: string;
  strategyId: string;
  symbol: string;
  tier: AgentTier;
  active: boolean;
  metrics: AgentMetrics;
  recentTrades: TradeRecord[];
  promotionDecision: PromotionDecision;
};

export type TradeRecord = {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  side: "buy" | "sell";
  pnl: number;
  returnPercent: number;
  reason: string;
  direction?: "long" | "short";
  exitReason?: string;
  mfe?: number;
  mae?: number;
  mfeUtilization?: number;
  holdingBars?: number;
};

export type MarketContext = {
  symbol: string;
  dailyChangePercent: number;
  close: number;
  volume: number;
  atr14?: number;
  atrPercent?: number;
  volatilityRegime?: "low" | "normal" | "high";
  trendDirection?: "bullish" | "bearish" | "sideways";
  trendStrength?: number;
};

export type HistoricalMetric = {
  date: string;
  agentId: string;
  metrics: AgentMetrics;
};

export type BacktestEntry = {
  strategyId: string;
  symbol: string;
  score: number;
  totalReturnPercent: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  tradeCount: number;
  monteCarlo?: {
    isSignificant: boolean;
    pReturnPositive: number;
    percentile5Return: number;
    percentile95Drawdown: number;
  };
};

export type DataQualityReport = {
  symbol: string;
  totalCandles: number;
  errors: number;
  warnings: number;
  cleaned: boolean;
};

export type ReconciliationReport = {
  timestamp: number;
  matched: number;
  discrepancies: number;
  orphanedPositions: number;
};

export type DailyReport = {
  date: string;
  generatedAt: number;
  mode: "live" | "backtest";
  agents: AgentReport[];
  leaderboard: LeaderboardEntry[];
  backtestResults?: BacktestEntry[];
  marketContext: MarketContext[];
  historicalTrend: HistoricalMetric[];
  activeOverrides: import("../strategy/template.js").ParameterOverride[];
  palette: {
    indicators: Record<string, unknown>;
    conditions: Record<string, unknown>;
  };
  dataQuality?: DataQualityReport[];
  reconciliation?: ReconciliationReport;
  buyAndHold?: BuyAndHoldBenchmark[];
};

export type LeaderboardEntry = {
  rank: number;
  agentId: string;
  strategyId: string;
  score: number;
  metrics: AgentMetrics;
};

// --- LLM Actions ---

export type AdjustParamsAction = {
  action: "adjust_params";
  strategyId: string;
  changes: {
    indicators?: IndicatorRef[];
    position?: Record<string, number>;
    guards?: Record<string, number>;
    entry?: ConditionRule;
    exit?: ConditionRule;
  };
  reasoning: string;
};

export type KillAgentAction = {
  action: "kill_agent";
  agentId: string;
  reasoning: string;
};

export type ReviveAgentAction = {
  action: "revive_agent";
  agentId: string;
  paramChanges?: AdjustParamsAction["changes"];
  reasoning: string;
};

export type CreateStrategyAction = {
  action: "create_strategy";
  template: StrategyTemplate;
  reasoning: string;
};

export type LLMAction =
  | AdjustParamsAction
  | KillAgentAction
  | ReviveAgentAction
  | CreateStrategyAction;

export type LLMRecommendation = {
  summary: string;
  actions: LLMAction[];
  marketAnalysis: string;
};

// --- Review Record ---

export type AppliedAction = {
  action: LLMAction;
  backtestScore?: number;
  wfaEfficiency?: number;
};

export type RejectedAction = {
  action: LLMAction;
  reason: string;
};

export type ActionOutcome = {
  reviewDate: string;
  action: LLMAction;
  scoreBefore: number;
  scoreAfter?: number;
  verdict?: "improved" | "degraded" | "neutral";
  benchmarkReturnPercent?: number;
  relativeDelta?: number;
};

export type BuyAndHoldBenchmark = {
  symbol: string;
  startPrice: number;
  endPrice: number;
  returnPercent: number;
  period: string;
};

export type ReviewRecord = {
  date: string;
  reviewedAt: number;
  llmResponse: LLMRecommendation;
  appliedActions: AppliedAction[];
  rejectedActions: RejectedAction[];
  outcomes?: ActionOutcome[];
};
