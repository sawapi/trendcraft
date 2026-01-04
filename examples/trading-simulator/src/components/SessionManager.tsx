import { useState, useEffect } from "react";
import { loadSession, clearSession, type SessionData } from "../hooks/useSessionPersistence";

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
        <h3>保存されたセッションが見つかりました</h3>

        <div className="session-info">
          <div className="session-row">
            <span className="label">銘柄</span>
            <span className="value">{session.fileName}</span>
          </div>
          <div className="session-row">
            <span className="label">保存日時</span>
            <span className="value">
              {savedDate.toLocaleDateString("ja-JP")} {savedDate.toLocaleTimeString("ja-JP")}
            </span>
          </div>
          <div className="session-row">
            <span className="label">取引回数</span>
            <span className="value">{tradeCount}回</span>
          </div>
          <div className="session-row">
            <span className="label">ポジション</span>
            <span className="value">
              {session.positions.length > 0
                ? `${session.positions.reduce((sum, p) => sum + p.shares, 0)}株保有中`
                : "なし"}
            </span>
          </div>
        </div>

        <p className="session-note">
          同じCSVファイルを読み込んでセッションを復元できます。
          別のファイルを使用する場合は「破棄」を選択してください。
        </p>

        <div className="session-actions">
          <button className="btn-primary" onClick={handleRestore}>
            復元する
          </button>
          <button className="btn-secondary" onClick={handleDiscard}>
            破棄して新規開始
          </button>
        </div>
      </div>
    </div>
  );
}
