/**
 * AlertBanner — critical event banner displayed above content area
 *
 * Shows error, websocket-disconnected, and reconciliation events with
 * discrepancies as a red banner. Auto-dismisses after 30 seconds except
 * for websocket-disconnected which persists until reconnection.
 */

import { Box, Text, useInput } from "ink";
import type React from "react";
import { useEffect, useState } from "react";
import type { TimestampedEvent } from "../hooks/useTrading.js";

/** Event types that trigger the alert banner */
const CRITICAL_TYPES = new Set(["error", "websocket-disconnected", "reconciliation"]);

/** Auto-dismiss timeout in ms (30 seconds) */
const AUTO_DISMISS_MS = 30_000;

type AlertBannerProps = {
  events: TimestampedEvent[];
};

export function AlertBanner({ events }: AlertBannerProps): React.ReactElement | null {
  const [dismissed, setDismissed] = useState<number>(0);

  // Find the latest critical event
  const criticalEvent = [...events].reverse().find((e) => {
    if (!CRITICAL_TYPES.has(e.event.type)) return false;
    // Skip reconciliation with 0 discrepancies
    if (e.event.type === "reconciliation" && e.event.discrepancies === 0) return false;
    return true;
  });

  // Auto-dismiss non-pinned alerts after 30 seconds
  useEffect(() => {
    if (!criticalEvent) return;
    if (criticalEvent.event.type === "websocket-disconnected") return; // pinned

    const age = Date.now() - criticalEvent.timestamp;
    if (age >= AUTO_DISMISS_MS) return;

    const timer = setTimeout(() => {
      setDismissed(criticalEvent.timestamp);
    }, AUTO_DISMISS_MS - age);

    return () => clearTimeout(timer);
  }, [criticalEvent]);

  // Check if a websocket-connected event came after the disconnected event
  const isReconnected =
    criticalEvent?.event.type === "websocket-disconnected" &&
    events.some(
      (e) => e.event.type === "websocket-connected" && e.timestamp > criticalEvent.timestamp,
    );

  // Dismiss on any key press
  useInput(() => {
    if (criticalEvent && criticalEvent.event.type !== "websocket-disconnected") {
      setDismissed(criticalEvent.timestamp);
    }
  });

  if (!criticalEvent) return null;
  if (criticalEvent.timestamp <= dismissed) return null;
  if (isReconnected) return null;

  let message: string;
  switch (criticalEvent.event.type) {
    case "error":
      message = `ERROR [${criticalEvent.event.source}]: ${criticalEvent.event.message}`;
      break;
    case "websocket-disconnected":
      message = "WebSocket DISCONNECTED — data feed interrupted";
      break;
    case "reconciliation":
      message = `Reconciliation: ${criticalEvent.event.discrepancies} discrepancies, ${criticalEvent.event.orphaned} orphaned`;
      break;
    default:
      return null;
  }

  return (
    <Box flexShrink={0}>
      <Text backgroundColor="red" color="white" bold>
        {` ⚠ ${message} `}
      </Text>
    </Box>
  );
}
