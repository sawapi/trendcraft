/**
 * App — main TUI application with tab routing
 */

import { Box, Text, useApp, useInput } from "ink";
import type React from "react";
import { useState } from "react";
import type { SessionOptions } from "../trading/session.js";
import { StatusBar, formatDuration } from "./components/StatusBar.js";
import { TabBar } from "./components/TabBar.js";
import type { Tab } from "./components/TabBar.js";
import { useBacktest } from "./hooks/useBacktest.js";
import { useReviews } from "./hooks/useReviews.js";
import { useSettings } from "./hooks/useSettings.js";
import { useSymbolSource } from "./hooks/useSymbolSource.js";
import { useTerminalSize } from "./hooks/useTerminalSize.js";
import { useTrading } from "./hooks/useTrading.js";
import { BacktestView } from "./views/BacktestView.js";
import { Dashboard } from "./views/Dashboard.js";
import { LiveControl } from "./views/LiveControl.js";
import { MarketView } from "./views/MarketView.js";
import { ReviewView } from "./views/ReviewView.js";
import { Settings } from "./views/Settings.js";

const TABS: Tab[] = [
  { key: "1", label: "Dashboard" },
  { key: "2", label: "Live" },
  { key: "3", label: "Review" },
  { key: "4", label: "Backtest" },
  { key: "5", label: "Settings" },
  { key: "6", label: "Market" },
];

type AppProps = {
  options: SessionOptions;
};

export function App({ options }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [activeTab, setActiveTab] = useState(0);
  const [tradingState, tradingActions] = useTrading();
  const [reviewsState, reviewsActions] = useReviews();
  const [backtestState, backtestActions] = useBacktest();
  const [settings, settingsActions] = useSettings();
  const [symbolSource, symbolSourceActions] = useSymbolSource();
  const { rows, contentRows } = useTerminalSize();

  // Shared selected symbols state for LiveControl
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(
    () => new Set(settings.defaultSymbols),
  );

  const handleToggleSymbol = (symbol: string) => {
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

  useInput((_input, _key) => {
    // Tab switching via number keys
    if (_input === "1") setActiveTab(0);
    else if (_input === "2") setActiveTab(1);
    else if (_input === "3") setActiveTab(2);
    else if (_input === "4") setActiveTab(3);
    else if (_input === "5") setActiveTab(4);
    else if (_input === "6") setActiveTab(5);

    // Quit
    if (_input === "q") {
      if (tradingState.isRunning) {
        tradingActions.stopSession().then(() => exit());
      } else {
        exit();
      }
    }
  });

  const totalPnl = tradingState.agents.reduce((sum, a) => sum + a.metrics.totalReturn, 0);
  const sessionDuration = tradingState.isRunning
    ? formatDuration(Date.now() - tradingState.startTime)
    : "—";

  return (
    <Box flexDirection="column" height={rows}>
      {/* Header */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1} flexShrink={0}>
        <Text bold color="cyan">
          ALPACA TRADING CONSOLE
        </Text>
      </Box>

      {/* Tab bar */}
      <Box paddingX={1} flexShrink={0}>
        <TabBar tabs={TABS} activeIndex={activeTab} />
      </Box>

      {/* Content area */}
      <Box flexGrow={1} paddingX={1} overflow="hidden">
        {activeTab === 0 && (
          <Dashboard
            agents={tradingState.agents}
            events={tradingState.events}
            isRunning={tradingState.isRunning}
            maxRows={contentRows}
            deactivatedStrategies={tradingState.deactivatedStrategies}
          />
        )}
        {activeTab === 1 && (
          <LiveControl
            agents={tradingState.agents}
            isRunning={tradingState.isRunning}
            isInitializing={tradingState.isInitializing}
            error={tradingState.error}
            onStart={tradingActions.startSession}
            onStop={tradingActions.stopSession}
            onKillAgent={tradingActions.killAgent}
            onReviveAgent={tradingActions.reviveAgent}
            getKilledAgents={tradingActions.getKilledAgents}
            selectedSymbols={selectedSymbols}
            onToggleSymbol={handleToggleSymbol}
            symbolSource={symbolSource}
            symbolSourceActions={symbolSourceActions}
            maxRows={contentRows}
          />
        )}
        {activeTab === 2 && (
          <ReviewView
            reviews={reviewsState}
            onReload={reviewsActions.reload}
            onRunReview={reviewsActions.runReview}
            maxRows={contentRows}
          />
        )}
        {activeTab === 3 && (
          <BacktestView
            backtest={backtestState}
            onRun={backtestActions.run}
            symbolSource={symbolSource}
            symbolSourceActions={symbolSourceActions}
            maxRows={contentRows}
          />
        )}
        {activeTab === 4 && (
          <Settings
            settings={settings}
            actions={settingsActions}
            symbolSource={symbolSource}
            symbolSourceActions={symbolSourceActions}
            maxRows={contentRows}
          />
        )}
        {activeTab === 5 && (
          <MarketView
            snapshots={tradingState.tickerSnapshots}
            isRunning={tradingState.isRunning}
            maxRows={contentRows}
          />
        )}
      </Box>

      {/* Status bar */}
      <StatusBar
        mode={tradingState.mode}
        sessionDuration={sessionDuration}
        agentCount={tradingState.agents.length}
        totalPnl={totalPnl}
        isRunning={tradingState.isRunning}
      />

      {/* Navigation hint */}
      <Box paddingX={1} flexShrink={0}>
        <Text color="gray">1-6: Switch tabs | q: Quit</Text>
      </Box>
    </Box>
  );
}
