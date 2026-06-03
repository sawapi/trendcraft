import type { DnaGrade, DnaGradeReport, RecommendedParams } from "trendcraft";

const GRADE_COLORS: Record<DnaGrade, string> = {
  A: "#16a34a",
  B: "#65a30d",
  C: "#eab308",
  D: "#ea580c",
  F: "#dc2626",
};

const CONFIDENCE_COLORS: Record<RecommendedParams["confidence"], string> = {
  high: "#16a34a",
  medium: "#eab308",
  low: "#dc2626",
};

type Props = {
  grade: DnaGradeReport;
  recommendedParams: RecommendedParams | null;
};

/**
 * DNA grade report — overall A–F card plus per-dimension item list,
 * followed by a recommended-params summary when grid-search results
 * are available. Studio v1 is display-only (no "Apply to builder"
 * button, no "Compute Monte Carlo" trigger): both callbacks live in
 * the viewer because Studio doesn't yet wire walk-forward / Monte
 * Carlo results into its panel state.
 */
export function RobustnessReport({ grade, recommendedParams }: Props) {
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
          background: "var(--bg-primary, #1a1a1a)",
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
            style={{
              fontSize: "var(--font-md)",
              fontWeight: 600,
              color: "var(--text-primary, #e0e0e0)",
            }}
          >
            Overall Robustness
          </div>
          <div style={{ fontSize: "var(--font-xs)", color: "var(--text-secondary, #888)" }}>
            Score: {grade.overallScore.toFixed(0)}/100
          </div>
        </div>
      </div>

      {/* Per-dimension items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {grade.items.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              background: "var(--bg-primary, #1a1a1a)",
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
                background: item.available ? GRADE_COLORS[item.grade] : "var(--bg-tertiary, #222)",
                color: item.available ? "#fff" : "var(--text-secondary, #888)",
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
                  color: "var(--text-primary, #e0e0e0)",
                  fontWeight: 500,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "var(--text-secondary, #888)",
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

      {/* Recommended params summary */}
      {recommendedParams && Object.keys(recommendedParams.params).length > 0 && (
        <div
          style={{
            marginTop: 4,
            padding: 10,
            background: "var(--bg-primary, #1a1a1a)",
            borderRadius: 8,
            border: "1px solid var(--border, #333)",
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
                color: "var(--text-primary, #e0e0e0)",
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
                  <span
                    style={{
                      color: "var(--text-primary, #e0e0e0)",
                      fontFamily: "monospace",
                    }}
                  >
                    {name}
                  </span>
                  <span style={{ color: "var(--text-secondary, #888)" }}>
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--text-primary, #e0e0e0)",
                      }}
                    >
                      {value}
                    </span>
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

          {recommendedParams.sources.length > 0 && (
            <div
              style={{
                marginTop: 6,
                fontSize: 9,
                color: "var(--text-secondary, #888)",
                lineHeight: 1.4,
              }}
            >
              Based on: {recommendedParams.sources.join(" + ")}
            </div>
          )}
          <div
            style={{
              marginTop: 2,
              fontSize: 9,
              color: "var(--text-secondary, #888)",
              fontStyle: "italic",
            }}
          >
            {recommendedParams.reason}
          </div>
        </div>
      )}
    </div>
  );
}
