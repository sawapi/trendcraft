/**
 * Paper executor — sends market orders to Alpaca paper trading API
 *
 * Uses withRetry for order submission and pollUntil for fill confirmation
 * with configurable exponential backoff.
 */

import { execution } from "trendcraft";
const { withRetry, pollUntil } = execution;
import type { AlpacaClient } from "../alpaca/client.js";
import type { ExecutionResult, OrderExecutor, OrderIntent } from "./types.js";

export function createPaperExecutor(client: AlpacaClient): OrderExecutor {
  return {
    async execute(intent: OrderIntent): Promise<ExecutionResult> {
      try {
        // Submit order with retry on transient failures
        const order = await withRetry(
          () =>
            client.submitOrder({
              symbol: intent.symbol,
              qty: Math.floor(intent.shares),
              side: intent.side,
              type: "market",
              time_in_force: "day",
            }),
          { maxAttempts: 3, initialDelayMs: 500, maxDelayMs: 5_000 },
        );

        console.log(
          `[ORDER] ${intent.side.toUpperCase()} ${Math.floor(intent.shares)} ${intent.symbol} ` +
            `(agent: ${intent.agentId}, reason: ${intent.reason}) -> order ${order.id}`,
        );

        // Poll for fill confirmation with backoff
        const { result: filledOrder, settled } = await pollUntil(
          () => client.getOrder(order.id),
          (o) =>
            o.status === "filled" ||
            o.status === "canceled" ||
            o.status === "expired" ||
            o.status === "rejected",
          { maxAttempts: 20, initialIntervalMs: 500, maxIntervalMs: 5_000, backoffMultiplier: 1.5 },
        );

        if (filledOrder.status === "filled") {
          const filledPrice = filledOrder.filled_avg_price
            ? Number.parseFloat(filledOrder.filled_avg_price)
            : undefined;
          console.log(`[ORDER] FILLED ${order.id} @ $${filledPrice?.toFixed(2) ?? "?"}`);
          return {
            intent,
            success: true,
            orderId: order.id,
            filledPrice,
          };
        }

        const status = settled ? filledOrder.status : "timeout";
        console.warn(`[ORDER] NOT FILLED ${order.id}: status=${status}`);
        return {
          intent,
          success: false,
          orderId: order.id,
          error: `Order not filled: ${status}`,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ORDER] FAILED ${intent.side} ${intent.symbol}: ${message}`);
        return {
          intent,
          success: false,
          error: message,
        };
      }
    },
  };
}
