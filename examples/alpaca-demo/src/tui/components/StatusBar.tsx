/**
 * StatusBar — bottom status line showing session state
 */

import { Box, Text } from "ink";
import type React from "react";

type StatusBarProps = {
  mode: string;
  sessionDuration: string;
  agentCount: number;
  totalPnl: number;
  isRunning: boolean;
};

export function StatusBar({
  mode,
  sessionDuration,
  agentCount,
  totalPnl,
  isRunning,
}: StatusBarProps): React.ReactElement {
  const pnlColor = totalPnl >= 0 ? "green" : "red";
  const pnlSign = totalPnl >= 0 ? "+" : "";

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text>
        Status:{" "}
        <Text bold color={isRunning ? "green" : "yellow"}>
          {isRunning ? mode : "OFFLINE"}
        </Text>
        {" | "}
        Session: <Text>{sessionDuration}</Text>
        {" | "}
        Agents: <Text bold>{agentCount}</Text>
        {" | "}
        Net P&L:{" "}
        <Text bold color={pnlColor}>
          {pnlSign}${totalPnl.toFixed(0)}
        </Text>
      </Text>
    </Box>
  );
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
