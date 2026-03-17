/**
 * AgentTable — display agent performance data in a table
 *
 * Normal mode: adds a Costs column alongside Net$
 * Detail mode (toggle with `d` key): expands to Gross$, Comm$, Tax$, Net$
 */

import { Box, Text } from "ink";
import type React from "react";
import type { AgentState } from "../../agent/types.js";

type AgentTableProps = {
  agents: AgentState[];
  compact?: boolean;
  deactivatedStrategies?: Set<string>;
  detailMode?: boolean;
  /** Index of the currently selected agent row (for cursor highlight) */
  selectedIndex?: number;
};

export function AgentTable({
  agents,
  compact,
  deactivatedStrategies,
  detailMode,
  selectedIndex,
}: AgentTableProps): React.ReactElement {
  if (agents.length === 0) {
    return (
      <Box>
        <Text color="gray">No agents loaded.</Text>
      </Box>
    );
  }

  const sorted = [...agents].sort((a, b) => b.metrics.sharpeRatio - a.metrics.sharpeRatio);
  const nameWidth = compact ? 24 : 30;

  // Column widths for cost section
  const W_GROSS = 10;
  const W_COMM = 9;
  const W_TAX = 9;
  const W_COSTS = 9;
  const W_NET = 10;

  const separatorLen = detailMode ? (compact ? 113 : 119) : compact ? 104 : 110;

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">
          {"#".padEnd(4)}
          {"Agent".padEnd(nameWidth)}
          {"Symbol".padEnd(8)}
          {"Return%".padEnd(10)}
          {"WinRate".padEnd(9)}
          {"Sharpe".padEnd(9)}
          {"MaxDD".padEnd(9)}
          {detailMode ? (
            <>
              {"Gross$".padEnd(W_GROSS)}
              {"Comm$".padEnd(W_COMM)}
              {"Tax$".padEnd(W_TAX)}
              {"Net$".padEnd(W_NET)}
            </>
          ) : (
            <>
              {"Costs".padEnd(W_COSTS)}
              {"Net$".padEnd(W_NET)}
            </>
          )}
          {"Trades".padEnd(8)}
        </Text>
      </Box>
      <Box>
        <Text color="gray">{"-".repeat(separatorLen)}</Text>
      </Box>
      {sorted.map((agent, i) => {
        const m = agent.metrics;
        const retColor = m.totalReturnPercent >= 0 ? "green" : "red";
        const pnlColor = m.totalReturn >= 0 ? "green" : "red";
        const isDeactivated = deactivatedStrategies?.has(agent.strategyId) ?? false;
        const badge = isDeactivated ? " [OFF]" : "";
        const nameMaxLen = (compact ? 22 : 28) - badge.length;
        const isSelected = selectedIndex === i;

        const totalCosts = m.totalCommission + m.estimatedTax;

        return (
          <Box key={agent.id}>
            <Text inverse={isSelected}>
              {String(i + 1).padEnd(4)}
              <Text color={isDeactivated ? "gray" : agent.active ? "white" : "gray"}>
                {(agent.strategyId.slice(0, nameMaxLen) + badge).padEnd(nameWidth)}
              </Text>
              {agent.symbol.padEnd(8)}
              <Text color={retColor}>{`${m.totalReturnPercent.toFixed(2)}%`.padEnd(10)}</Text>
              {`${m.winRate.toFixed(1)}%`.padEnd(9)}
              {m.sharpeRatio.toFixed(2).padEnd(9)}
              {`${m.maxDrawdown.toFixed(1)}%`.padEnd(9)}
              {detailMode ? (
                <>
                  <Text color="green">{`$${m.grossReturn.toFixed(0)}`.padEnd(W_GROSS)}</Text>
                  <Text color="yellow">{`$${m.totalCommission.toFixed(0)}`.padEnd(W_COMM)}</Text>
                  <Text color="yellow">{`$${m.estimatedTax.toFixed(0)}`.padEnd(W_TAX)}</Text>
                  <Text color={pnlColor}>{`$${m.totalReturn.toFixed(0)}`.padEnd(W_NET)}</Text>
                </>
              ) : (
                <>
                  <Text color="yellow">{`$${totalCosts.toFixed(0)}`.padEnd(W_COSTS)}</Text>
                  <Text color={pnlColor}>{`$${m.totalReturn.toFixed(0)}`.padEnd(W_NET)}</Text>
                </>
              )}
              {String(m.totalTrades).padEnd(8)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
