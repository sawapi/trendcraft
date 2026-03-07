/**
 * Paper executor — sends market orders to Alpaca paper trading API
 */

import type { AlpacaClient } from "../alpaca/client.js";
import type { OrderIntent, ExecutionResult, OrderExecutor } from "./types.js";

export function createPaperExecutor(client: AlpacaClient): OrderExecutor {
  return {
    async execute(intent: OrderIntent): Promise<ExecutionResult> {
      try {
        const order = await client.submitOrder({
          symbol: intent.symbol,
          qty: Math.floor(intent.shares),
          side: intent.side,
          type: "market",
          time_in_force: "day",
        });

        console.log(
          `[ORDER] ${intent.side.toUpperCase()} ${Math.floor(intent.shares)} ${intent.symbol} ` +
            `(agent: ${intent.agentId}, reason: ${intent.reason}) -> order ${order.id}`,
        );

        return {
          intent,
          success: true,
          orderId: order.id,
          filledPrice: order.filled_avg_price
            ? parseFloat(order.filled_avg_price)
            : undefined,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[ORDER] FAILED ${intent.side} ${intent.symbol}: ${message}`,
        );
        return {
          intent,
          success: false,
          error: message,
        };
      }
    },
  };
}
