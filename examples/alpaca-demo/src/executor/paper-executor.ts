/**
 * Paper executor — sends market orders to Alpaca paper trading API
 *
 * Includes fill confirmation polling to verify order execution.
 */

import type { AlpacaClient } from "../alpaca/client.js";
import type { OrderIntent, ExecutionResult, OrderExecutor } from "./types.js";

const FILL_POLL_INTERVAL_MS = 500;
const FILL_POLL_MAX_ATTEMPTS = 10;

/**
 * Poll for order fill status
 */
async function waitForFill(
  client: AlpacaClient,
  orderId: string,
): Promise<{ filled: boolean; filledPrice?: number; status: string }> {
  for (let i = 0; i < FILL_POLL_MAX_ATTEMPTS; i++) {
    const order = await client.getOrder(orderId);

    if (order.status === "filled") {
      return {
        filled: true,
        filledPrice: order.filled_avg_price
          ? parseFloat(order.filled_avg_price)
          : undefined,
        status: order.status,
      };
    }

    if (order.status === "canceled" || order.status === "expired" || order.status === "rejected") {
      return { filled: false, status: order.status };
    }

    // Still pending — wait and retry
    await new Promise((r) => setTimeout(r, FILL_POLL_INTERVAL_MS));
  }

  return { filled: false, status: "timeout" };
}

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

        // Poll for fill confirmation
        const fillResult = await waitForFill(client, order.id);

        if (fillResult.filled) {
          console.log(
            `[ORDER] FILLED ${order.id} @ $${fillResult.filledPrice?.toFixed(2) ?? "?"}`,
          );
          return {
            intent,
            success: true,
            orderId: order.id,
            filledPrice: fillResult.filledPrice,
          };
        }

        console.warn(
          `[ORDER] NOT FILLED ${order.id}: status=${fillResult.status}`,
        );
        return {
          intent,
          success: false,
          orderId: order.id,
          error: `Order not filled: ${fillResult.status}`,
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
