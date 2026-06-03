import { useEffect, useMemo, useState } from "react";
import {
  type BacktestResult,
  buildGenomeSegments,
  computeDnaGrade,
  computeRecommendedParams,
  extractSensitivityData,
} from "trendcraft";
import type { OptimizationComputation, WalkForwardComputation } from "../lib/optimization";
import {
  computeDeflatedSharpe,
  DEFAULT_MC_ITERATIONS,
  type MonteCarloComputation,
  runMonteCarlo,
} from "../lib/robustness";
import { DeflatedSharpeReport } from "./dna/DeflatedSharpeReport";
import { GenomeVisualization } from "./dna/GenomeVisualization";
import { MonteCarloReport } from "./dna/MonteCarloReport";
import { RobustnessReport } from "./dna/RobustnessReport";
import { SensitivityHeatmap } from "./dna/SensitivityHeatmap";
import { WalkForwardReport } from "./dna/WalkForwardReport";

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
  /**
   * Walk-forward computation from the sibling OptimizationPanel. Feeds
   * the "Walk-Forward Stability" dimensions of the grade and the
   * per-window report. Stays `idle` until the user runs walk-forward.
   */
  walkForwardResult: WalkForwardComputation;
  /**
   * Last backtest result, used as the Monte Carlo resampling input.
   * `undefined` until the user runs a backtest; the MC section then
   * renders its own "run a backtest first" empty state.
   */
  lastBacktest: BacktestResult | undefined;
};

/**
 * Strategy DNA panel — three-tab visualization of an optimization
 * run's genome, parameter sensitivity, and robustness grade. The
 * Genome and Sensitivity tabs are display-only (builder state is never
 * mutated from this panel, matching PR12's OptimizationPanel
 * philosophy). The Robustness tab adds a run-on-demand Monte Carlo
 * simulation over the last backtest (lighting up the "Monte Carlo
 * Significance" dimension) and surfaces the walk-forward result run from
 * the sibling Optimization panel (lighting up the "Walk-Forward
 * Stability" dimensions and rendering the per-window report).
 */
