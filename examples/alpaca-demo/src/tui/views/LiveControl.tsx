/**
 * LiveControl view — start/stop trading, strategy/symbol selection, agent kill/revive
 */

import { Box, Text, useInput } from "ink";
import type React from "react";
import { useState } from "react";
import type { AgentState } from "../../agent/types.js";
import { getStrategyIds } from "../../strategy/registry.js";
import type { SessionOptions } from "../../trading/session.js";
import { AgentTable } from "../components/AgentTable.js";
import { KeyHint } from "../components/KeyHint.js";
import { SymbolPicker } from "../components/SymbolPicker.js";
import type { SymbolSourceActions, SymbolSourceState } from "../hooks/useSymbolSource.js";

type KilledAgent = {
  strategyId: string;
  symbol: string;
};

type LiveControlProps = {
  agents: AgentState[];
  isRunning: boolean;
  isInitializing: boolean;
  error: string | null;
  onStart: (opts: SessionOptions) => Promise<void>;
  onStop: () => Promise<void>;
  onKillAgent: (agentId: string) => void;
  onReviveAgent: (agentId: string) => void;
  getKilledAgents: () => Map<string, KilledAgent>;
  selectedSymbols: Set<string>;
  onToggleSymbol: (symbol: string) => void;
  symbolSource: SymbolSourceState;
  symbolSourceActions: SymbolSourceActions;
  maxRows: number;
};

type Panel = "strategy" | "symbols";

