/**
 * MarketView — real-time market watchlist tab
 */

import { Box, Text } from "ink";
import type React from "react";
import type { BenchmarkSnapshot } from "../../agent/market-state.js";
import { TickerTable } from "../components/TickerTable.js";

type MarketViewProps = {
  snapshots: BenchmarkSnapshot[];
  isRunning: boolean;
  maxRows: number;
};

export function MarketView({ snapshots, isRunning, maxRows }: MarketViewProps): React.ReactElement {
  if (!isRunning) {
    return (
      <Box flexDirection="column">
        <Text bold color="yellow">
          Market Watchlist
        </Text>
        <Box marginTop={1}>
          <Text color="gray">Start a live session to see market data.</Text>
        </Box>
      </Box>
    );
  }

  // Summary stats
  const count = snapshots.length;
  let topGainer: BenchmarkSnapshot | null = null;
  let topLoser: BenchmarkSnapshot | null = null;
  for (const s of snapshots) {
    if (!topGainer || s.dailyChangePercent > topGainer.dailyChangePercent) topGainer = s;
    if (!topLoser || s.dailyChangePercent < topLoser.dailyChangePercent) topLoser = s;
  }

  // Reserve rows for header (title + summary + gap + table header + separator = 5)
  const tableMaxRows = Math.max(1, maxRows - 5);

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">
        Market Watchlist
      </Text>

      <Box gap={2}>
        <Text>
          Symbols: <Text bold>{count}</Text>
        </Text>
        {topGainer && (
          <Text>
            Top:{" "}
            <Text color="green">
              {topGainer.symbol} +{topGainer.dailyChangePercent.toFixed(2)}%
            </Text>
          </Text>
        )}
        {topLoser && (
          <Text>
            Bottom:{" "}
            <Text color="red">
              {topLoser.symbol} {topLoser.dailyChangePercent.toFixed(2)}%
            </Text>
          </Text>
        )}
      </Box>

      <Box marginTop={1}>
        <TickerTable snapshots={snapshots} maxRows={tableMaxRows} />
      </Box>
    </Box>
  );
}
