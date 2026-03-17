/**
 * Pattern Replay Panel
 *
 * Bottom panel that controls pattern replay animation,
 * shows projection stats, and lists past instances.
 */

import { useMemo } from "react";
import type { PatternProjection, PatternSignal } from "trendcraft";
import { projectFromPatterns } from "trendcraft";
import { usePatternReplay } from "../hooks/usePatternReplay";
import { useSignals } from "../hooks/useSignals";
import { useChartStore } from "../store/chartStore";

/** Pattern display names */
const PATTERN_DISPLAY_NAMES: Record<string, string> = {
  double_top: "Double Top",
  double_bottom: "Double Bottom",
  head_shoulders: "Head & Shoulders",
  inverse_head_shoulders: "Inv H&S",
  cup_handle: "Cup & Handle",
  triangle_symmetrical: "Sym Triangle",
  triangle_ascending: "Asc Triangle",
  triangle_descending: "Desc Triangle",
  rising_wedge: "Rising Wedge",
  falling_wedge: "Falling Wedge",
  channel_ascending: "Asc Channel",
  channel_descending: "Desc Channel",
  channel_horizontal: "Horiz Channel",
  bull_flag: "Bull Flag",
  bear_flag: "Bear Flag",
  bull_pennant: "Bull Pennant",
  bear_pennant: "Bear Pennant",
};

const BEARISH_PATTERNS = new Set(["double_top", "head_shoulders"]);

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Calculate the actual return after a pattern for past instance display
 */
function getPatternReturn(
  pattern: PatternSignal,
  candles: { time: number; close: number }[],
  horizon = 20,
): number | null {
  const timeToIdx = new Map<number, number>();
  candles.forEach((c, i) => timeToIdx.set(c.time, i));

  const endIdx = timeToIdx.get(pattern.pattern.endTime);
  if (endIdx === undefined) return null;

  const basePrice = candles[endIdx].close;
  if (basePrice === 0) return null;

  const targetIdx = Math.min(endIdx + horizon, candles.length - 1);
  if (targetIdx <= endIdx) return null;

  const ret = ((candles[targetIdx].close - basePrice) / basePrice) * 100;
  const sign = BEARISH_PATTERNS.has(pattern.type) ? -1 : 1;
  return Math.round(ret * sign * 100) / 100;
}

