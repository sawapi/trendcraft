/**
 * Tax summary report
 *
 * Annual P&L aggregation and estimated tax calculation.
 * For Japan residents trading US stocks:
 * - No US withholding tax on capital gains
 * - Japan 申告分離課税 20.315% on net realized gains
 *
 * DISCLAIMERS:
 * - Wash Sale Rule is NOT applied (may apply for US-sourced income)
 * - Losses cannot be carried forward across fiscal years in this report
 * - This is an estimate only — consult a tax professional
 */

import type { AgentState } from "../agent/types.js";
import { DEFAULT_TRADING_COSTS } from "../config/trading-costs.js";

export type TaxSummary = {
  year: number;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  taxableIncome: number;
  estimatedTax: number;
  taxRate: number;
  tradeCount: number;
};

/**
 * Calculate annual tax summary from agent states
 */
export function calculateTaxSummary(
  agents: AgentState[],
  opts?: { year?: number; taxRate?: number },
): TaxSummary {
  const year = opts?.year ?? new Date().getFullYear();
  const taxRate = opts?.taxRate ?? DEFAULT_TRADING_COSTS.taxRate;

  let grossProfit = 0;
  let grossLoss = 0;
  let tradeCount = 0;

  for (const agent of agents) {
    const trackerState = agent.sessionState?.trackerState;
    if (!trackerState?.trades) continue;

    for (const trade of trackerState.trades) {
      const exitDate = new Date(trade.exitTime);
      if (exitDate.getFullYear() !== year) continue;

      tradeCount++;
      if (trade.return >= 0) {
        grossProfit += trade.return;
      } else {
        grossLoss += trade.return;
      }
    }
  }

  const netPnl = grossProfit + grossLoss;
  const taxableIncome = Math.max(0, netPnl);
  const estimatedTax = taxableIncome * (taxRate / 100);

  return {
    year,
    grossProfit,
    grossLoss,
    netPnl,
    taxableIncome,
    estimatedTax,
    taxRate,
    tradeCount,
  };
}

/**
 * Format tax summary for console output
 */
export function formatTaxReport(summary: TaxSummary): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("=".repeat(50));
  lines.push(`  TAX SUMMARY — ${summary.year}`);
  lines.push("=".repeat(50));
  lines.push(`  Total trades:      ${summary.tradeCount}`);
  lines.push(`  Gross profit:      $${summary.grossProfit.toFixed(2)}`);
  lines.push(`  Gross loss:        $${summary.grossLoss.toFixed(2)}`);
  lines.push(`  Net P&L:           $${summary.netPnl.toFixed(2)}`);
  lines.push("-".repeat(50));
  lines.push(`  Taxable income:    $${summary.taxableIncome.toFixed(2)}`);
  lines.push(`  Tax rate:          ${summary.taxRate}%`);
  lines.push(`  Estimated tax:     $${summary.estimatedTax.toFixed(2)}`);
  lines.push("-".repeat(50));
  lines.push("  * Wash Sale Rule not applied");
  lines.push("  * Loss carry-forward not supported");
  lines.push("  * This is an estimate — consult a tax professional");
  lines.push("=".repeat(50));
  lines.push("");

  return lines.join("\n");
}
