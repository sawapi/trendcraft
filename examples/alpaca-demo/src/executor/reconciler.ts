/**
 * Position Reconciler — compares Alpaca positions with agent state
 *
 * Periodically checks for discrepancies between internal agent tracking
 * and actual Alpaca account positions.
 */

import type { AlpacaClient, AlpacaPosition } from "../alpaca/client.js";
import type { AgentManager } from "../agent/manager.js";

export type ReconciliationResult = {
  timestamp: number;
  matched: number;
  discrepancies: Discrepancy[];
  orphanedPositions: AlpacaPosition[];
};

export type Discrepancy = {
  symbol: string;
  agentId: string;
  expected: "has-position" | "no-position";
  actual: "has-position" | "no-position";
  alpacaQty?: number;
};

/**
 * Reconcile agent states against Alpaca account positions
 */
export async function reconcilePositions(
  client: AlpacaClient,
  manager: AgentManager,
): Promise<ReconciliationResult> {
  const alpacaPositions = await client.getPositions();
  const alpacaBySymbol = new Map<string, AlpacaPosition>();
  for (const pos of alpacaPositions) {
    alpacaBySymbol.set(pos.symbol, pos);
  }

  const discrepancies: Discrepancy[] = [];
  const agentSymbols = new Set<string>();
  let matched = 0;

  for (const agent of manager.getAgents()) {
    agentSymbols.add(agent.symbol);
    const state = agent.getState();
    const hasInternalPosition = state.sessionState !== null &&
      state.metrics.totalTrades > 0;
    const alpacaPos = alpacaBySymbol.get(agent.symbol);
    const hasAlpacaPosition = alpacaPos !== undefined && parseFloat(alpacaPos.qty) > 0;

    if (hasInternalPosition === hasAlpacaPosition) {
      matched++;
    } else {
      discrepancies.push({
        symbol: agent.symbol,
        agentId: agent.id,
        expected: hasInternalPosition ? "has-position" : "no-position",
        actual: hasAlpacaPosition ? "has-position" : "no-position",
        alpacaQty: hasAlpacaPosition ? parseFloat(alpacaPos!.qty) : undefined,
      });
    }
  }

  // Find orphaned positions (Alpaca has position but no agent manages it)
  const orphanedPositions = alpacaPositions.filter(
    (pos) => !agentSymbols.has(pos.symbol) && parseFloat(pos.qty) > 0,
  );

  return {
    timestamp: Date.now(),
    matched,
    discrepancies,
    orphanedPositions,
  };
}

/**
 * Format reconciliation result for logging
 */
export function formatReconciliation(result: ReconciliationResult): string {
  const lines: string[] = [];
  lines.push(`[RECONCILE] ${new Date(result.timestamp).toISOString()}: ${result.matched} matched`);

  for (const d of result.discrepancies) {
    lines.push(
      `  DISCREPANCY: ${d.agentId} — expected ${d.expected}, actual ${d.actual}` +
        (d.alpacaQty !== undefined ? ` (Alpaca qty: ${d.alpacaQty})` : ""),
    );
  }

  for (const pos of result.orphanedPositions) {
    lines.push(
      `  ORPHANED: ${pos.symbol} — qty: ${pos.qty}, P&L: $${pos.unrealized_pl}`,
    );
  }

  return lines.join("\n");
}
