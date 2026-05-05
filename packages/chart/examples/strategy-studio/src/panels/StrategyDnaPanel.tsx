import { useEffect, useMemo, useState } from "react";
import {
  buildGenomeSegments,
  computeDnaGrade,
  computeRecommendedParams,
  extractSensitivityData,
} from "trendcraft";
import type { OptimizationComputation } from "../lib/optimization";
import { GenomeVisualization } from "./dna/GenomeVisualization";
import { RobustnessReport } from "./dna/RobustnessReport";
import { SensitivityHeatmap } from "./dna/SensitivityHeatmap";

type DnaTab = "genome" | "sensitivity" | "robustness";

const TABS: { key: DnaTab; label: string }[] = [
  { key: "genome", label: "Genome" },
  { key: "sensitivity", label: "Sensitivity" },
  { key: "robustness", label: "Robustness" },
];

type Props = {
  /**
   * Full optimization state from the sibling OptimizationPanel. Mirrored
   * from `OptimizationComputation` so non-success states (`empty`,
   * `error`) surface their own message instead of collapsing to "Run a
   * grid search..." — that fallback would hide the fact that a run
   * actually completed but produced no usable result.
   */
  optimizationResult: OptimizationComputation;
};

/**
 * Strategy DNA panel — three-tab read-only visualization of an
 * optimization run's genome, parameter sensitivity, and robustness
 * grade. Display-only by design (no Apply button, no Compute Monte
 * Carlo trigger): builder state is never mutated from this panel,
 * matching PR12's OptimizationPanel philosophy. Walk-Forward and
 * Monte Carlo dimensions on the grade card surface as
 * `available: false` until Studio adds those workflows.
 */
export function StrategyDnaPanel({ optimizationResult }: Props) {
  const gridSearchResult = optimizationResult.kind === "ok" ? optimizationResult.result : null;

  const [activeTab, setActiveTab] = useState<DnaTab>("genome");
  const [selectedParam, setSelectedParam] = useState<string | null>(null);
  const [selectedParamPair, setSelectedParamPair] = useState<[string, string] | null>(null);

  // Reset sensitivity selections when the grid result changes.
  // Otherwise a second run with a different tunable set would leave
  // selectedParam pointing at a name that no longer exists, and the
  // Sensitivity tab would render blank (selector active but no body
  // matches) until the user manually clicks another chip.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the result reference identity, which the parent invalidates whenever the run inputs change.
  useEffect(() => {
    setSelectedParam(null);
    setSelectedParamPair(null);
  }, [gridSearchResult]);

  // Recompute analytics whenever the grid result changes. All four
  // calls are pure data transforms; total cost is O(N · M) over
  // results × params (~ms for typical 100-row grids).
  const genomeSegments = useMemo(() => {
    if (!gridSearchResult || gridSearchResult.bestParams === null) return null;
    if (gridSearchResult.results.length === 0) return null;
    // Derive ranges from the explored grid so the genome's [0, 1]
    // axis matches the search space the user actually saw, not the
    // nominal `paramRanges` they configured up front.
    const paramNames = Object.keys(gridSearchResult.bestParams);
    const paramRanges = paramNames.map((name) => {
      const values = gridSearchResult.results.map((r) => r.params[name]);
      return { name, min: Math.min(...values), max: Math.max(...values) };
    });
    return buildGenomeSegments(
      gridSearchResult.bestParams,
      paramRanges,
      gridSearchResult.bestScore ?? 0,
    );
  }, [gridSearchResult]);

  const sensitivityData = useMemo(() => {
    if (!gridSearchResult) return null;
    // Pass the full result set: pairwise aggregation is O(N · pairs)
    // which on a 10,000-row, 10-param run is ~600k Map ops (~60ms on
    // modern hardware). Capping to a top-N subset would bias the
    // per-value histograms toward high scorers, hide values that
    // never won, and break sensitivity-peak detection in
    // `computeRecommendedParams` because dropped neighbors would no
    // longer reveal a sharp drop.
    return extractSensitivityData(gridSearchResult.results, gridSearchResult.metric);
  }, [gridSearchResult]);

  const recommendedParams = useMemo(() => {
    if (!gridSearchResult) return null;
    return computeRecommendedParams(gridSearchResult, null, sensitivityData);
  }, [gridSearchResult, sensitivityData]);

  const dnaGrade = useMemo(() => {
    return computeDnaGrade(gridSearchResult, null, null);
  }, [gridSearchResult]);

  if (gridSearchResult === null) {
    // Distinguish the three non-`ok` states. For `idle` (no run yet)
    // we deliberately don't tell the user "Run a grid search" — the
    // sibling Optimization panel may be unable to run (no strategy,
    // no tunable params, etc.) and surfaces its own actionable
    // reason. Pointing users at an action they can't perform from
    // here would just be noise.
    const message =
      optimizationResult.kind === "empty"
        ? optimizationResult.message
        : optimizationResult.kind === "error"
          ? `Optimization error: ${optimizationResult.message}`
          : "No optimization data yet — see the Optimization panel above.";
    return (
      <div className="risk-panel">
        <div className="pane-header">Strategy DNA</div>
        <section className="risk-section">
          <div className="meta-strategy-caption">{message}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="risk-panel">
      <div className="pane-header">Strategy DNA</div>
      <section className="risk-section">
        <div style={{ display: "flex", gap: 0, marginBottom: 8 }}>
          {TABS.map((tab, idx) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: "5px 4px",
                fontSize: 10,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--border, #333)",
                background:
                  activeTab === tab.key ? "var(--accent, #4a9eff)" : "var(--bg-tertiary, #222)",
                color: activeTab === tab.key ? "#fff" : "var(--text-secondary, #888)",
                cursor: "pointer",
                borderRadius:
                  idx === 0 ? "4px 0 0 4px" : idx === TABS.length - 1 ? "0 4px 4px 0" : "0",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "genome" &&
          (genomeSegments && genomeSegments.length > 0 ? (
            <GenomeVisualization
              segments={genomeSegments}
              onSegmentClick={(name) => {
                setSelectedParam(name);
                setSelectedParamPair(null);
                setActiveTab("sensitivity");
              }}
            />
          ) : (
            <div className="meta-strategy-caption">No tunable parameters in this grid search.</div>
          ))}

        {activeTab === "sensitivity" &&
          (sensitivityData && sensitivityData.singleParams.length > 0 ? (
            <SensitivityHeatmap
              data={sensitivityData}
              selectedParam={selectedParam}
              selectedParamPair={selectedParamPair}
              onSelectParam={setSelectedParam}
              onSelectParamPair={setSelectedParamPair}
            />
          ) : (
            <div className="meta-strategy-caption">
              No sensitivity data — grid search produced no results.
            </div>
          ))}

        {activeTab === "robustness" && (
          <RobustnessReport grade={dnaGrade} recommendedParams={recommendedParams} />
        )}
      </section>
    </div>
  );
}
