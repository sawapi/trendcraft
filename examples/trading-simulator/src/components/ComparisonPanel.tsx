import { useCallback, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { CollapsiblePanel } from "./CollapsiblePanel";

const SESSION_COLORS = ["#4ade80", "#38bdf8", "#f472b6", "#a78bfa", "#fbbf24", "#fb923c"];

export function ComparisonPanel() {
  const { savedSessions, saveCurrentSession, removeSavedSession, clearSavedSessions, equityCurve } =
    useSimulatorStore();

  const [sessionName, setSessionName] = useState("");

  const handleSave = useCallback(() => {
    const name = sessionName.trim() || `Session ${savedSessions.length + 1}`;
    saveCurrentSession(name);
    setSessionName("");
  }, [sessionName, savedSessions.length, saveCurrentSession]);

  const hasEquityCurve = equityCurve.length > 1;

  return (
    <div className="comparison-panel">
      <CollapsiblePanel title="Strategy Comparison" storageKey="strategy-comparison">
        {/* Save current session */}
        <div className="comparison-save">
          <div className="comparison-save-row">
            <input
              type="text"
              placeholder="Session name"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="comparison-name-input"
            />
            <button
              type="button"
              className="btn-small"
              onClick={handleSave}
              disabled={!hasEquityCurve}
              title={!hasEquityCurve ? "Trade first to save" : "Save current equity curve"}
            >
              Save
            </button>
          </div>
        </div>

        {/* Saved sessions list */}
        {savedSessions.length > 0 && (
          <div className="comparison-list">
            <div className="comparison-list-header">
              <span>Saved ({savedSessions.length})</span>
              <button type="button" className="btn-tiny" onClick={clearSavedSessions}>
                Clear All
              </button>
            </div>
            {savedSessions.map((session, idx) => (
              <div key={session.id} className="comparison-item">
                <span
                  className="comparison-color"
                  style={{ backgroundColor: SESSION_COLORS[idx % SESSION_COLORS.length] }}
                />
                <div className="comparison-info">
                  <span className="comparison-name">{session.name}</span>
                  <span className="comparison-stats">
                    {session.stats.totalPnlPercent >= 0 ? "+" : ""}
                    {session.stats.totalPnlPercent.toFixed(1)}% | WR{" "}
                    {session.stats.winRate.toFixed(0)}% | {session.stats.tradeCount} trades
                  </span>
                </div>
                <button
                  type="button"
                  className="drawing-remove"
                  onClick={() => removeSavedSession(session.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {savedSessions.length === 0 && (
          <p className="comparison-hint">
            Save sessions to compare equity curves across different strategies.
          </p>
        )}
      </CollapsiblePanel>
    </div>
  );
}
