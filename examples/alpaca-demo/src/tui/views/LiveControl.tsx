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

    // Panel switching via Tab (works in both panels)
    if (key.tab) {
      setFocusPanel((prev) => (prev === "strategy" ? "symbols" : "strategy"));
    }
    // Escape also returns to strategy panel from symbols
    if (key.escape && focusPanel === "symbols") {
      setFocusPanel("strategy");
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Status line */}
      <Box gap={3} marginBottom={1}>
        <Text bold color="cyan">
          Trading Control
        </Text>
        <Text>
          Status:{" "}
          <Text bold color={isRunning ? "green" : isInitializing ? "yellow" : "gray"}>
            {isRunning ? "RUNNING" : isInitializing ? "INITIALIZING..." : "STOPPED"}
          </Text>
        </Text>
        <Text>
          Mode:{" "}
          <Text bold color={dryRun ? "yellow" : "red"}>
            {dryRun ? "DRY RUN" : "PAPER TRADING"}
          </Text>
        </Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Configuration panels (when not running) */}
      {!isRunning && (
        <StrategyAndSymbolPanels
          strategyIds={strategyIds}
          selectedStrategy={selectedStrategy}
          focusPanel={focusPanel}
          symbolSource={symbolSource}
          symbolSourceActions={symbolSourceActions}
          selectedSymbols={selectedSymbols}
          onToggleSymbol={onToggleSymbol}
          maxRows={maxRows - 4}
        />
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
                    { key: "Tab", action: "Switch panel" },
                    ...(focusPanel === "symbols"
                      ? [
                          { key: "n", action: "Change source" },
                          ...(symbolSource.source === "sec"
                            ? [{ key: "Left/Right", action: "Sector" }]
                            : []),
                          { key: "Space", action: "Toggle" },
                        ]
                      : [{ key: "Up/Down", action: "Select" }]),
                  ]
          }
        />
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Strategy list with scrolling + Symbol picker in side-by-side panels
// ---------------------------------------------------------------------------

type PanelsProps = {
  strategyIds: string[];
  selectedStrategy: number;
  focusPanel: Panel;
  symbolSource: SymbolSourceState;
  symbolSourceActions: SymbolSourceActions;
  selectedSymbols: Set<string>;
  onToggleSymbol: (symbol: string) => void;
  maxRows: number;
};

function StrategyAndSymbolPanels({
  strategyIds,
  selectedStrategy,
  focusPanel,
  symbolSource,
  symbolSourceActions,
  selectedSymbols,
  onToggleSymbol,
  maxRows,
}: PanelsProps): React.ReactElement {
  // Show only the focused panel to avoid horizontal overflow
  const isFocused = focusPanel === "strategy";

  // All items: index -1 = [ALL], then 0..n = strategies
  const totalItems = strategyIds.length + 1; // +1 for [ALL]
  const cursorIndex = selectedStrategy + 1; // map -1→0, 0→1, etc.

  // Scrolling: keep cursor visible in a viewport
  // Panel overhead: title(1) + above/below hints(2) + summary(1) = 4
  const panelOverhead = 4;
  const panelMaxRows = Math.max(3, maxRows - panelOverhead);
  const pageSize = Math.min(panelMaxRows, totalItems);

  const pageStart = Math.max(
    0,
    Math.min(cursorIndex - Math.floor(pageSize / 2), totalItems - pageSize),
  );
  const visibleStart = Math.max(0, pageStart);
  const visibleEnd = Math.min(totalItems, visibleStart + pageSize);

  if (isFocused) {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          Strategy Selection
        </Text>
        <Box flexDirection="column">
          {visibleStart > 0 && (
            <Text color="gray">
              {"  "}... {visibleStart} more above
            </Text>
          )}
          {Array.from({ length: visibleEnd - visibleStart }, (_, i) => {
            const itemIndex = visibleStart + i;
            const stratIdx = itemIndex - 1;
            const isSelected = stratIdx === selectedStrategy;
            const label = itemIndex === 0 ? "[ALL] Use all strategies" : strategyIds[stratIdx];

            return (
              <Box key={itemIndex}>
                <Text color={isSelected ? "cyan" : "white"}>
                  {isSelected ? "> " : "  "}
                  {label}
                </Text>
              </Box>
            );
          })}
          {visibleEnd < totalItems && (
            <Text color="gray">
              {"  "}... {totalItems - visibleEnd} more below
            </Text>
          )}
        </Box>
        <Text color="gray">
          Selected:{" "}
          <Text color="yellow">
            {selectedStrategy === -1 ? "ALL" : strategyIds[selectedStrategy]}
          </Text>
          {"  |  "}Symbols:{" "}
          <Text color="yellow">
            {selectedSymbols.size > 0 ? [...selectedSymbols].join(", ") : "(none)"}
          </Text>
          {"  "}[Tab→Symbols]
        </Text>
      </Box>
    );
  }

  // Symbols panel
  return (
    <Box flexDirection="column">
      <Text color="gray">
        Strategy:{" "}
        <Text color="yellow">
          {selectedStrategy === -1 ? "ALL" : strategyIds[selectedStrategy]}
        </Text>
        {"  "}[Tab→Strategy]
      </Text>
      <SymbolPicker
        symbolSource={symbolSource}
        symbolSourceActions={symbolSourceActions}
        selected={selectedSymbols}
        onToggle={onToggleSymbol}
        focused
        maxListRows={Math.max(5, maxRows - 2)}
      />
    </Box>
  );
}
