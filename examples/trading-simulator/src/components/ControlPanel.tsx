import { useCallback, useMemo, useState } from "react";
import { usePlayback } from "../hooks/usePlayback";
import { useSimulatorStore } from "../store/simulatorStore";
import type { PlaybackSpeed } from "../types";
import { formatDate } from "../utils/fileParser";

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

  // シークバードラッグ中の仮の値
  const [seekValue, setSeekValue] = useState<number | null>(null);

  // アクティブ銘柄を取得
  const activeSymbol = useMemo(() => {
    if (!activeSymbolId) return symbols[0] || null;
    return symbols.find((s) => s.id === activeSymbolId) || null;
  }, [symbols, activeSymbolId]);

  // 現在の日付からインデックスを計算
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

  // シークバーの現在値（ドラッグ中は仮の値を使用）
  const sliderValue = seekValue !== null ? seekValue : currentIndex;
  const previewCandle = allCandles[sliderValue];

  const handleSeekChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseInt(e.target.value, 10);
      setSeekValue(value);
      // ドラッグ中は再生を停止
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

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSpeed(Number(e.target.value) as PlaybackSpeed);
  };

  const handleFinish = () => {
    pause();
    finishSimulation();
  };

  return (
    <div className="control-panel">
      <h3>再生コントロール</h3>

      <div className="playback-controls">
        <button
          type="button"
          onClick={stepBackward}
          disabled={currentIndex <= minIndex}
          title="前の日"
        >
          <span className="material-icons">skip_previous</span>
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className={isPlaying ? "active" : ""}
          disabled={isAtEnd}
          title={isPlaying ? "一時停止" : "再生"}
        >
          <span className="material-icons">{isPlaying ? "pause" : "play_arrow"}</span>
        </button>
        <button type="button" onClick={handleFinish} title="終了">
          <span className="material-icons">stop</span>
        </button>
        <button type="button" onClick={stepForward} disabled={isAtEnd} title="次の日">
          <span className="material-icons">skip_next</span>
        </button>
      </div>

      <div className="speed-select">
        <label>
          速度:
          <select value={playbackSpeed} onChange={handleSpeedChange}>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </label>
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
    </div>
  );
}
