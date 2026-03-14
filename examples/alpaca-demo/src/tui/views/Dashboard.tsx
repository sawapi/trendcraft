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
  maxRows: number;
};

export function Dashboard({ agents, events, maxRows }: DashboardProps): React.ReactElement {
  // Portfolio summary
  const activeAgents = agents.filter((a) => a.active);
  const totalPnl = activeAgents.reduce((sum, a) => sum + a.metrics.totalReturn, 0);
  const totalTrades = activeAgents.reduce((sum, a) => sum + a.metrics.totalTrades, 0);
  const positionsOpen = activeAgents.filter(
    (a) =>
      a.sessionState?.trackerState?.position != null &&
      a.sessionState.trackerState.position.shares > 0,
  ).length;

  // Budget: summary(4) + leaderboard header(2) + event header(2) = 8 fixed lines
  const fixedLines = 8;
  const available = Math.max(4, maxRows - fixedLines);
  // Split: 60% agents, 40% events (minimum 2 each)
  const maxAgentRows = Math.max(2, Math.floor(available * 0.6));
  const maxEventRows = Math.max(2, available - maxAgentRows);

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
        <AgentTable agents={agents.slice(0, maxAgentRows)} />
      </Box>

      {/* Event log */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {" "}
          Recent Events{" "}
        </Text>
      </Box>
      <EventLog events={events} maxLines={maxEventRows} />
    </Box>
  );
}
