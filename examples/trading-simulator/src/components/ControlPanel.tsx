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
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  const handleJumpToDate = useCallback(
    (dateStr: string) => {
      if (!activeSymbol || !commonDateRange) return;
      // Parse YYYY-MM-DD input
      const targetTime = new Date(dateStr).getTime();
      if (Number.isNaN(targetTime)) return;

      // Find the closest common date at or after the target
      let bestIdx = -1;
      for (let i = 0; i < commonDateRange.dates.length; i++) {
        if (commonDateRange.dates[i] >= targetTime) {
          bestIdx = i;
          break;
        }
      }
      if (bestIdx === -1) bestIdx = commonDateRange.dates.length - 1;

      // Clamp to valid range
      const minDateIndex = initialCandleCount;
      const clampedIdx = Math.max(
        minDateIndex,
        Math.min(bestIdx, commonDateRange.dates.length - 1),
      );
      jumpToIndex(clampedIdx);
      setShowDatePicker(false);
    },
    [activeSymbol, commonDateRange, initialCandleCount, jumpToIndex],
  );

  // Date range for the picker
  const dateRange = useMemo(() => {
    if (!commonDateRange) return { min: "", max: "" };
    const minIdx = initialCandleCount;
    const minDate = commonDateRange.dates[minIdx];
    const maxDate = commonDateRange.dates[commonDateRange.dates.length - 1];
    const toISO = (t: number) => new Date(t).toISOString().split("T")[0];
    return { min: minDate ? toISO(minDate) : "", max: maxDate ? toISO(maxDate) : "" };
  }, [commonDateRange, initialCandleCount]);

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

        {/* Jump to Date */}
        <div className="jump-to-date">
          <button
            type="button"
            className="jump-date-btn"
            onClick={() => setShowDatePicker(!showDatePicker)}
            title="Jump to specific date"
          >
            <span className="material-icons">calendar_today</span>
            <span>Jump to Date</span>
          </button>
          {showDatePicker && (
            <div className="date-picker-row">
              <input
                type="date"
                className="date-picker-input"
                min={dateRange.min}
                max={dateRange.max}
                defaultValue={
                  currentCandle ? new Date(currentCandle.time).toISOString().split("T")[0] : ""
                }
                onChange={(e) => handleJumpToDate(e.target.value)}
              />
            </div>
          )}
        </div>
      </CollapsiblePanel>
    </div>
  );
}
