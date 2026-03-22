/**
 * Robustness Report - Grade card with A-F scores for strategy robustness
 */

import type { Grade, RecommendedParams, RobustnessGrade } from "../../utils/strategyDna";

const GRADE_COLORS: Record<Grade, string> = {
  A: "#16a34a",
  B: "#65a30d",
  C: "#eab308",
  D: "#ea580c",
  F: "#dc2626",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#16a34a",
  medium: "#eab308",
  low: "#dc2626",
};

interface Props {
  grade: RobustnessGrade;
  isComputing: boolean;
  canCompute: boolean;
  onCompute: () => void;
  recommendedParams: RecommendedParams | null;
  onApplyParams?: (params: Record<string, number>) => void;
}

export function RobustnessReport({
  grade,
  isComputing,
  canCompute,
  onCompute,
  recommendedParams,
  onApplyParams,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Overall grade */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 12,
          background: "var(--bg-primary)",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: GRADE_COLORS[grade.overall],
            color: "#fff",
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          {grade.overall}
        </div>
        <div>
          <div
            style={{ fontSize: "var(--font-md)", fontWeight: 600, color: "var(--text-primary)" }}
          >
            Overall Robustness
          </div>
          <div style={{ fontSize: "var(--font-xs)", color: "var(--text-secondary)" }}>
            Score: {grade.overallScore.toFixed(0)}/100
          </div>
        </div>
      </div>

      {/* Individual grades */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {grade.items.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              background: "var(--bg-primary)",
              borderRadius: 6,
              opacity: item.available ? 1 : 0.5,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: item.available ? GRADE_COLORS[item.grade] : "var(--bg-tertiary)",
                color: item.available ? "#fff" : "var(--text-secondary)",
                fontSize: "var(--font-base)",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {item.available ? item.grade : "—"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "var(--font-sm)",
                  color: "var(--text-primary)",
                  fontWeight: 500,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Compute button for Monte Carlo */}
      <button
        type="button"
        onClick={onCompute}
        disabled={!canCompute || isComputing}
        style={{
          padding: "6px 12px",
          fontSize: "var(--font-sm)",
          background: canCompute ? "var(--accent-secondary)" : "var(--bg-tertiary)",
          color: canCompute ? "#fff" : "var(--text-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          cursor: canCompute ? "pointer" : "not-allowed",
        }}
      >
        {isComputing ? "Computing..." : "Compute Monte Carlo Grade"}
      </button>

      {/* Recommended Parameters */}
      {recommendedParams && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            background: "var(--bg-primary)",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: "var(--font-sm)",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Recommended Parameters
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
                background: CONFIDENCE_COLORS[recommendedParams.confidence],
                color: "#fff",
                textTransform: "capitalize",
              }}
            >
              {recommendedParams.confidence}
            </span>
          </div>

          {/* Parameter list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Object.entries(recommendedParams.params).map(([name, value]) => {
              const range = recommendedParams.ranges[name];
              return (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    fontSize: "var(--font-xs)",
                  }}
                >
                  <span style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>
                    {name}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
                    {range && (
                      <span style={{ marginLeft: 4 }}>
                        ({range.min}–{range.max})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Source description */}
          <div
            style={{
              marginTop: 6,
              fontSize: 9,
              color: "var(--text-secondary)",
              lineHeight: 1.4,
            }}
          >
            Based on: {recommendedParams.sources.join(" + ")}
          </div>

          {/* Reason */}
          <div
            style={{
              marginTop: 2,
              fontSize: 9,
              color: "var(--text-secondary)",
              fontStyle: "italic",
            }}
          >
            {recommendedParams.reason}
          </div>

          {/* Apply button */}
          {onApplyParams && (
            <button
              type="button"
              onClick={() => onApplyParams(recommendedParams.params)}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "5px 10px",
                fontSize: "var(--font-xs)",
                background: "var(--accent-primary)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Apply to Grid Search Config
            </button>
          )}
        </div>
      )}
    </div>
  );
}
