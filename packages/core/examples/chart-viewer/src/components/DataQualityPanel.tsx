/**
 * Data Quality Validation Panel
 * Collapsible panel showing validation results grouped by severity
 */

import { useState } from "react";
import type { ValidationFinding, ValidationResult } from "trendcraft";

/**
 * Format a timestamp as YYYY/MM/DD
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

/** Color constants for severity levels (using CSS variables for theme support) */
const SEVERITY_COLORS = {
  error: {
    bg: "var(--severity-error-bg)",
    text: "var(--severity-error-text)",
    badge: "var(--severity-error-badge)",
  },
  warning: {
    bg: "var(--severity-warning-bg)",
    text: "var(--severity-warning-text)",
    badge: "var(--severity-warning-badge)",
  },
  info: {
    bg: "var(--severity-info-bg)",
    text: "var(--severity-info-text)",
    badge: "var(--severity-info-badge)",
  },
} as const;

/** Category label mapping */
const CATEGORY_LABELS: Record<string, string> = {
  gap: "Gap",
  duplicate: "Duplicate",
  ohlc: "OHLC",
  spike: "Spike",
  volume: "Volume",
  stale: "Stale",
  split: "Split",
};

interface DataQualityPanelProps {
  result: ValidationResult;
}

/**
 * Severity badge with icon and count
 */
function SeverityBadge({
  severity,
  count,
}: {
  severity: "error" | "warning" | "info";
  count: number;
}) {
  if (count === 0) return null;
  const colors = SEVERITY_COLORS[severity];
  const icons = { error: "error", warning: "warning", info: "info" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 12,
        backgroundColor: colors.bg,
        color: colors.text,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span className="material-icons" style={{ fontSize: 14 }}>
        {icons[severity]}
      </span>
      {count}
    </span>
  );
}

/**
 * Single finding row
 */
function FindingRow({ finding }: { finding: ValidationFinding }) {
  const colors = SEVERITY_COLORS[finding.severity];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 8px",
        fontSize: 12,
        color: "var(--dq-text)",
        borderBottom: "1px solid var(--dq-border)",
      }}
    >
      <span
        style={{
          padding: "1px 6px",
          borderRadius: 4,
          backgroundColor: colors.bg,
          color: colors.text,
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {CATEGORY_LABELS[finding.category] || finding.category}
      </span>
      <span style={{ flex: 1 }}>{finding.message}</span>
      {finding.time != null && (
        <span style={{ color: "var(--dq-muted)", whiteSpace: "nowrap", fontSize: 11 }}>
          {formatDate(finding.time)}
        </span>
      )}
    </div>
  );
}

/**
 * Collapsible severity section
 */
function SeveritySection({
  severity,
  findings,
}: {
  severity: "error" | "warning" | "info";
  findings: ValidationFinding[];
}) {
  const [open, setOpen] = useState(severity === "error");
  if (findings.length === 0) return null;
  const colors = SEVERITY_COLORS[severity];
  const label = severity.charAt(0).toUpperCase() + severity.slice(1);

  return (
    <div style={{ marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "4px 8px",
          border: "none",
          background: "none",
          color: colors.text,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span className="material-icons" style={{ fontSize: 14 }}>
          {open ? "expand_more" : "chevron_right"}
        </span>
        {label}s ({findings.length})
      </button>
      {open && (
        <div style={{ marginLeft: 8 }}>
          {findings.map((f, i) => (
            <FindingRow key={`${f.category}-${f.index ?? i}`} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Data Quality Panel
 * Shows validation findings in a collapsible bar between the indicator bar and chart
 */
export function DataQualityPanel({ result }: DataQualityPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = result.errors.length > 0 || result.warnings.length > 0;

  return (
    <div
      style={{
        backgroundColor: "var(--dq-bg)",
        borderBottom: "1px solid var(--dq-border)",
        color: "var(--dq-text)",
      }}
    >
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "6px 12px",
          border: "none",
          background: "none",
          color: "var(--dq-text)",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        <span className="material-icons" style={{ fontSize: 16 }}>
          {expanded ? "expand_more" : "chevron_right"}
        </span>
        <span className="material-icons" style={{ fontSize: 16 }}>
          verified
        </span>
        <span style={{ fontWeight: 600 }}>Data Quality</span>

        {hasIssues ? (
          <span style={{ display: "flex", gap: 6, marginLeft: 4 }}>
            <SeverityBadge severity="error" count={result.errors.length} />
            <SeverityBadge severity="warning" count={result.warnings.length} />
            <SeverityBadge severity="info" count={result.info.length} />
          </span>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 12,
              backgroundColor: "var(--dq-ok-bg)",
              color: "var(--dq-ok-text)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>
              check_circle
            </span>
            Data OK
          </span>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{
            padding: "0 12px 8px",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {!hasIssues && result.info.length === 0 ? (
            <div style={{ padding: "8px 0", fontSize: 12, color: "var(--dq-muted)" }}>
              No issues found. All candle data looks valid.
            </div>
          ) : (
            <>
              <SeveritySection severity="error" findings={result.errors} />
              <SeveritySection severity="warning" findings={result.warnings} />
              <SeveritySection severity="info" findings={result.info} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
