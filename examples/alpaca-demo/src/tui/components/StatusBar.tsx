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
  exposurePercent?: number | null;
  openPositions?: number | null;
  unrealizedPnl?: number;
};

export function StatusBar({
  mode,
  sessionDuration,
  agentCount,
  totalPnl,
  isRunning,
  exposurePercent,
  openPositions,
  unrealizedPnl,
}: StatusBarProps): React.ReactElement {
  const pnlColor = totalPnl >= 0 ? "green" : "red";
  const pnlSign = totalPnl >= 0 ? "+" : "";
  const uPnl = unrealizedPnl ?? 0;
  const uPnlColor = uPnl >= 0 ? "green" : "red";
  const uPnlSign = uPnl >= 0 ? "+" : "";

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} flexShrink={0}>
      <Text>
        Status:{" "}
        <Text bold color={isRunning ? "green" : "yellow"}>
          {isRunning ? mode : "OFFLINE"}
        </Text>
        {" | "}
        <Text>{sessionDuration}</Text>
        {" | "}
        Agents: <Text bold>{agentCount}</Text>
        {exposurePercent != null && (
          <>
            {" | "}
            Exp: <Text bold>{exposurePercent.toFixed(0)}%</Text>
          </>
        )}
        {openPositions != null && (
          <>
            {" | "}
            Pos: <Text bold>{openPositions}</Text>
          </>
        )}
        {isRunning && (
          <>
            {" | "}
            uP&L:{" "}
            <Text bold color={uPnlColor}>
              {uPnlSign}${uPnl.toFixed(0)}
            </Text>
          </>
        )}
        {" | "}
        Net:{" "}
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
