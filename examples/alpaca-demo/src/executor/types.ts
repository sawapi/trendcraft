/**
 * Executor types
 */

import type { streaming } from "trendcraft";

export type OrderIntent = {
  agentId: string;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  reason: streaming.FillRecord["reason"];
  time: number;
  pnl?: number;
  /** Order type: "market" (default) or "limit" */
  orderType?: "market" | "limit";
  /** Limit price (required when orderType is "limit") */
  limitPrice?: number;
  /** Time in force (default: "day") */
  timeInForce?: "day" | "gtc" | "ioc";
};

export type ExecutionResult = {
  intent: OrderIntent;
  success: boolean;
  orderId?: string;
  filledPrice?: number;
  error?: string;
};

export type OrderExecutor = {
  execute(intent: OrderIntent): Promise<ExecutionResult>;
};
