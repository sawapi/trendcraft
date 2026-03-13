/**
 * Dashboard view — agent table, event log, portfolio summary
 */

import { Box, Text } from "ink";
import type React from "react";
import type { AgentState } from "../../agent/types.js";
import type { TradingEvent } from "../../trading/events.js";
import { AgentTable } from "../components/AgentTable.js";
import { EventLog } from "../components/EventLog.js";

type DashboardProps = {
  agents: AgentState[];
  events: TradingEvent[];
  isRunning: boolean;
};

export function Dashboard({ agents, events, isRunning }: DashboardProps): React.ReactElement {
  // Portfolio summary
  const activeAgents = agents.filter((a) => a.active);
  const totalPnl = activeAgents.reduce((sum, a) => sum + a.metrics.totalReturn, 0);
  const totalTrades = activeAgents.reduce((sum, a) => sum + a.metrics.totalTrades, 0);
  const positionsOpen = activeAgents.filter(
    (a) =>
      a.sessionState?.trackerState?.position != null &&
      a.sessionState.trackerState.position.shares > 0,
  ).length;

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Portfolio summary */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {" "}
          Portfolio Summary{" "}
        </Text>
      </Box>
      <Box marginBottom={1} gap={4}>
        <Box>
          <Text>
            Active Agents: <Text bold>{activeAgents.length}</Text>
          </Text>
        </Box>
        <Box>
          <Text>
            Open Positions: <Text bold>{positionsOpen}</Text>
          </Text>
        </Box>
        <Box>
          <Text>
            Total P&L:{" "}
            <Text bold color={totalPnl >= 0 ? "green" : "red"}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(0)}
            </Text>
          </Text>
        </Box>
        <Box>
          <Text>
            Total Trades: <Text bold>{totalTrades}</Text>
          </Text>
        </Box>
      </Box>

      {/* Agent table */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {" "}
          Agent Leaderboard{" "}
        </Text>
      </Box>
      <Box marginBottom={1}>
        <AgentTable agents={agents} />
      </Box>

      {/* Event log */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {" "}
          Recent Events{" "}
        </Text>
      </Box>
      <EventLog events={events} maxLines={8} />
    </Box>
  );
}
