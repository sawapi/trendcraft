/**
 * BacktestView — run and display multi-symbol backtest results
 */

import { Box, Text, useInput } from "ink";
import type React from "react";
import { useState } from "react";
import { KeyHint } from "../components/KeyHint.js";
import { MultiSelect } from "../components/MultiSelect.js";
import type { BacktestState } from "../hooks/useBacktest.js";

type BacktestViewProps = {
  backtest: BacktestState;
  onRun: (symbols: string[], periodMonths?: number) => Promise<void>;
};

const QUICK_SYMBOLS = ["SPY", "AAPL", "MSFT", "NVDA", "QQQ"];

export function BacktestView({ backtest, onRun }: BacktestViewProps): React.ReactElement {
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(() => new Set(["SPY"]));
  const [symbolCursor, setSymbolCursor] = useState(0);

  useInput((input) => {
    if (input === "b" && !backtest.isRunning && selectedSymbols.size > 0) {
      onRun([...selectedSymbols]);
    }
  });

  const handleToggle = (symbol: string) => {
    setSelectedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

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
        <Box marginBottom={1}>
          <MultiSelect
            items={QUICK_SYMBOLS}
            selected={selectedSymbols}
            focused={true}
            cursor={symbolCursor}
            onToggle={handleToggle}
            onCursorChange={setSymbolCursor}
            label="Select Symbols:"
          />
        </Box>
      )}

      {backtest.isRunning && (
        <Text color="yellow">{backtest.progress ?? "Running backtest..."}</Text>
      )}

      {backtest.error && <Text color="red">Error: {backtest.error}</Text>}

      {/* Results table */}
      {backtest.results.length > 0 && (
        <Box flexDirection="column">
          <Text bold color="cyan">
            {" "}
            Results{" "}
          </Text>
          <Box marginTop={1}>
            <Text bold color="cyan">
              {"#".padEnd(4)}
              {"Symbol".padEnd(8)}
              {"Strategy".padEnd(26)}
              {"Score".padEnd(8)}
              {"Return%".padEnd(10)}
              {"WinRate".padEnd(10)}
              {"Sharpe".padEnd(9)}
              {"MaxDD".padEnd(9)}
              {"PF".padEnd(8)}
              {"Trades".padEnd(8)}
            </Text>
          </Box>
          <Text color="gray">{"-".repeat(100)}</Text>
          {backtest.results.slice(0, 15).map((r, i) => {
            const m = r.result;
            const retColor = m.totalReturnPercent >= 0 ? "green" : "red";
            return (
              <Box key={`${r.symbol}-${r.strategyId}`}>
                <Text>
                  {String(i + 1).padEnd(4)}
                  {r.symbol.padEnd(8)}
                  {r.strategyId.slice(0, 24).padEnd(26)}
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
            { key: "b", action: `Run backtest (${selectedSymbols.size} symbols)` },
            { key: "Space", action: "Toggle symbol" },
            { key: "Up/Down", action: "Navigate" },
          ]}
        />
      </Box>
    </Box>
  );
}
