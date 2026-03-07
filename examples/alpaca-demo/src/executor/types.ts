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
