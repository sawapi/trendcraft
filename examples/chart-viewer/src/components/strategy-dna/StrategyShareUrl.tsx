/**
 * Strategy Share URL - Copy and preview backtest config as URL
 */

interface Props {
  shareUrl: string;
  onCopy: () => void;
  copyFeedback: boolean;
}

export function StrategyShareUrl({ shareUrl, onCopy, copyFeedback }: Props) {
  // Truncate URL for display
  const displayUrl = shareUrl.length > 100 ? `${shareUrl.slice(0, 97)}...` : shareUrl;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: "var(--font-xs)", color: "var(--text-secondary)" }}>
        Share this URL to reproduce the same backtest configuration:
      </div>

      {/* URL preview */}
      <div
        style={{
          padding: "8px 10px",
          background: "var(--bg-primary)",
          borderRadius: 6,
          border: "1px solid var(--border)",
          fontSize: 10,
          color: "var(--text-secondary)",
          wordBreak: "break-all",
          lineHeight: 1.4,
          fontFamily: "monospace",
        }}
      >
        {displayUrl}
      </div>

      {/* Copy button */}
      <button
        type="button"
        onClick={onCopy}
        style={{
          padding: "6px 12px",
          fontSize: "var(--font-sm)",
          background: copyFeedback ? "var(--success)" : "var(--accent-primary)",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          transition: "background 0.2s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <span className="material-icons" style={{ fontSize: 16 }}>
          {copyFeedback ? "check" : "content_copy"}
        </span>
        {copyFeedback ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