export function PatternReplayPanel() {
  const currentCandles = useChartStore((s) => s.currentCandles);
  const replayPattern = useChartStore((s) => s.replayPattern);
  const setReplayPattern = useChartStore((s) => s.setReplayPattern);
  const setZoomRange = useChartStore((s) => s.setZoomRange);
  const enabledSignals = useChartStore((s) => s.enabledSignals);
  const indicatorParams = useChartStore((s) => s.indicatorParams);

  const signals = useSignals(currentCandles, enabledSignals, indicatorParams);

  const replay = usePatternReplay(replayPattern, currentCandles);

  // Compute projection for the same pattern type
  const projection: PatternProjection | null = useMemo(() => {
    if (!replayPattern || !signals.chartPatterns) return null;
    const sameType = signals.chartPatterns.filter((p) => p.type === replayPattern.type);
    if (sameType.length === 0) return null;
    return projectFromPatterns(currentCandles, sameType, { horizon: 20 });
  }, [replayPattern, signals.chartPatterns, currentCandles]);

  // Past instances of the same pattern type
  const pastInstances = useMemo(() => {
    if (!replayPattern || !signals.chartPatterns) return [];
    return signals.chartPatterns
      .filter((p) => p.type === replayPattern.type)
      .sort((a, b) => b.time - a.time)
      .map((p) => ({
        pattern: p,
        date: formatDate(p.time),
        confidence: Math.round(p.confidence),
        result: getPatternReturn(p, currentCandles),
        isCurrent: p.time === replayPattern.time,
      }));
  }, [replayPattern, signals.chartPatterns, currentCandles]);

  if (!replayPattern) return null;

  const patternName = PATTERN_DISPLAY_NAMES[replayPattern.type] ?? replayPattern.type;
  const confStr = Math.round(replayPattern.confidence);
  const progress = replay.maxIndex > replay.startIndex ? replay.replayIndex - replay.startIndex : 0;
  const total = replay.maxIndex - replay.startIndex;

  const handleClose = () => {
    setReplayPattern(null);
  };

  const handleJumpToPattern = (pattern: PatternSignal) => {
    // Set zoom range to center on pattern
    const totalCandles = currentCandles.length;
    if (totalCandles === 0) return;

    const timeToIdx = new Map<number, number>();
    currentCandles.forEach((c, i) => timeToIdx.set(c.time, i));
    const idx = timeToIdx.get(pattern.pattern.startTime) ?? 0;

    const margin = 30;
    const startPct = Math.max(0, ((idx - margin) / totalCandles) * 100);
    const endPct = Math.min(100, ((idx + margin + 40) / totalCandles) * 100);
    setZoomRange({ start: startPct, end: endPct });

    // Start replaying this pattern
    setReplayPattern(pattern);
  };

  const speedOptions = [1, 2, 4];

  return (
    <div className="replay-panel">
      <div className="replay-panel-header">
        <span className="replay-panel-title">
          Pattern Replay — {patternName} [{confStr}%]
        </span>
        <span className="replay-phase-badge">{replay.phase}</span>
        <button
          type="button"
          className="replay-close-btn"
          onClick={handleClose}
          title="Close replay"
        >
          <span className="material-icons md-16">close</span>
        </button>
      </div>

      {/* Controls */}
      <div className="replay-controls">
        <button type="button" className="replay-btn" onClick={replay.reset} title="Reset">
          <span className="material-icons md-18">skip_previous</span>
        </button>
        <button
          type="button"
          className="replay-btn"
          onClick={replay.stepBackward}
          title="Step back"
        >
          <span className="material-icons md-18">chevron_left</span>
        </button>
        <button
          type="button"
          className="replay-btn replay-btn-primary"
          onClick={replay.isPlaying ? replay.pause : replay.play}
          title={replay.isPlaying ? "Pause" : "Play"}
        >
          <span className="material-icons md-18">{replay.isPlaying ? "pause" : "play_arrow"}</span>
        </button>
        <button
          type="button"
          className="replay-btn"
          onClick={replay.stepForward}
          title="Step forward"
        >
          <span className="material-icons md-18">chevron_right</span>
        </button>

        <input
          type="range"
          className="replay-progress"
          min={0}
          max={total}
          value={progress}
          onChange={(e) => replay.seekTo(replay.startIndex + Number(e.target.value))}
        />
        <span className="replay-progress-label">
          {progress}/{total}
        </span>

        <span className="replay-speed-group">
          {speedOptions.map((s) => (
            <button
              key={s}
              type="button"
              className={`replay-speed-btn ${replay.speed === s ? "active" : ""}`}
              onClick={() => replay.setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </span>
      </div>

      <div className="replay-body">
        {/* Projection Stats */}
        {projection && projection.validCount > 0 && (
          <div className="replay-stats">
            <div className="replay-stats-title">Projection Stats</div>
            <div className="replay-stats-row">
              <span className="replay-stat-label">Hit Rates:</span>
              {projection.hitRates.map((hr) => (
                <span key={hr.threshold} className="replay-stat-value">
                  +{hr.threshold}%: {hr.rate.toFixed(0)}%
                </span>
              ))}
            </div>
            <div className="replay-stats-row">
              <span className="replay-stat-label">Avg Return (20 bars):</span>
              <span
                className={`replay-stat-value ${
                  (projection.avgReturnByBar[19] ?? 0) >= 0 ? "positive" : "negative"
                }`}
              >
                {(projection.avgReturnByBar[19] ?? 0) >= 0 ? "+" : ""}
                {(projection.avgReturnByBar[19] ?? 0).toFixed(2)}%
              </span>
            </div>
            <div className="replay-stats-row">
              <span className="replay-stat-label">Based on:</span>
              <span className="replay-stat-value">
                {projection.validCount} historical instance{projection.validCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Past Instances */}
        {pastInstances.length > 0 && (
          <div className="past-instances">
            <div className="past-instances-title">Past Instances ({pastInstances.length})</div>
            <div className="past-instances-list">
              {pastInstances.map((inst, i) => (
                <div key={i} className={`past-instance-row ${inst.isCurrent ? "current" : ""}`}>
                  <span className="past-instance-date">{inst.date}</span>
                  <span className="past-instance-conf">Conf: {inst.confidence}%</span>
                  {inst.result !== null ? (
                    <span
                      className={`past-instance-result ${inst.result >= 0 ? "positive" : "negative"}`}
                    >
                      {inst.result >= 0 ? "+" : ""}
                      {inst.result.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="past-instance-result">—</span>
                  )}
                  {!inst.isCurrent && (
                    <button
                      type="button"
                      className="past-instance-jump"
                      onClick={() => handleJumpToPattern(inst.pattern)}
                      title="Jump to this pattern"
                    >
                      Jump
                    </button>
                  )}
                  {inst.isCurrent && <span className="past-instance-current-tag">Current</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
