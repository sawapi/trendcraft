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
import { SymbolTabs } from "./components/SymbolTabs";
import { IndicatorSettingsDialog } from "./components/IndicatorSettingsDialog";

export default function App() {
  const { phase, symbols } = useSimulatorStore();
  const [pendingSession, setPendingSession] = useState<SessionData | null>(() => loadSession());
  const [showSessionManager, setShowSessionManager] = useState(() => !!loadSession());
  const [showIndicatorSettings, setShowIndicatorSettings] = useState(false);

  // 銘柄が読み込まれているかどうか
  const hasData = symbols.length > 0 && symbols[0].allCandles.length > 0;

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

  if (!hasData) {
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
        <div className="app-header">
          <h1>Trading Simulator</h1>
        </div>
        <div className="setup-layout">
          <div className="setup-tabs-container">
            <SymbolTabs />
          </div>
          <SetupPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <AlertBanner />
      <IndicatorSettingsDialog
        isOpen={showIndicatorSettings}
        onClose={() => setShowIndicatorSettings(false)}
      />
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
          <button
            className="indicator-settings-btn"
            onClick={() => setShowIndicatorSettings(true)}
          >
            <span className="settings-icon">&#9881;</span>
            <span>インジケーター設定</span>
          </button>
          <StatsPanel />
          <PositionPanel />
          <TradePanel />
          <TradeHistoryPanel />
          <TradeAnalysis />
          <ReportButton />
        </div>
        <div className="main-content">
          <SymbolTabs />
          <Chart />
        </div>
      </div>
    </div>
  );
}
