import { Sparkline } from "@trendcraft/chart/react/sparkline";
import { useEffect, useRef, useState } from "react";
import type { ScoreResult, ScoringPreset } from "trendcraft";
import type { StudioCandle } from "../lib/sample-data";
import { SCORING_PRESETS, type ScoringComputation, runScoring } from "../lib/scoring";

type Props = {
  /** Playhead-aware candle slice from App. */
  candles: StudioCandle[];
  /** Replay playing → freeze recompute (score series is O(N candles × N signals)). */
  isReplayPlaying: boolean;
};

const STRENGTH_COLOR: Record<ScoreResult["strength"], string> = {
  strong: "#26a69a",
  moderate: "#90c980",
  weak: "#e9b770",
  none: "#787b86",
};

export function ScoringPanel({ candles, isReplayPlaying }: Props) {
  const [presetName, setPresetName] = useState<ScoringPreset>("balanced");
  const [computation, setComputation] = useState<ScoringComputation>({
    kind: "empty",
    message: "Computing…",
  });

  // The replay-playing freeze exists to skip the heavy series recompute
  // (~125 ticks/sec at Max speed). It must NOT skip user-initiated preset
  // changes — those are single rare clicks that should always reflect on
  // screen, otherwise the highlighted tab disagrees with the displayed
  // numbers. Distinguish "candles tick" from "preset click" via refs.
  const prevPresetRef = useRef(presetName);
  const prevCandlesLenRef = useRef(candles.length);
  // biome-ignore lint/correctness/useExhaustiveDependencies: we deliberately key on candles.length not the array reference.
  useEffect(() => {
    const presetChanged = prevPresetRef.current !== presetName;
    const candlesChanged = prevCandlesLenRef.current !== candles.length;
    prevPresetRef.current = presetName;
    prevCandlesLenRef.current = candles.length;
    // Only the candle-tick path is freezable. A preset click always wins.
    if (!presetChanged && candlesChanged && isReplayPlaying) return;
    setComputation(runScoring(candles, presetName));
  }, [candles.length, presetName, isReplayPlaying]);

  return (
    <div className="risk-panel">
      <div className="pane-header">Scoring</div>
      <section className="risk-section">
        <div className="risk-tabs">
          {SCORING_PRESETS.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`risk-tab${presetName === p.id ? " active" : ""}`}
              onClick={() => setPresetName(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <ScoringBody computation={computation} />
        {isReplayPlaying && (
          <div className="meta-strategy-caption">Frozen during replay playback.</div>
        )}
      </section>
    </div>
  );
}

function ScoringBody({ computation }: { computation: ScoringComputation }) {
  if (computation.kind === "empty") {
    return <div className="meta-strategy-caption">{computation.message}</div>;
  }
  if (computation.kind === "error") {
    return <div className="risk-error">{computation.message}</div>;
  }
  const { series, breakdown } = computation;
  const sparkData = series.map((s) => s.score.normalizedScore);
  const color = STRENGTH_COLOR[breakdown.strength];

  return (
    <>
      <div className="scoring-spark-wrap">
        <Sparkline
          type="line"
          data={sparkData}
          width={328}
          height={36}
          color={{ fixed: color }}
          baseline={breakdown.normalizedScore}
          fill
        />
      </div>
      <div className={`scoring-strength scoring-strength-${breakdown.strength}`}>
        <span className="scoring-tier">{breakdown.strength.toUpperCase()}</span>
        <span className="scoring-value">{breakdown.normalizedScore.toFixed(0)} / 100</span>
        <span className="scoring-active">
          {breakdown.activeSignals} of {breakdown.totalSignals} signals active
        </span>
      </div>
      <table className="scoring-table">
        <thead>
          <tr>
            <th>Signal</th>
            <th className="num">Weight</th>
            <th className="num">Value</th>
            <th className="num">Score</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.contributions.map((c) => (
            <tr key={c.name} className={c.isActive ? "scoring-active-row" : "scoring-inactive-row"}>
              <td>{c.displayName}</td>
              <td className="num">{c.weight.toFixed(1)}</td>
              <td className="num">{c.rawValue.toFixed(2)}</td>
              <td className="num">{c.score.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
