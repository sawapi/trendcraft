/**
 * EventLog — scrollable list of recent trading events with timestamps
 */

import { Box, Text } from "ink";
import type React from "react";
import type { TradingEvent } from "../../trading/events.js";
import type { TimestampedEvent } from "../hooks/useTrading.js";

/** Event types that are considered noise for the Dashboard view */
const NOISE_TYPES: Set<TradingEvent["type"]> = new Set(["state-saved", "leaderboard-updated"]);

type EventLogProps = {
  events: TimestampedEvent[];
  maxLines?: number;
  /** If true, filter out noise events (state-saved, leaderboard-updated) */
  filterNoise?: boolean;
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

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

export function EventLog({
  events,
  maxLines = 10,
  filterNoise,
}: EventLogProps): React.ReactElement {
  const filtered = filterNoise ? events.filter((e) => !NOISE_TYPES.has(e.event.type)) : events;
  const visible = filtered.slice(-maxLines);

  if (visible.length === 0) {
    return (
      <Box>
        <Text color="gray">No events yet.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {visible.map((stamped, i) => {
        const { text, color } = formatEvent(stamped.event);
        const timeStr = formatTime(stamped.timestamp);
        return (
          <Box key={i}>
            <Text color="gray">{timeStr} </Text>
            <Text color={color}>{text}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
