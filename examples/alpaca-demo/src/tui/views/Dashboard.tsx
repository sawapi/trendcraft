/**
 * Dashboard view — market regime, portfolio summary, position book,
 * agent leaderboard, event log, and agent detail drilldown
 */

import { Box, Text, useInput } from "ink";
import type React from "react";
import { useState } from "react";
import type { BenchmarkSnapshot } from "../../agent/market-state.js";
import type { AgentState } from "../../agent/types.js";
import type { AgentDetailData } from "../components/AgentDetail.js";
import { AgentDetail } from "../components/AgentDetail.js";
import { AgentTable } from "../components/AgentTable.js";
import { EventLog } from "../components/EventLog.js";
import { PositionBook } from "../components/PositionBook.js";
import type { TimestampedEvent } from "../hooks/useTrading.js";

type DashboardProps = {
  agents: AgentState[];
  events: TimestampedEvent[];
  isRunning: boolean;
  maxRows: number;
  deactivatedStrategies?: Set<string>;
  tickerSnapshots?: BenchmarkSnapshot[];
  /** Callback to fetch agent detail data */
  getAgentDetail?: (agentId: string) => AgentDetailData | null;
};

export function Dashboard({
  agents,
  events,
  isRunning,
  maxRows,
  deactivatedStrategies,
  tickerSnapshots = [],
  getAgentDetail,
}: DashboardProps): React.ReactElement {
  const [detailMode, setDetailMode] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [drilldownAgent, setDrilldownAgent] = useState<string | null>(null);

  const activeAgents = agents.filter((a) => a.active);
  const totalPnl = activeAgents.reduce((sum, a) => sum + a.metrics.totalReturn, 0);
  const totalTrades = activeAgents.reduce((sum, a) => sum + a.metrics.totalTrades, 0);
  const totalCosts = activeAgents.reduce(
    (sum, a) => sum + a.metrics.totalCommission + a.metrics.estimatedTax,
    0,
  );

  const positionsOpen = activeAgents.filter(
    (a) =>
      a.sessionState?.trackerState?.position != null &&
      a.sessionState.trackerState.position.shares > 0,
  ).length;

  // Unrealized P&L
  const snapshotMap = new Map(tickerSnapshots.map((s) => [s.symbol, s]));
  let unrealizedPnl = 0;
  for (const a of activeAgents) {
    const pos = a.sessionState?.trackerState?.position;
    if (pos && pos.shares > 0) {
      const snap = snapshotMap.get(a.symbol);
      if (snap) unrealizedPnl += (snap.lastPrice - pos.entryPrice) * pos.shares;
    }
  }

  // Market regime line from SPY
  const spy = tickerSnapshots.find((s) => s.symbol === "SPY");
  const activeStrategies = new Set(agents.map((a) => a.strategyId));
  const offCount = deactivatedStrategies
    ? [...deactivatedStrategies].filter((s) => activeStrategies.has(s)).length
    : 0;

  // Sorted agents for cursor navigation
  const sortedAgents = [...agents].sort((a, b) => b.metrics.sharpeRatio - a.metrics.sharpeRatio);
  const clampedIndex = Math.min(selectedIndex, Math.max(0, sortedAgents.length - 1));

  useInput((_input, key) => {
    // Toggle detail mode
    if (_input === "d") setDetailMode((prev) => !prev);

    // Cursor navigation in agent table
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      setDrilldownAgent(null);
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(sortedAgents.length - 1, prev + 1));
      setDrilldownAgent(null);
    }
    if (key.return) {
      if (sortedAgents[clampedIndex]) {
        setDrilldownAgent((prev) =>
          prev === sortedAgents[clampedIndex].id ? null : sortedAgents[clampedIndex].id,
        );
      }
    }
    if (_input === "escape" || key.escape) {
      setDrilldownAgent(null);
    }
  });

  // Space budget
  // Regime(1) + Summary(1) + PositionBook header(2) + positions(dynamic) + gap(1)
  // + Leaderboard header(1) + separator(1) + Event header(1) = ~8 fixed + positions
  const positionRows = Math.min(positionsOpen, 5); // Cap at 5 visible positions
  const fixedLines = 10 + positionRows;
  const available = Math.max(4, maxRows - fixedLines);

  // If drilldown is active, split differently
  const showDrilldown = drilldownAgent != null;
  const maxAgentRows = showDrilldown
    ? Math.max(2, Math.floor(available * 0.4))
    : Math.max(2, Math.floor(available * 0.6));
  const remainingRows = available - maxAgentRows;
  const maxEventRows = showDrilldown ? 0 : Math.max(2, remainingRows);

  // Agent detail data
  const agentDetailData = showDrilldown && getAgentDetail ? getAgentDetail(drilldownAgent) : null;

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Market Regime line */}
      {isRunning && spy && (
        <Box marginBottom={0}>
          <Text>
            Market: <Text bold>SPY</Text>{" "}
            <Text color={spy.dailyChangePercent >= 0 ? "green" : "red"}>
              {spy.dailyChangePercent >= 0 ? "+" : ""}
              {spy.dailyChangePercent.toFixed(2)}%
            </Text>
            {spy.trendDirection && <Text color="cyan"> {spy.trendDirection.toUpperCase()}</Text>}
            {spy.volatilityRegime && <Text> Vol:{spy.volatilityRegime.toUpperCase()}</Text>}
            {" | "}
            Strategies: {activeStrategies.size} active
            {offCount > 0 && <Text color="yellow">, {offCount} OFF</Text>}
          </Text>
        </Box>
      )}

      {/* Portfolio Summary — 1 condensed line */}
      <Box marginBottom={1}>
        <Text>
          Open: <Text bold>{positionsOpen}</Text>
          {" | "}
          uP&L:{" "}
          <Text bold color={unrealizedPnl >= 0 ? "green" : "red"}>
            {unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(0)}
          </Text>
          {" | "}
          Net:{" "}
          <Text bold color={totalPnl >= 0 ? "green" : "red"}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(0)}
          </Text>
          {" | "}
          Costs: <Text color="yellow">${totalCosts.toFixed(0)}</Text>
          {" | "}
          Trades: <Text bold>{totalTrades}</Text>
          {" | "}
          Agents: <Text bold>{activeAgents.length}</Text>
        </Text>
      </Box>

      {/* Position Book */}
      {positionsOpen > 0 && (
        <Box marginBottom={1} flexDirection="column">
          <Box marginBottom={0}>
            <Text bold color="cyan">
              {" "}
              POSITIONS ({positionsOpen}){" "}
            </Text>
          </Box>
          <PositionBook agents={agents} tickerSnapshots={tickerSnapshots} />
        </Box>
      )}

      {/* Agent Leaderboard */}
      <Box marginBottom={0}>
        <Text bold color="cyan">
          {" "}
          Agent Leaderboard{" "}
        </Text>
        <Text color="gray"> d:detail ↑↓:select ↵:drill</Text>
      </Box>
      <Box marginBottom={1}>
        <AgentTable
          agents={agents.slice(0, maxAgentRows)}
          deactivatedStrategies={deactivatedStrategies}
          detailMode={detailMode}
          selectedIndex={clampedIndex}
        />
      </Box>

      {/* Agent Detail (replaces event log when active) */}
      {showDrilldown && agentDetailData ? (
        <Box flexDirection="column">
          <Box marginBottom={0}>
            <Text bold color="cyan">
              {" "}
              Agent Detail{" "}
            </Text>
            <Text color="gray"> Esc:close</Text>
          </Box>
          <AgentDetail data={agentDetailData} maxRows={remainingRows} />
        </Box>
      ) : (
        <>
          {/* Event log */}
          <Box marginBottom={0}>
            <Text bold color="cyan">
              {" "}
              Recent Events{" "}
            </Text>
          </Box>
          <EventLog events={events} maxLines={maxEventRows} filterNoise />
        </>
      )}
    </Box>
  );
}
