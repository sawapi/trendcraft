/**
 * Strategy DNA Panel - Main panel with 4-tab layout
 */

import { useCallback } from "react";
import { type DnaTab, useStrategyDna } from "../../hooks/useStrategyDna";
import { useChartStore } from "../../store/chartStore";
import { GenomeVisualization } from "./GenomeVisualization";
import { RobustnessReport } from "./RobustnessReport";
import { SensitivityHeatmap } from "./SensitivityHeatmap";
import { StrategyShareUrl } from "./StrategyShareUrl";

const TABS: { key: DnaTab; label: string }[] = [
  { key: "genome", label: "Genome" },
  { key: "sensitivity", label: "Sensitivity" },
  { key: "robustness", label: "Robustness" },
  { key: "share", label: "Share" },
];

export function StrategyDnaPanel() {
  const dna = useStrategyDna();
  const setPendingRecommendedParams = useChartStore((s) => s.setPendingRecommendedParams);

  const handleApplyParams = useCallback(
    (params: Record<string, number>) => {
      setPendingRecommendedParams(params);
    },
    [setPendingRecommendedParams],
  );

  return (
    <div style={panelStyle}>
      <details>
        <summary style={headerStyle}>Strategy DNA</summary>

        <div style={{ marginTop: 8 }}>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 0, marginBottom: 8 }}>
            {TABS.map((tab, idx) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => dna.setActiveTab(tab.key)}
                style={{
                  ...tabBtnStyle,
                  ...(dna.activeTab === tab.key ? tabActiveStyle : {}),
                  borderRadius:
                    idx === 0 ? "4px 0 0 4px" : idx === TABS.length - 1 ? "0 4px 4px 0" : "0",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {dna.activeTab === "genome" && (
            <div>
              {dna.genomeSegments ? (
                <GenomeVisualization
                  segments={dna.genomeSegments}
                  onSegmentClick={(name) => {
                    dna.setSelectedParam(name);
                    dna.setActiveTab("sensitivity");
                  }}
                />
              ) : (
                <Placeholder text="Run Grid Search to visualize strategy genome" />
              )}
            </div>
          )}

          {dna.activeTab === "sensitivity" && (
            <div>
              {dna.sensitivityData ? (
                <SensitivityHeatmap
                  data={dna.sensitivityData}
                  selectedParam={dna.selectedParam}
                  selectedParamPair={dna.selectedParamPair}
                  onSelectParam={dna.setSelectedParam}
                  onSelectParamPair={dna.setSelectedParamPair}
                />
              ) : (
                <Placeholder text="Run Grid Search to analyze parameter sensitivity" />
              )}
            </div>
          )}

          {dna.activeTab === "robustness" && (
            <RobustnessReport
              grade={dna.robustnessGrade}
              isComputing={dna.isComputingGrade}
              canCompute={dna.hasBacktest}
              onCompute={dna.computeGrade}
              recommendedParams={dna.recommendedParams}
              onApplyParams={handleApplyParams}
            />
          )}

          {dna.activeTab === "share" && (
            <StrategyShareUrl
              shareUrl={dna.shareUrl}
              onCopy={dna.copyShareUrl}
              copyFeedback={dna.copyFeedback}
            />
          )}
        </div>
      </details>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: 20,
        color: "var(--text-secondary)",
        fontSize: "var(--font-xs)",
      }}
    >
      {text}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  padding: "var(--spacing-md)",
  borderTop: "1px solid var(--border)",
};

const headerStyle: React.CSSProperties = {
  fontSize: "var(--font-md)",
  fontWeight: 600,
  color: "var(--text-primary)",
  cursor: "pointer",
  userSelect: "none",
  padding: "var(--spacing-xs) 0",
};

const tabBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "5px 4px",
  fontSize: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--border)",
  background: "var(--bg-tertiary)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  transition: "all 0.15s",
};

const tabActiveStyle: React.CSSProperties = {
  background: "var(--accent-primary)",
  color: "var(--text-primary)",
  borderColor: "var(--accent-primary)",
};
