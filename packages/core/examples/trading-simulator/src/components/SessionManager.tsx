import { useEffect, useState } from "react";
import { type SessionData, clearSession, loadSession } from "../hooks/useSessionPersistence";

interface SessionManagerProps {
  onRestore: (session: SessionData) => void;
  onDiscard: () => void;
}

export function SessionManager({ onRestore, onDiscard }: SessionManagerProps) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const savedSession = loadSession();
    if (savedSession) {
      setSession(savedSession);
      setShow(true);
    }
  }, []);

  const handleRestore = () => {
    if (session) {
      onRestore(session);
    }
    setShow(false);
  };

  const handleDiscard = () => {
    clearSession();
    onDiscard();
    setShow(false);
  };

  if (!show || !session) return null;

  const savedDate = new Date(session.savedAt);
  const tradeCount = session.tradeHistory.filter((t) => t.type === "SELL").length;

  return (
    <div className="session-manager-overlay">
      <div className="session-manager-modal">
        <h3>Saved session found</h3>

        <div className="session-info">
          <div className="session-row">
            <span className="label">Symbol</span>
            <span className="value">{session.fileName}</span>
          </div>
          <div className="session-row">
            <span className="label">Saved</span>
            <span className="value">
              {savedDate.toLocaleDateString("en-US")} {savedDate.toLocaleTimeString("en-US")}
            </span>
          </div>
          <div className="session-row">
            <span className="label">Trades</span>
            <span className="value">{tradeCount}</span>
          </div>
          <div className="session-row">
            <span className="label">Position</span>
            <span className="value">
              {session.positions.length > 0
                ? `${session.positions.reduce((sum, p) => sum + p.shares, 0)} shares`
                : "None"}
            </span>
          </div>
        </div>

        <p className="session-note">
          Load the same CSV file to restore your session. Choose "Discard" to start fresh with a
          different file.
        </p>

        <div className="session-actions">
          <button type="button" className="btn-primary" onClick={handleRestore}>
            Restore
          </button>
          <button type="button" className="btn-secondary" onClick={handleDiscard}>
            Discard & Start New
          </button>
        </div>
      </div>
    </div>
  );
}
