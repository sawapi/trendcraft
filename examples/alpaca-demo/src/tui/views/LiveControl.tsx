/**
 * LiveControl view — start/stop trading, strategy selection, agent management
 */

import { Box, Text, useInput } from "ink";
import type React from "react";
import { useState } from "react";
import type { AgentState } from "../../agent/types.js";
import { getStrategyIds } from "../../strategy/registry.js";
import type { SessionOptions } from "../../trading/session.js";
import { AgentTable } from "../components/AgentTable.js";
import { KeyHint } from "../components/KeyHint.js";

type LiveControlProps = {
  agents: AgentState[];
  isRunning: boolean;
  isInitializing: boolean;
  error: string | null;
  onStart: (opts: SessionOptions) => Promise<void>;
  onStop: () => Promise<void>;
};

export function LiveControl({
  agents,
  isRunning,
  isInitializing,
  error,
  onStart,
  onStop,
}: LiveControlProps): React.ReactElement {
  const [selectedStrategy, setSelectedStrategy] = useState(0);
  const [dryRun, setDryRun] = useState(true);
  const strategyIds = getStrategyIds();

  useInput((input, key) => {
    if (isInitializing) return;

    if (input === "s" && !isRunning) {
      const strategyId = strategyIds[selectedStrategy];
      onStart({
        strategy: strategyId,
        all: selectedStrategy === -1,
        dryRun,
        symbol: "AAPL",
      });
    }
    if (input === "x" && isRunning) {
      onStop();
    }
    if (input === "d" && !isRunning) {
      setDryRun((prev) => !prev);
    }
    if (input === "a" && !isRunning) {
      setSelectedStrategy(-1);
    }
    if (key.upArrow && !isRunning) {
      setSelectedStrategy((prev) => Math.max(-1, prev - 1));
    }
    if (key.downArrow && !isRunning) {
      setSelectedStrategy((prev) => Math.min(strategyIds.length - 1, prev + 1));
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Status */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {" "}
          Trading Control{" "}
        </Text>
      </Box>

      <Box marginBottom={1} gap={4}>
        <Box>
          <Text>
            Status:{" "}
            <Text bold color={isRunning ? "green" : isInitializing ? "yellow" : "gray"}>
              {isRunning ? "RUNNING" : isInitializing ? "INITIALIZING..." : "STOPPED"}
            </Text>
          </Text>
        </Box>
        <Box>
          <Text>
            Mode:{" "}
            <Text bold color={dryRun ? "yellow" : "red"}>
              {dryRun ? "DRY RUN" : "PAPER TRADING"}
            </Text>
          </Text>
        </Box>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Strategy selection (when not running) */}
      {!isRunning && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="cyan">
            {" "}
            Strategy Selection{" "}
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text color={selectedStrategy === -1 ? "cyan" : "gray"}>
                {selectedStrategy === -1 ? "> " : "  "}
                [ALL] Use all strategies
              </Text>
            </Box>
            {strategyIds.map((id, i) => (
              <Box key={id}>
                <Text color={selectedStrategy === i ? "cyan" : "white"}>
                  {selectedStrategy === i ? "> " : "  "}
                  {id}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Agent table (when running or has agents) */}
      {agents.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="cyan">
            {" "}
            Active Agents{" "}
          </Text>
          <Box marginTop={1}>
            <AgentTable agents={agents} compact />
          </Box>
        </Box>
      )}

      {/* Key hints */}
      <Box marginTop={1}>
        <KeyHint
          hints={
            isRunning
              ? [{ key: "x", action: "Stop" }]
              : [
                  { key: "s", action: "Start" },
                  { key: "d", action: `Toggle dry-run (${dryRun ? "ON" : "OFF"})` },
                  { key: "a", action: "Select all" },
                  { key: "Up/Down", action: "Select strategy" },
                ]
          }
        />
      </Box>
    </Box>
  );
}
