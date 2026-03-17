import { useCallback, useState } from "react";
import { AlertBanner } from "./components/AlertBanner";
import { Chart } from "./components/Chart";
import { CoachingPanel } from "./components/CoachingPanel";
import { ControlPanel } from "./components/ControlPanel";
import { FileDropZone } from "./components/FileDropZone";
import { IndicatorSettingsDialog } from "./components/IndicatorSettingsDialog";
import { PositionPanel } from "./components/PositionPanel";
import { ReportButton } from "./components/ReportButton";
import { SessionManager } from "./components/SessionManager";
import { SetupPanel } from "./components/SetupPanel";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { StatsPanel } from "./components/StatsPanel";
import { SymbolTabs } from "./components/SymbolTabs";
import { ThemeToggle } from "./components/ThemeToggle";
import { TradeAnalysis } from "./components/TradeAnalysis";
import { TradeHistoryPanel } from "./components/TradeHistoryPanel";
import { TradePanel } from "./components/TradePanel";
import { PerformanceReview } from "./components/review/PerformanceReview";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  type SessionData,
  clearSession,
  loadSession,
  useSessionPersistence,
} from "./hooks/useSessionPersistence";
import { useSimulatorStore } from "./store/simulatorStore";

export default function App() {
  const { phase, symbols } = useSimulatorStore();
  const [pendingSession, setPendingSession] = useState<SessionData | null>(() => loadSession());
  const [showSessionManager, setShowSessionManager] = useState(() => !!loadSession());
  const [showIndicatorSettings, setShowIndicatorSettings] = useState(false);

  // Whether symbol data has been loaded
  const hasData = symbols.length > 0 && symbols[0].allCandles.length > 0;

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Session persistence
  useSessionPersistence();

  const handleSessionRestore = useCallback((session: SessionData) => {
    setPendingSession(session);
    setShowSessionManager(false);
    // Prompt file loading (session restore is handled in FileDropZone)
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
          <SessionManager onRestore={handleSessionRestore} onDiscard={handleSessionDiscard} />
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

  if (phase === "finished") {
    return (
      <div className="app">
        <div className="app-header">
          <h1>Trading Simulator</h1>
          <div className="header-controls">
            <ThemeToggle />
          </div>
        </div>
        <div className="finished-layout">
          <PerformanceReview />
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
            type="button"
            className="indicator-settings-btn"
            onClick={() => setShowIndicatorSettings(true)}
          >
            <span className="settings-icon">&#9881;</span>
            <span>Indicator Settings</span>
          </button>
          <CoachingPanel />
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