export function StrategyDnaPanel({ optimizationResult, walkForwardResult, lastBacktest }: Props) {
  const gridSearchResult = optimizationResult.kind === "ok" ? optimizationResult.result : null;
  const walkForward = walkForwardResult.kind === "ok" ? walkForwardResult.result : null;

  const [activeTab, setActiveTab] = useState<DnaTab>("genome");
  const [selectedParam, setSelectedParam] = useState<string | null>(null);
  const [selectedParamPair, setSelectedParamPair] = useState<[string, string] | null>(null);

  // Monte Carlo runs on demand (expensive + stochastic), so its result
  // is button-triggered state rather than a derived useMemo. Iteration
  // count is user-selectable; the result carries the count it was run
  // with so a stale display can't mislabel itself.
  const [mcIterations, setMcIterations] = useState<number>(DEFAULT_MC_ITERATIONS);
  const [mcComputation, setMcComputation] = useState<MonteCarloComputation>({ kind: "idle" });

  // A new backtest invalidates any prior Monte Carlo result — it was
  // resampled from a different trade set. Key on the result object
  // reference: the runner produces a fresh `BacktestResult` on every
  // run, so the effect fires exactly when the underlying trades change.
  // A scalar proxy (trade count + total return) would collide when a
  // modified strategy happens to produce the same aggregate, leaving a
  // stale MC verdict and DNA grade on screen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastBacktest is the intended change trigger, not read inside the effect — clearing MC on each new result object is the point.
  useEffect(() => {
    setMcComputation({ kind: "idle" });
  }, [lastBacktest]);

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
    return computeRecommendedParams(gridSearchResult, walkForward, sensitivityData);
  }, [gridSearchResult, walkForward, sensitivityData]);

  const monteCarloResult = mcComputation.kind === "ok" ? mcComputation.result : null;

  // Feed the walk-forward and Monte Carlo results into the grade so the
  // "Walk-Forward Stability" and "Monte Carlo Significance" dimensions
  // light up (and the overall grade reweights) as soon as the user runs
  // each. Both stay `null` until their respective workflow runs.
  const dnaGrade = useMemo(() => {
    return computeDnaGrade(gridSearchResult, walkForward, monteCarloResult);
  }, [gridSearchResult, walkForward, monteCarloResult]);

  // Deflated Sharpe corrects the chosen strategy's Sharpe for having
  // selected the best of N grid combinations. It needs the full grid
  // (the trial set), so it stays null on a walk-forward-only run.
  const deflatedSharpe = useMemo(() => {
    if (!gridSearchResult) return null;
    return computeDeflatedSharpe(gridSearchResult);
  }, [gridSearchResult]);

  // Genome and Sensitivity are grid-only views; the Robustness tab also
  // lights up from a standalone walk-forward run (its grade and the
  // per-window report don't need a grid result). So the panel is
  // reachable whenever *either* workflow has data — gating it on the
  // grid alone would strand a walk-forward run the user was just told to
  // open here.
  const hasGrid = gridSearchResult !== null;
  const hasWalkForward = walkForward !== null;

  if (!hasGrid && !hasWalkForward) {
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

  // Genome/Sensitivity need a grid result; when only walk-forward has
  // run, force the Robustness tab (where the WF report lives) so the
  // user lands on the data they just computed instead of an empty
  // grid-only tab.
  const effectiveTab: DnaTab = hasGrid ? activeTab : "robustness";

  return (
    <div className="risk-panel">
      <div className="pane-header">Strategy DNA</div>
      <section className="risk-section">
        <div style={{ display: "flex", gap: 0, marginBottom: 8 }}>
          {TABS.map((tab, idx) => {
            // Genome/Sensitivity are meaningless without a grid result, so
            // disable them when only walk-forward has run.
            const tabDisabled = !hasGrid && tab.key !== "robustness";
            return (
              <button
                key={tab.key}
                type="button"
                disabled={tabDisabled}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  padding: "5px 4px",
                  fontSize: 10,
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: "var(--border, #333)",
                  background:
                    effectiveTab === tab.key
                      ? "var(--accent, #4a9eff)"
                      : "var(--bg-tertiary, #222)",
                  color: effectiveTab === tab.key ? "#fff" : "var(--text-secondary, #888)",
                  cursor: tabDisabled ? "not-allowed" : "pointer",
                  opacity: tabDisabled ? 0.4 : 1,
                  borderRadius:
                    idx === 0 ? "4px 0 0 4px" : idx === TABS.length - 1 ? "0 4px 4px 0" : "0",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {effectiveTab === "genome" &&
          (genomeSegments && genomeSegments.length > 0 ? (
            <>
              <div className="meta-strategy-caption" style={{ marginBottom: 6 }}>
                Each block is a tunable parameter at its best value. Color shows where that value
                sits in the search range — hover for details, click to inspect sensitivity.
              </div>
              <GenomeVisualization
                segments={genomeSegments}
                onSegmentClick={(name) => {
                  setSelectedParam(name);
                  setSelectedParamPair(null);
                  setActiveTab("sensitivity");
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 6,
                  fontSize: 10,
                  color: "#787b86",
                }}
              >
                <span>Range</span>
                <span
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    background: "linear-gradient(90deg, rgb(60,120,220), rgb(230,40,40))",
                  }}
                />
                <span>low → high</span>
              </div>
            </>
          ) : (
            <div className="meta-strategy-caption">No tunable parameters in this grid search.</div>
          ))}

        {effectiveTab === "sensitivity" &&
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

        {effectiveTab === "robustness" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <RobustnessReport grade={dnaGrade} recommendedParams={recommendedParams} />
            {deflatedSharpe && (
              <>
                <div className="meta-strategy-caption" style={{ fontWeight: 600, marginTop: 2 }}>
                  Deflated Sharpe
                </div>
                <DeflatedSharpeReport computation={deflatedSharpe} />
              </>
            )}
            <div className="meta-strategy-caption" style={{ fontWeight: 600, marginTop: 2 }}>
              Walk-Forward
            </div>
            <WalkForwardReport computation={walkForwardResult} />
            <div className="meta-strategy-caption" style={{ fontWeight: 600, marginTop: 2 }}>
              Monte Carlo
            </div>
            <MonteCarloReport
              computation={mcComputation}
              iterations={mcIterations}
              onIterationsChange={setMcIterations}
              onRun={() =>
                setMcComputation(runMonteCarlo(lastBacktest, { iterations: mcIterations }))
              }
              disabled={!lastBacktest || lastBacktest.trades.length < 2}
              disabledReason={
                !lastBacktest
                  ? "Run a backtest first to enable Monte Carlo."
                  : lastBacktest.trades.length < 2
                    ? "Need at least 2 trades for Monte Carlo simulation."
                    : undefined
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}
