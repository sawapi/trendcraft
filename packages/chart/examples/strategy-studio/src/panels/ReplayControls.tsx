import type { ReplayState } from "../App";

export type SpeedTier = "1x" | "2x" | "5x" | "Max";
const SPEEDS: SpeedTier[] = ["1x", "2x", "5x", "Max"];

type Props = {
  replay: ReplayState;
  progress: number;
  cursorTime: number | null;
  /**
   * When true, the cursor label omits the `HH:MM` suffix. Daily timeframes
   * store an arbitrary bar-close time (Alpaca uses 13:00 UTC for `1Day`),
   * which is meaningless to the user and visually noisy.
   */
  cursorIsDaily?: boolean;
  /** Whether the host is in "anchor mode" (next chart click anchors Replay). */
  anchorMode: boolean;
  onToggleAnchor: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onSpeed: (s: SpeedTier) => void;
  onExit: () => void;
};

/**
 * Toolbar pinned to the top of the chart pane. In static mode it exposes the
 * Anchor button (clicking it arms anchor-mode; the next chart click starts
 * Replay) and surfaces the Shift+click shortcut as a desktop accelerator. In
 * live mode it exposes Play/Pause/Step, speed presets, a progress bar, and a
 * REPLAY badge.
 */
export function ReplayControls({
  replay,
  progress,
  cursorTime,
  cursorIsDaily = false,
  anchorMode,
  onToggleAnchor,
  onPlay,
  onPause,
  onStep,
  onSpeed,
  onExit,
}: Props) {
  if (replay.mode === "static") {
    return (
      <div className="replay-toolbar replay-toolbar--ghost">
        <button
          type="button"
          className={`replay-btn small${anchorMode ? " active" : ""}`}
          onClick={onToggleAnchor}
          aria-pressed={anchorMode}
          title="Arm anchor mode — next chart click starts Replay from that bar"
        >
          🎯 Anchor
        </button>
        <span className="replay-hint">
          {anchorMode ? (
            <>
              <span className="replay-hint-icon">▶</span>
              Click any candle to start <strong>Replay</strong> from there
              <span className="replay-hint-sub">(Esc to cancel)</span>
            </>
          ) : (
            <>
              <span className="replay-hint-icon">▶</span>
              Press <strong>🎯 Anchor</strong> or <strong>Shift+click</strong> any candle to start
              Replay
            </>
          )}
        </span>
      </div>
    );
  }

  const playing = replay.status === "playing";
  const complete = replay.status === "complete";
  const cursorLabel = cursorTime ? formatCursor(cursorTime, cursorIsDaily) : "—";

  return (
    <div className="replay-toolbar">
      <div className="replay-cluster">
        <button
          type="button"
          className="replay-btn primary"
          onClick={playing ? onPause : onPlay}
          disabled={complete}
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause (Space)" : "Play (Space)"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          className="replay-btn"
          onClick={onStep}
          disabled={complete}
          aria-label="Step forward 1 bar"
          title="Step forward 1 bar (→)"
        >
          ⏭
        </button>
      </div>

      <div
        className="replay-progress"
        role="progressbar"
        aria-label="Replay progress"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="replay-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      <div className="replay-cluster">
        <span className="replay-label">Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`replay-btn small${replay.speed === s ? " active" : ""}`}
            onClick={() => onSpeed(s)}
            aria-pressed={replay.speed === s}
          >
            {s}
          </button>
        ))}
      </div>

      <span className="replay-cursor" title="Current playhead">
        {cursorLabel}
      </span>

      <div className="replay-cluster replay-trailing">
        <span className="replay-badge">
          <span className="replay-badge-dot" />
          {complete ? "DONE" : "REPLAY"}
        </span>
        <button
          type="button"
          className="replay-btn ghost"
          onClick={onExit}
          aria-label="Exit replay mode"
          title="Exit replay (return to static view)"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Hand-rolled ISO-style formatter so the cursor label is fixed-width: every
// component is zero-padded and locale-independent. Using `Intl.DateTimeFormat`
// with month: "short" / hour12 made the label width jitter as the playhead
// advanced (May vs September, 1 vs 12, AM vs PM), shifting the toolbar.
function formatCursor(time: number, isDaily: boolean): string {
  const d = new Date(time);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (isDaily) return `${yyyy}-${mm}-${dd}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