export function LiveControl({
  agents,
  isRunning,
  isInitializing,
  error,
  onStart,
  onStop,
  onKillAgent,
  onReviveAgent,
  getKilledAgents,
  selectedSymbols,
  onToggleSymbol,
  symbolSource,
  symbolSourceActions,
  maxRows,
}: LiveControlProps): React.ReactElement {
  const [selectedStrategy, setSelectedStrategy] = useState(0);
  const [dryRun, setDryRun] = useState(true);
  const [focusPanel, setFocusPanel] = useState<Panel>("strategy");
  const [agentCursor, setAgentCursor] = useState(0);
  const [killConfirm, setKillConfirm] = useState<string | null>(null);
  const [showReviveList, setShowReviveList] = useState(false);
  const [reviveCursor, setReviveCursor] = useState(0);

  const strategyIds = getStrategyIds();
  const killedAgents = getKilledAgents();
  const killedEntries = [...killedAgents.entries()];

  useInput((input, key) => {
    if (isInitializing) return;

    // Revive sub-list mode
    if (showReviveList && isRunning) {
      if (key.upArrow) {
        setReviveCursor((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setReviveCursor((prev) => Math.min(killedEntries.length - 1, prev + 1));
      } else if (key.return && killedEntries.length > 0) {
        const entry = killedEntries[reviveCursor];
        if (entry) onReviveAgent(entry[0]);
        setShowReviveList(false);
        setReviveCursor(0);
      } else if (key.escape || input === "v") {
        setShowReviveList(false);
      }
      return;
    }

    // Running mode — agent management
    if (isRunning) {
      if (input === "x") {
        onStop();
        return;
      }
      if (key.upArrow) {
        setAgentCursor((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow) {
        setAgentCursor((prev) => Math.min(agents.length - 1, prev + 1));
      }
      if (input === "k" && agents.length > 0) {
        const agent = agents[agentCursor];
        if (agent) {
          if (killConfirm === agent.id) {
            onKillAgent(agent.id);
            setKillConfirm(null);
            setAgentCursor((prev) => Math.min(prev, agents.length - 2));
          } else {
            setKillConfirm(agent.id);
          }
        }
      }
      if (input === "v" && killedAgents.size > 0) {
        setShowReviveList(true);
        setReviveCursor(0);
      }
      if (key.upArrow || key.downArrow) {
        setKillConfirm(null);
      }
      return;
    }

    // Stopped mode — only handle keys that SymbolPicker doesn't consume
    if (focusPanel !== "symbols") {
      if (input === "s") {
        if (selectedSymbols.size === 0) return;
        const strategyId = strategyIds[selectedStrategy];
        onStart({
          strategy: strategyId,
          all: selectedStrategy === -1,
          dryRun,
          symbols: [...selectedSymbols].join(","),
        });
      }
      if (input === "d") {
        setDryRun((prev) => !prev);
      }
      if (input === "a") {
        setSelectedStrategy(-1);
      }
      if (key.upArrow) {
        setSelectedStrategy((prev) => Math.max(-1, prev - 1));
      }
      if (key.downArrow) {
        setSelectedStrategy((prev) => Math.min(strategyIds.length - 1, prev + 1));
      }
    } else {
      // In symbols panel, still handle s/d/a
      if (input === "s") {
        if (selectedSymbols.size === 0) return;
        const strategyId = strategyIds[selectedStrategy];
        onStart({
          strategy: strategyId,
          all: selectedStrategy === -1,
          dryRun,
          symbols: [...selectedSymbols].join(","),
        });
      }
      if (input === "d") {
        setDryRun((prev) => !prev);
      }
    }

    // Panel switching (works in both panels)
    if (key.leftArrow && focusPanel === "symbols" && symbolSource.source !== "sec") {
      setFocusPanel("strategy");
    }
    if (key.rightArrow && focusPanel === "strategy") {
      setFocusPanel("symbols");
    }
    // For SEC source, use Escape to go back to strategy panel
    if (key.escape && focusPanel === "symbols") {
      setFocusPanel("strategy");
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

      {/* Configuration panels (when not running) */}
      {!isRunning && (
        <Box gap={4} marginBottom={1}>
          {/* Strategy panel */}
          <Box flexDirection="column" width={36}>
            <Text bold color={focusPanel === "strategy" ? "cyan" : "white"}>
              Strategy Selection
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

          {/* Symbol picker panel */}
          <SymbolPicker
            symbolSource={symbolSource}
            symbolSourceActions={symbolSourceActions}
            selected={selectedSymbols}
            onToggle={onToggleSymbol}
            focused={focusPanel === "symbols"}
            maxListRows={Math.max(5, maxRows - 6)}
          />
        </Box>
      )}

      {/* Agent table (when running or has agents) */}
      {agents.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="cyan">
            {" "}
            Active Agents{" "}
          </Text>
          <Box marginTop={1} flexDirection="column">
            {isRunning && (
              <Box flexDirection="column">
                {agents.map((agent, i) => {
                  const isCursor = i === agentCursor;
                  const isKillTarget = killConfirm === agent.id;
                  return (
                    <Box key={agent.id}>
                      <Text color={isCursor ? "cyan" : "white"}>
                        {isCursor ? "> " : "  "}
                        {agent.id.padEnd(30)}
                        <Text color={agent.metrics.totalReturn >= 0 ? "green" : "red"}>
                          {`${agent.metrics.totalReturnPercent.toFixed(2)}%`.padEnd(10)}
                        </Text>
                        {`W:${agent.metrics.winRate.toFixed(0)}%`.padEnd(8)}
                        {`T:${agent.metrics.totalTrades}`}
                        {isKillTarget && <Text color="red"> [press k again to confirm kill]</Text>}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            )}
            {!isRunning && <AgentTable agents={agents} compact />}
          </Box>
        </Box>
      )}

      {/* Revive sub-list */}
      {showReviveList && (
        <Box
          flexDirection="column"
          marginBottom={1}
          borderStyle="single"
          borderColor="yellow"
          paddingX={1}
        >
          <Text bold color="yellow">
            Killed Agents — select to revive (Enter)
          </Text>
          {killedEntries.length === 0 ? (
            <Text color="gray">No killed agents.</Text>
          ) : (
            killedEntries.map(([id, info], i) => (
              <Box key={id}>
                <Text color={i === reviveCursor ? "cyan" : "white"}>
                  {i === reviveCursor ? "> " : "  "}
                  {id} ({info.strategyId} / {info.symbol})
                </Text>
              </Box>
            ))
          )}
        </Box>
      )}

      {/* Key hints */}
      <Box marginTop={1}>
        <KeyHint
          hints={
            showReviveList
              ? [
                  { key: "Enter", action: "Revive" },
                  { key: "v/Esc", action: "Close" },
                  { key: "Up/Down", action: "Navigate" },
                ]
              : isRunning
                ? [
                    { key: "x", action: "Stop" },
                    { key: "k", action: "Kill agent" },
                    ...(killedAgents.size > 0
                      ? [{ key: "v", action: `Revive (${killedAgents.size})` }]
                      : []),
                    { key: "Up/Down", action: "Select agent" },
                  ]
                : [
                    { key: "s", action: `Start (${selectedSymbols.size} sym)` },
                    { key: "d", action: `Dry-run (${dryRun ? "ON" : "OFF"})` },
                    ...(focusPanel === "strategy" ? [{ key: "a", action: "All strategies" }] : []),
                    { key: "Right/Esc", action: "Switch panel" },
                    ...(focusPanel === "symbols"
                      ? [
                          { key: "Tab", action: "Change source" },
                          ...(symbolSource.source === "sec"
                            ? [{ key: "Left/Right", action: "Sector" }]
                            : []),
                          { key: "Space", action: "Toggle" },
                        ]
                      : []),
                  ]
          }
        />
      </Box>
    </Box>
  );
}
