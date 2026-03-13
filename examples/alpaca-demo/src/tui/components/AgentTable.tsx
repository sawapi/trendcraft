/**
 * AgentTable — display agent performance data in a table
 */

import { Box, Text } from "ink";
import type React from "react";
import type { AgentState } from "../../agent/types.js";

type AgentTableProps = {
  agents: AgentState[];
  compact?: boolean;
};

export function AgentTable({ agents, compact }: AgentTableProps): React.ReactElement {
  if (agents.length === 0) {
    return (
      <Box>
        <Text color="gray">No agents loaded.</Text>
      </Box>
    );
  }

  const sorted = [...agents].sort((a, b) => b.metrics.sharpeRatio - a.metrics.sharpeRatio);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">
          {"#".padEnd(4)}
          {"Agent".padEnd(compact ? 24 : 30)}
          {"Symbol".padEnd(8)}
          {"Return%".padEnd(10)}
          {"WinRate".padEnd(9)}
          {"Sharpe".padEnd(9)}
          {"MaxDD".padEnd(9)}
          {"Net$".padEnd(10)}
          {"Trades".padEnd(8)}
        </Text>
      </Box>
      <Box>
        <Text color="gray">{"-".repeat(compact ? 95 : 101)}</Text>
      </Box>
      {sorted.map((agent, i) => {
        const m = agent.metrics;
        const retColor = m.totalReturnPercent >= 0 ? "green" : "red";
        const pnlColor = m.totalReturn >= 0 ? "green" : "red";

        return (
          <Box key={agent.id}>
            <Text>
              {String(i + 1).padEnd(4)}
              <Text color={agent.active ? "white" : "gray"}>
                {agent.strategyId.slice(0, compact ? 22 : 28).padEnd(compact ? 24 : 30)}
              </Text>
              {agent.symbol.padEnd(8)}
              <Text color={retColor}>{`${m.totalReturnPercent.toFixed(2)}%`.padEnd(10)}</Text>
              {`${m.winRate.toFixed(1)}%`.padEnd(9)}
              {m.sharpeRatio.toFixed(2).padEnd(9)}
              {`${m.maxDrawdown.toFixed(1)}%`.padEnd(9)}
              <Text color={pnlColor}>{`$${m.totalReturn.toFixed(0)}`.padEnd(10)}</Text>
              {String(m.totalTrades).padEnd(8)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
