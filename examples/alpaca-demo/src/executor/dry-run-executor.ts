/**
 * Dry-run executor — logs order intents without sending real orders
 */

import type { OrderIntent, ExecutionResult, OrderExecutor } from "./types.js";

export function createDryRunExecutor(): OrderExecutor {
  return {
    async execute(intent: OrderIntent): Promise<ExecutionResult> {
      const pnlStr = intent.pnl !== undefined ? ` P&L: $${intent.pnl.toFixed(2)}` : "";
      console.log(
        `[DRY-RUN] ${intent.side.toUpperCase()} ${Math.floor(intent.shares)} ${intent.symbol} ` +
          `(agent: ${intent.agentId}, reason: ${intent.reason})${pnlStr}`,
      );

      return {
        intent,
        success: true,
        orderId: `dry-${Date.now()}`,
      };
    },
  };
}
