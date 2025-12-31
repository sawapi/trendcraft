import { useSimulatorStore } from "../store/simulatorStore";
import { usePlayback } from "../hooks/usePlayback";
import { formatDate } from "../utils/fileParser";
import type { PlaybackSpeed } from "../types";

export function ControlPanel() {
  const {
    isPlaying,
    playbackSpeed,
    currentIndex,
    startIndex,
    initialCandleCount,
    allCandles,
    togglePlay,
    pause,
    setSpeed,
    stepForward,
    stepBackward,
    finishSimulation,
  } = useSimulatorStore();

  const { isAtEnd } = usePlayback();

  const currentCandle = allCandles[currentIndex];
  const minIndex = startIndex + initialCandleCount;
  const progress = currentIndex - minIndex + 1;
  const total = allCandles.length - minIndex;

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
          onClick={stepBackward}
          disabled={currentIndex <= minIndex}
          title="前の日"
        >
          <span className="material-icons">skip_previous</span>
        </button>
        <button
          onClick={togglePlay}
          className={isPlaying ? "active" : ""}
          disabled={isAtEnd}
          title={isPlaying ? "一時停止" : "再生"}
        >
          <span className="material-icons">{isPlaying ? "pause" : "play_arrow"}</span>
        </button>
        <button onClick={handleFinish} title="終了">
          <span className="material-icons">stop</span>
        </button>
        <button onClick={stepForward} disabled={isAtEnd} title="次の日">
          <span className="material-icons">skip_next</span>
        </button>
      </div>

      <div className="speed-select">
        <label>速度:</label>
        <select value={playbackSpeed} onChange={handleSpeedChange}>
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
      </div>

      <div className="progress-info">
        <span className="date">
          {currentCandle ? formatDate(currentCandle.time) : "-"}
        </span>
        <span className="count">
          {progress} / {total}
        </span>
      </div>
    </div>
  );
}
