import { useCallback, useMemo, useState } from "react";
import { usePlayback } from "../hooks/usePlayback";
import { useSimulatorStore } from "../store/simulatorStore";
import type { PlaybackSpeed } from "../types";
import { formatDate } from "../utils/fileParser";
import { CollapsiblePanel } from "./CollapsiblePanel";

export function ControlPanel() {
  const {
    symbols,
    activeSymbolId,
    commonDateRange,
    currentDateIndex,
    isPlaying,
    playbackSpeed,
    initialCandleCount,
    togglePlay,
    pause,
    setSpeed,
    stepForward,
    stepBackward,
    finishSimulation,
    jumpToIndex,
  } = useSimulatorStore();

  const { isAtEnd } = usePlayback();

  // Temporary value while dragging the seek bar
  const [seekValue, setSeekValue] = useState<number | null>(null);

  // Get active symbol
  const activeSymbol = useMemo(() => {
    if (!activeSymbolId) return symbols[0] || null;
    return symbols.find((s) => s.id === activeSymbolId) || null;
  }, [symbols, activeSymbolId]);

  // Calculate index from current date
  const currentIndex = useMemo(() => {
    if (!activeSymbol || !commonDateRange || currentDateIndex < 0) return 0;
    const targetDate = commonDateRange.dates[currentDateIndex];
    if (!targetDate) return 0;
    return activeSymbol.allCandles.findIndex((c) => c.time === targetDate);
  }, [activeSymbol, commonDateRange, currentDateIndex]);

  const allCandles = activeSymbol?.allCandles || [];
  const startIndex = activeSymbol?.startIndex || 0;

  const currentCandle = allCandles[currentIndex];
  const minIndex = startIndex + initialCandleCount;
  const maxIndex = allCandles.length - 1;
  const progress = currentIndex - minIndex + 1;
  const total = allCandles.length - minIndex;

  // Current seek bar value (use temporary value while dragging)
  const sliderValue = seekValue !== null ? seekValue : currentIndex;
  const previewCandle = allCandles[sliderValue];

  const handleSeekChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseInt(e.target.value, 10);
      setSeekValue(value);
      // Pause playback while dragging
      if (isPlaying) pause();
    },
    [isPlaying, pause],
  );

  const handleSeekCommit = useCallback(() => {
    if (seekValue !== null) {
      jumpToIndex(seekValue);
      setSeekValue(null);
    }
  }, [seekValue, jumpToIndex]);

  const handleFinish = () => {
    pause();
    finishSimulation();
  };

  return (
    <div className="control-panel">
      <CollapsiblePanel title="Playback" storageKey="playback">
        <div className="playback-controls">
          <button
            type="button"
            onClick={stepBackward}
            disabled={currentIndex <= minIndex}
            title="Previous day"
          >
            <span className="material-icons">skip_previous</span>
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className={`play-btn ${isPlaying ? "active" : ""}`}
            disabled={isAtEnd}
            title={isPlaying ? "Pause" : "Play"}
          >
            <span className="material-icons">{isPlaying ? "pause" : "play_arrow"}</span>
          </button>
          <button type="button" onClick={handleFinish} title="Stop">
            <span className="material-icons">stop</span>
          </button>
          <button type="button" onClick={stepForward} disabled={isAtEnd} title="Next day">
            <span className="material-icons">skip_next</span>
          </button>
        </div>

        <div className="speed-pills">
          {([0.5, 1, 2, 4] as PlaybackSpeed[]).map((speed) => (
            <button
              key={speed}
              type="button"
              className={`speed-pill ${playbackSpeed === speed ? "active" : ""}`}
              onClick={() => setSpeed(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>

        <div className="progress-info">
          <span className="date">{currentCandle ? formatDate(currentCandle.time) : "-"}</span>
          <span className="count">
            {progress} / {total}
          </span>
        </div>

        {/* Time Seek Bar */}
        <div className="seek-bar-container">
          <input
            type="range"
            className="seek-bar"
            min={minIndex}
            max={maxIndex}
            value={sliderValue}
            onChange={handleSeekChange}
            onMouseUp={handleSeekCommit}
            onTouchEnd={handleSeekCommit}
          />
          {seekValue !== null && previewCandle && (
            <div className="seek-preview">{formatDate(previewCandle.time)}</div>
          )}
        </div>
      </CollapsiblePanel>
    </div>
  );
}
