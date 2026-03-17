/**
 * PositionBook — open positions with entry/current price, uP&L, hold time, SL/TP
 */

import { Box, Text } from "ink";
import type React from "react";
import type { BenchmarkSnapshot } from "../../agent/market-state.js";
import type { AgentState } from "../../agent/types.js";

type PositionRow = {
  agentId: string;
  strategyId: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  shares: number;
  unrealizedPnl: number;
  holdDuration: string;
  stopLoss: string;
  takeProfit: string;
};

function formatHoldDuration(entryTime: number): string {
  const ms = Date.now() - entryTime;
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h${minutes}m`;
  return `${minutes}m`;
}

type PositionBookProps = {
  agents: AgentState[];
  tickerSnapshots: BenchmarkSnapshot[];
};

export function PositionBook({ agents, tickerSnapshots }: PositionBookProps): React.ReactElement {
  const snapshotMap = new Map(tickerSnapshots.map((s) => [s.symbol, s]));

  const rows: PositionRow[] = [];
  for (const agent of agents) {
    const pos = agent.sessionState?.trackerState?.position;
    if (!pos || pos.shares <= 0) continue;

    const snap = snapshotMap.get(agent.symbol);
    const currentPrice = snap?.lastPrice ?? pos.entryPrice;
    const uPnl = (currentPrice - pos.entryPrice) * pos.shares;

    rows.push({
      agentId: agent.id,
      strategyId: agent.strategyId,
      symbol: agent.symbol,
      entryPrice: pos.entryPrice,
      currentPrice,
      shares: pos.shares,
      unrealizedPnl: uPnl,
      holdDuration: formatHoldDuration(pos.entryTime),
      stopLoss: pos.stopLossPrice != null ? pos.stopLossPrice.toFixed(2) : "—",
      takeProfit: pos.takeProfitPrice != null ? pos.takeProfitPrice.toFixed(2) : "—",
    });
  }

  if (rows.length === 0) {
    return (
      <Box>
        <Text color="gray">No open positions.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">
          {"Agent".padEnd(24)}
          {"Symbol".padEnd(8)}
          {"Entry".padEnd(10)}
          {"Now".padEnd(10)}
          {"Shares".padEnd(8)}
          {"uP&L".padEnd(10)}
          {"Hold".padEnd(8)}
          {"SL".padEnd(10)}
          {"TP".padEnd(10)}
        </Text>
      </Box>
      <Box>
        <Text color="gray">{"-".repeat(98)}</Text>
      </Box>
      {rows.map((r) => {
        const pnlColor = r.unrealizedPnl >= 0 ? "green" : "red";
        const pnlSign = r.unrealizedPnl >= 0 ? "+" : "";
        return (
          <Box key={r.agentId}>
            <Text>
              {r.strategyId.slice(0, 22).padEnd(24)}
              {r.symbol.padEnd(8)}
              {r.entryPrice.toFixed(2).padEnd(10)}
              {r.currentPrice.toFixed(2).padEnd(10)}
              {String(r.shares).padEnd(8)}
              <Text color={pnlColor}>{`${pnlSign}$${r.unrealizedPnl.toFixed(0)}`.padEnd(10)}</Text>
              {r.holdDuration.padEnd(8)}
              {r.stopLoss.padEnd(10)}
              {r.takeProfit.padEnd(10)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
