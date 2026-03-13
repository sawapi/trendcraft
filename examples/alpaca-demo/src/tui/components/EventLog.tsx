/**
 * EventLog — scrollable list of recent trading events
 */

import { Box, Text } from "ink";
import type React from "react";
import type { TradingEvent } from "../../trading/events.js";

type EventLogProps = {
  events: TradingEvent[];
  maxLines?: number;
};

function formatEvent(event: TradingEvent): { text: string; color: string } {
  switch (event.type) {
    case "trade-executed": {
      const pnl = event.pnl != null ? ` P&L: $${event.pnl.toFixed(0)}` : "";
      return {
        text: `${event.side.toUpperCase()} ${event.shares} ${event.symbol} (${event.reason})${pnl}`,
        color: event.side === "buy" ? "green" : "red",
      };
    }
    case "trade-blocked":
      return { text: `BLOCKED ${event.symbol}: ${event.reason}`, color: "yellow" };
    case "agent-created":
      return { text: `Agent created: ${event.agentId}`, color: "cyan" };
    case "state-saved":
      return { text: `State saved (${event.agentCount} agents)`, color: "gray" };
    case "leaderboard-updated":
      return { text: "Leaderboard updated", color: "gray" };
    case "review-started":
      return {
        text: `Review started: ${event.reviewType}${event.reviewNumber ? ` #${event.reviewNumber}` : ""}`,
        color: "magenta",
      };
    case "review-completed":
      return {
        text: `Review completed: ${event.appliedCount} applied, ${event.rejectedCount} rejected`,
        color: "magenta",
      };
    case "error":
      return { text: `ERROR [${event.source}]: ${event.message}`, color: "red" };
    case "session-started":
      return {
        text: `Session started: ${event.mode} (${event.agentCount} agents)`,
        color: "green",
      };
    case "session-stopped":
      return { text: "Session stopped", color: "yellow" };
    case "reconciliation":
      return {
        text: `Reconciliation: ${event.discrepancies} discrepancies, ${event.orphaned} orphaned`,
        color: "yellow",
      };
    case "websocket-connected":
      return { text: "WebSocket connected", color: "green" };
    case "websocket-disconnected":
      return { text: "WebSocket disconnected", color: "red" };
  }
}

export function EventLog({ events, maxLines = 10 }: EventLogProps): React.ReactElement {
  const visible = events.slice(-maxLines);

  if (visible.length === 0) {
    return (
      <Box>
        <Text color="gray">No events yet.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {visible.map((event, i) => {
        const { text, color } = formatEvent(event);
        return (
          <Box key={i}>
            <Text color={color}>{text}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
