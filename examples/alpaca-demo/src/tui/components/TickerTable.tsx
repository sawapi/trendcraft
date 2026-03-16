/**
 * TickerTable — real-time ticker table for watchlist symbols
 */

import { Box, Text } from "ink";
import type React from "react";
import type { BenchmarkSnapshot } from "../../agent/market-state.js";

type TickerTableProps = {
  snapshots: BenchmarkSnapshot[];
  maxRows?: number;
};

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return String(vol);
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

export function TickerTable({ snapshots, maxRows }: TickerTableProps): React.ReactElement {
  if (snapshots.length === 0) {
    return (
      <Box>
        <Text color="gray">No market data yet.</Text>
      </Box>
    );
  }

  const sorted = [...snapshots].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const display = maxRows ? sorted.slice(0, maxRows) : sorted;

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">
          {"Symbol".padEnd(10)}
          {"Last".padEnd(12)}
          {"Chg%".padEnd(10)}
          {"Trades".padEnd(10)}
          {"Volume".padEnd(10)}
          {"Updated".padEnd(10)}
        </Text>
      </Box>
      <Box>
        <Text color="gray">{"-".repeat(62)}</Text>
      </Box>
      {display.map((snap) => {
        const chgColor = snap.dailyChangePercent >= 0 ? "green" : "red";
        const chgStr = `${snap.dailyChangePercent >= 0 ? "+" : ""}${snap.dailyChangePercent.toFixed(2)}%`;

        return (
          <Box key={snap.symbol}>
            <Text>
              <Text bold>{snap.symbol.padEnd(10)}</Text>
              {`$${snap.lastPrice.toFixed(2)}`.padEnd(12)}
              <Text color={chgColor}>{chgStr.padEnd(10)}</Text>
              {String(snap.tradeCount).padEnd(10)}
              {formatVolume(snap.volume).padEnd(10)}
              <Text color="gray">{formatTime(snap.updatedAt)}</Text>
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
