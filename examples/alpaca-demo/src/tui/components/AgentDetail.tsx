/**
 * AgentDetail — drilldown panel showing position, trades, costs, regime
 */

import { Box, Text } from "ink";
import type React from "react";
import type { Trade } from "trendcraft";
import type { RegimeData } from "../../agent/agent.js";
import type { AgentState } from "../../agent/types.js";

export type AgentDetailData = {
  state: AgentState;
  trades: Trade[];
  regime: RegimeData | null;
  currentPrice: number | null;
};

type AgentDetailProps = {
  data: AgentDetailData;
  maxRows?: number;
};

function formatHoldDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h${minutes}m`;
  return `${minutes}m`;
}

export function AgentDetail({ data }: AgentDetailProps): React.ReactElement {
  const { state, trades, regime, currentPrice } = data;
  const m = state.metrics;
  const pos = state.sessionState?.trackerState?.position;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={0}>
        <Text bold>
          {state.strategyId}:{state.symbol}
        </Text>
        <Text color="gray"> ({state.tier})</Text>
      </Box>

      {/* Current Position */}
      {pos && pos.shares > 0 && currentPrice != null ? (
        <Box marginBottom={0}>
          <Text color="cyan" bold>
            Position:{" "}
          </Text>
          <Text>
            {pos.shares} shares @ {pos.entryPrice.toFixed(2)} → {currentPrice.toFixed(2)}
          </Text>
          <Text> | </Text>
          <Text bold color={(currentPrice - pos.entryPrice) * pos.shares >= 0 ? "green" : "red"}>
            {(currentPrice - pos.entryPrice) * pos.shares >= 0 ? "+" : ""}$
            {((currentPrice - pos.entryPrice) * pos.shares).toFixed(0)}
          </Text>
          <Text> | </Text>
          <Text>Hold: {formatHoldDuration(Date.now() - pos.entryTime)}</Text>
          {pos.stopLossPrice != null && <Text color="red"> SL:{pos.stopLossPrice.toFixed(2)}</Text>}
          {pos.takeProfitPrice != null && (
            <Text color="green"> TP:{pos.takeProfitPrice.toFixed(2)}</Text>
          )}
        </Box>
      ) : (
        <Box marginBottom={0}>
          <Text color="gray">No open position</Text>
        </Box>
      )}

      {/* Cost Breakdown */}
      <Box marginBottom={0}>
        <Text color="cyan" bold>
          Costs:{" "}
        </Text>
        <Text>
          Gross <Text color="green">${m.grossReturn.toFixed(0)}</Text>
          {" → "}
          Comm <Text color="yellow">${m.totalCommission.toFixed(0)}</Text>
          {" → "}
          Tax <Text color="yellow">${m.estimatedTax.toFixed(0)}</Text>
          {" → "}
          Net{" "}
          <Text bold color={m.totalReturn >= 0 ? "green" : "red"}>
            ${m.totalReturn.toFixed(0)}
          </Text>
        </Text>
      </Box>

      {/* Regime */}
      {regime && (
        <Box marginBottom={0}>
          <Text color="cyan" bold>
            Regime:{" "}
          </Text>
          <Text>
            Trend:{" "}
            <Text
              color={
                regime.trend === "bullish" ? "green" : regime.trend === "bearish" ? "red" : "yellow"
              }
            >
              {regime.trend}
            </Text>
            {" | "}Vol: {regime.volatility}
            {" | "}ADX: {regime.trendStrength.toFixed(1)}
          </Text>
        </Box>
      )}

      {/* Last 5 Trades */}
      <Box marginBottom={0} marginTop={0}>
        <Text color="cyan" bold>
          Last Trades:{" "}
        </Text>
      </Box>
      {trades.length === 0 ? (
        <Text color="gray">No closed trades yet.</Text>
      ) : (
        <Box flexDirection="column">
          {trades.slice(-5).map((t, i) => {
            const pnl = t.return;
            const pnlColor = pnl >= 0 ? "green" : "red";
            const entryDate = new Date(t.entryTime);
            const exitDate = new Date(t.exitTime);
            const entryStr = `${String(entryDate.getHours()).padStart(2, "0")}:${String(entryDate.getMinutes()).padStart(2, "0")}`;
            const exitStr = `${String(exitDate.getHours()).padStart(2, "0")}:${String(exitDate.getMinutes()).padStart(2, "0")}`;
            return (
              <Box key={i}>
                <Text>
                  {entryStr}→{exitStr} {t.entryPrice.toFixed(2)}→{t.exitPrice.toFixed(2)}{" "}
                </Text>
                <Text color={pnlColor}>
                  {pnl >= 0 ? "+" : ""}${pnl.toFixed(0)} ({t.returnPercent.toFixed(1)}%)
                </Text>
                <Text color="gray"> {t.holdingDays}d</Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Stats line */}
      <Box marginTop={0}>
        <Text color="gray">
          WR:{m.winRate.toFixed(1)}% SR:{m.sharpeRatio.toFixed(2)} DD:{m.maxDrawdown.toFixed(1)}%
          PF:{m.profitFactor.toFixed(2)} Trades:{m.totalTrades}
        </Text>
      </Box>
    </Box>
  );
}
