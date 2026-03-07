/**
 * Promotion / demotion thresholds for agent tier management
 */

export type PromotionConfig = {
  /** Minimum Sharpe ratio for promotion */
  minSharpe: number;
  /** Minimum win rate (0-100) */
  minWinRate: number;
  /** Maximum drawdown percent for promotion */
  maxDrawdown: number;
  /** Minimum number of trades before evaluation */
  minTrades: number;
  /** Minimum profit factor */
  minProfitFactor: number;
  /** Maximum daily loss in USD (triggers demotion) */
  maxDailyLoss: number;
  /** Drawdown percent that triggers demotion */
  demotionDrawdown: number;
  /** Minimum days of evaluation before promotion */
  minEvalDays: number;
};

export const DEFAULT_PROMOTION_CONFIG: PromotionConfig = {
  minSharpe: 0.8,
  minWinRate: 40,
  maxDrawdown: 15,
  minTrades: 15,
  minProfitFactor: 1.1,
  maxDailyLoss: -10_000,
  demotionDrawdown: 25,
  minEvalDays: 3,
};
