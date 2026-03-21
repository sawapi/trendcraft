import { useCallback, useEffect, useState } from "react";
import { AlertBanner } from "./components/AlertBanner";
import { Chart } from "./components/Chart";
import { CoachingPanel } from "./components/CoachingPanel";
import { ControlPanel } from "./components/ControlPanel";
import { FileDropZone } from "./components/FileDropZone";
import { IndicatorSettingsDialog } from "./components/IndicatorSettingsDialog";
import { PositionPanel } from "./components/PositionPanel";
import { ReportButton } from "./components/ReportButton";
import { SessionManager } from "./components/SessionManager";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { SimulationSettingsDialog } from "./components/SimulationSettingsDialog";
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
  const { phase, symbols, quickStart } = useSimulatorStore();
  const [pendingSession, setPendingSession] = useState<SessionData | null>(() => loadSession());
  const [showSessionManager, setShowSessionManager] = useState(() => !!loadSession());
  const [showIndicatorSettings, setShowIndicatorSettings] = useState(false);
  const [showSimSettings, setShowSimSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<"trade" | "stats" | "tools">("trade");

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

  // Auto-start simulation when data is loaded and still in setup phase
  useEffect(() => {
    if (hasData && phase === "setup") {
      quickStart();
      // Show settings dialog on first launch so user can review defaults
      setShowSimSettings(true);
    }
  }, [hasData, phase, quickStart]);

  if (!hasData || phase === "setup") {
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
      <SimulationSettingsDialog
        isOpen={showSimSettings}
        onClose={() => setShowSimSettings(false)}
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
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${activeTab === "trade" ? "active" : ""}`}
              onClick={() => setActiveTab("trade")}
            >
              <span className="material-icons">swap_vert</span>
              <span>Trade</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === "stats" ? "active" : ""}`}
              onClick={() => setActiveTab("stats")}
            >
              <span className="material-icons">analytics</span>
              <span>Stats</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === "tools" ? "active" : ""}`}
              onClick={() => setActiveTab("tools")}
            >
              <span className="material-icons">build</span>
              <span>Tools</span>
            </button>
          </div>

          <div className="sidebar-content">
            {activeTab === "trade" && (
              <>
                <ControlPanel />
                <TradePanel />
                <PositionPanel />
              </>
            )}
            {activeTab === "stats" && (
              <>
                <StatsPanel />
                <TradeHistoryPanel />
                <TradeAnalysis />
              </>
            )}
            {activeTab === "tools" && (
              <>
                <button
                  type="button"
                  className="indicator-settings-btn"
                  onClick={() => setShowSimSettings(true)}
                >
                  <span className="material-icons">settings</span>
                  <span>Simulation Settings</span>
                </button>
                <button
                  type="button"
                  className="indicator-settings-btn"
                  onClick={() => setShowIndicatorSettings(true)}
                >
                  <span className="material-icons">show_chart</span>
                  <span>Indicator Settings</span>
                </button>
                <CoachingPanel />
                <ReportButton />
              </>
            )}
          </div>
        </div>
        <div className="main-content">
          <SymbolTabs />
          <div className="chart-scroll-area">
            <Chart />
          </div>
        </div>
      </div>
    </div>
  );
}
