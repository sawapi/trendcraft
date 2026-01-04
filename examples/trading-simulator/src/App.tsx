import { useState, useCallback } from "react";
import { useSimulatorStore } from "./store/simulatorStore";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSessionPersistence, loadSession, clearSession, type SessionData } from "./hooks/useSessionPersistence";
import { FileDropZone } from "./components/FileDropZone";
import { SetupPanel } from "./components/SetupPanel";
import { ControlPanel } from "./components/ControlPanel";
import { PositionPanel } from "./components/PositionPanel";
import { TradePanel } from "./components/TradePanel";
import { TradeHistoryPanel } from "./components/TradeHistoryPanel";
import { StatsPanel } from "./components/StatsPanel";
import { Chart } from "./components/Chart";
import { ReportButton } from "./components/ReportButton";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { ThemeToggle } from "./components/ThemeToggle";
import { AlertBanner } from "./components/AlertBanner";
import { SessionManager } from "./components/SessionManager";
import { TradeAnalysis } from "./components/TradeAnalysis";

export default function App() {
  const { phase, allCandles } = useSimulatorStore();
  const [pendingSession, setPendingSession] = useState<SessionData | null>(() => loadSession());
  const [showSessionManager, setShowSessionManager] = useState(() => !!loadSession());

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Session persistence
  useSessionPersistence();

  const handleSessionRestore = useCallback((session: SessionData) => {
    setPendingSession(session);
    setShowSessionManager(false);
    // ファイルの読み込みを促す（FileDropZoneでセッション復元を処理）
  }, []);

  const handleSessionDiscard = useCallback(() => {
    clearSession();
    setPendingSession(null);
    setShowSessionManager(false);
  }, []);

  if (allCandles.length === 0) {
    return (
      <div className="app">
        <h1>Trading Simulator</h1>
        {showSessionManager && pendingSession && (
          <SessionManager
            onRestore={handleSessionRestore}
            onDiscard={handleSessionDiscard}
          />
        )}
        <FileDropZone pendingSession={pendingSession} />
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="app">
        <h1>Trading Simulator</h1>
        <SetupPanel />
      </div>
    );
  }

  return (
    <div className="app">
      <AlertBanner />
      <div className="app-header">
        <h1>Trading Simulator</h1>
        <div className="header-controls">
          <ThemeToggle />
          <ShortcutsHelp />
        </div>
      </div>
      <div className="simulator-layout">
        <div className="sidebar">
          <ControlPanel />
          <StatsPanel />
          <PositionPanel />
          <TradePanel />
          <TradeHistoryPanel />
          <TradeAnalysis />
          <ReportButton />
        </div>
        <div className="main-content">
          <Chart />
        </div>
      </div>
    </div>
  );
}
