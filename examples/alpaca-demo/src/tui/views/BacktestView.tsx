/**
 * BacktestView — run and display backtest results
 */

import { Box, Text, useInput } from "ink";
import type React from "react";
import { useState } from "react";
import { KeyHint } from "../components/KeyHint.js";
import type { BacktestState } from "../hooks/useBacktest.js";

type BacktestViewProps = {
  backtest: BacktestState;
  onRun: (symbol: string, periodMonths?: number) => Promise<void>;
};

const QUICK_SYMBOLS = ["SPY", "AAPL", "MSFT", "NVDA", "QQQ"];

export function BacktestView({ backtest, onRun }: BacktestViewProps): React.ReactElement {
  const [selectedSymbol, setSelectedSymbol] = useState(0);

  useInput((input, key) => {
    if (input === "b" && !backtest.isRunning) {
      onRun(QUICK_SYMBOLS[selectedSymbol]);
    }
    if (key.upArrow && !backtest.isRunning) {
      setSelectedSymbol((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow && !backtest.isRunning) {
      setSelectedSymbol((prev) => Math.min(QUICK_SYMBOLS.length - 1, prev + 1));
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {" "}
          Backtest{" "}
        </Text>
      </Box>

      {/* Symbol selection */}
      {!backtest.isRunning && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Select Symbol:</Text>
          {QUICK_SYMBOLS.map((sym, i) => (
            <Box key={sym}>
              <Text color={selectedSymbol === i ? "cyan" : "white"}>
                {selectedSymbol === i ? "> " : "  "}
                {sym}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {backtest.isRunning && <Text color="yellow">Running backtest on {backtest.symbol}...</Text>}

      {backtest.error && <Text color="red">Error: {backtest.error}</Text>}

      {/* Results table */}
      {backtest.results.length > 0 && (
        <Box flexDirection="column">
          <Text bold color="cyan">
            {" "}
            Results: {backtest.symbol}{" "}
          </Text>
          <Box marginTop={1}>
            <Text bold color="cyan">
              {"#".padEnd(4)}
              {"Strategy".padEnd(30)}
              {"Score".padEnd(8)}
              {"Return%".padEnd(10)}
              {"WinRate".padEnd(10)}
              {"Sharpe".padEnd(9)}
              {"MaxDD".padEnd(9)}
              {"PF".padEnd(8)}
              {"Trades".padEnd(8)}
            </Text>
          </Box>
          <Text color="gray">{"-".repeat(96)}</Text>
          {backtest.results.slice(0, 15).map((r, i) => {
            const m = r.result;
            const retColor = m.totalReturnPercent >= 0 ? "green" : "red";
            return (
              <Box key={r.strategyId}>
                <Text>
                  {String(i + 1).padEnd(4)}
                  {r.strategyId.slice(0, 28).padEnd(30)}
                  {r.score.toFixed(1).padEnd(8)}
                  <Text color={retColor}>{`${m.totalReturnPercent.toFixed(2)}%`.padEnd(10)}</Text>
                  {`${m.winRate.toFixed(1)}%`.padEnd(10)}
                  {m.sharpeRatio.toFixed(2).padEnd(9)}
                  {`${m.maxDrawdown.toFixed(1)}%`.padEnd(9)}
                  {(m.profitFactor === Number.POSITIVE_INFINITY
                    ? "Inf"
                    : m.profitFactor.toFixed(2)
                  ).padEnd(8)}
                  {String(m.tradeCount).padEnd(8)}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      <Box marginTop={1}>
        <KeyHint
          hints={[
            { key: "b", action: "Run backtest" },
            { key: "Up/Down", action: "Select symbol" },
          ]}
        />
      </Box>
    </Box>
  );
}
