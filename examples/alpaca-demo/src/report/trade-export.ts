/**
 * Trade CSV export
 *
 * Exports closed trades from agent state to CSV format for record-keeping
 * and tax reporting.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AgentState } from "../agent/types.js";

type TradeRecord = {
  date: string;
  agent: string;
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  shares: number;
  grossReturn: number;
  netReturn: number;
  returnPct: number;
  exitReason: string;
  holdingDays: number;
};

/**
 * Extract trade records from agent states
 */
function extractTrades(agents: AgentState[], opts?: { year?: number }): TradeRecord[] {
  const records: TradeRecord[] = [];

  for (const agent of agents) {
    const trackerState = agent.sessionState?.trackerState;
    if (!trackerState?.trades) continue;

    const [strategyId, symbol] = agent.id.split(":");

    for (const trade of trackerState.trades) {
      const exitDate = new Date(trade.exitTime);

      // Filter by year if specified
      if (opts?.year && exitDate.getFullYear() !== opts.year) continue;

      // Estimate shares from return and price delta
      const priceDelta = trade.exitPrice - trade.entryPrice;
      const shares = priceDelta !== 0 ? Math.round(Math.abs(trade.return / priceDelta)) : 0;

      records.push({
        date: exitDate.toISOString().split("T")[0],
        agent: agent.id,
        symbol: symbol ?? strategyId ?? agent.id,
        entryDate: new Date(trade.entryTime).toISOString(),
        entryPrice: trade.entryPrice,
        exitDate: exitDate.toISOString(),
        exitPrice: trade.exitPrice,
        shares,
        grossReturn: trade.return, // trade.return is net (post-cost) from engine
        netReturn: trade.return,
        returnPct: trade.returnPercent,
        exitReason: trade.exitReason ?? "signal",
        holdingDays: trade.holdingDays,
      });
    }
  }

  // Sort by exit date
  records.sort((a, b) => a.exitDate.localeCompare(b.exitDate));
  return records;
}

/**
 * Export trades to CSV file
 */
export function exportTradesCsv(
  agents: AgentState[],
  outputPath: string,
  opts?: { year?: number },
): { path: string; count: number } {
  const records = extractTrades(agents, opts);

  const header =
    "Date,Agent,Symbol,EntryDate,EntryPrice,ExitDate,ExitPrice,Shares," +
    "GrossReturn,NetReturn,ReturnPct,ExitReason,HoldingDays";

  const rows = records.map(
    (r) =>
      `${r.date},${r.agent},${r.symbol},${r.entryDate},${r.entryPrice.toFixed(2)},` +
      `${r.exitDate},${r.exitPrice.toFixed(2)},${r.shares},` +
      `${r.grossReturn.toFixed(2)},${r.netReturn.toFixed(2)},${r.returnPct.toFixed(4)},` +
      `${r.exitReason},${r.holdingDays}`,
  );

  const csv = [header, ...rows].join("\n");
  const fullPath = resolve(outputPath);
  writeFileSync(fullPath, csv, "utf-8");

  return { path: fullPath, count: records.length };
}
