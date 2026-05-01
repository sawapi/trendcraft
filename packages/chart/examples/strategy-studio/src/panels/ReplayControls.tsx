import type { ReplayState } from "../App";

export type SpeedTier = "1x" | "2x" | "5x" | "Max";
const SPEEDS: SpeedTier[] = ["1x", "2x", "5x", "Max"];

type Props = {
  replay: ReplayState;
  progress: number;
  cursorTime: number | null;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onSpeed: (s: SpeedTier) => void;
  onExit: () => void;
};

/**
 * Toolbar pinned to the top of the chart pane. In static mode it shows a hint
 * inviting the user to click any candle to anchor a Replay. In live mode it
 * exposes Play/Pause/Step, speed presets, a progress bar, and a REPLAY badge.
 */
export function ReplayControls({
  replay,
  progress,
  cursorTime,
  onPlay,
  onPause,
  onStep,
  onSpeed,
  onExit,
}: Props) {
  if (replay.mode === "static") {
    return (
      <div className="replay-toolbar replay-toolbar--ghost">
        <span className="replay-hint">
          <span className="replay-hint-icon">▶</span>
          Click any candle to start <strong>Replay</strong> from there
        </span>
      </div>
    );
  }

  const playing = replay.status === "playing";
  const complete = replay.status === "complete";
  const cursorLabel = cursorTime ? formatCursor(cursorTime) : "—";

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

      <div className="replay-progress" aria-label="Replay progress">
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

const FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatCursor(time: number): string {
  return FORMATTER.format(new Date(time));
}
