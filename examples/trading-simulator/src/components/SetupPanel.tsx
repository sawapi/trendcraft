import { useState, useMemo, useEffect } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { IndicatorSelector } from "./IndicatorSelector";
import { formatDate } from "../utils/fileParser";

export function SetupPanel() {
  const { allCandles, fileName, startSimulation, reset } = useSimulatorStore();

  const dateRange = useMemo(() => {
    if (allCandles.length === 0) return { min: "", max: "", defaultStart: "" };
    const min = new Date(allCandles[0].time).toISOString().split("T")[0];
    const max = new Date(allCandles[allCandles.length - 1].time)
      .toISOString()
      .split("T")[0];
    // Default start: 250 days before the end, or at least at min
    const defaultStartIndex = Math.max(0, allCandles.length - 250);
    const defaultStart = new Date(allCandles[defaultStartIndex].time)
      .toISOString()
      .split("T")[0];
    return { min, max, defaultStart };
  }, [allCandles]);

  const [startDate, setStartDate] = useState("");

  // Set default start date when dateRange is calculated
  useEffect(() => {
    if (dateRange.defaultStart && !startDate) {
      setStartDate(dateRange.defaultStart);
    }
  }, [dateRange.defaultStart, startDate]);
  const [initialCandleCount, setInitialCandleCount] = useState(250);
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [enabledIndicators, setEnabledIndicators] = useState<string[]>([
    "sma25",
    "sma75",
    "volume",
  ]);

  const handleStart = () => {
    const date = new Date(startDate).getTime();
    startSimulation({
      startDate: date,
      initialCandleCount,
      initialCapital,
      enabledIndicators,
    });
  };

  const handleReset = () => {
    reset();
  };

  return (
    <div className="setup-panel">
      <div className="file-info">
        <span className="label">ファイル:</span>
        <span className="value">{fileName}</span>
        <span className="label">期間:</span>
        <span className="value">
          {formatDate(allCandles[0].time)} -{" "}
          {formatDate(allCandles[allCandles.length - 1].time)}
        </span>
        <span className="label">データ数:</span>
        <span className="value">{allCandles.length}件</span>
        <button className="btn-secondary" onClick={handleReset}>
          別のファイルを選択
        </button>
      </div>

      <div className="setup-form">
        <div className="form-group">
          <label>シミュレーション開始日</label>
          <input
            type="date"
            value={startDate}
            min={dateRange.min}
            max={dateRange.max}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <p className="hint">この日付から1日ずつ進めていきます</p>
        </div>

        <div className="form-group">
          <label>初期表示日数</label>
          <input
            type="number"
            value={initialCandleCount}
            min={20}
            max={500}
            onChange={(e) => setInitialCandleCount(Number(e.target.value))}
          />
          <p className="hint">開始日より前に表示するローソク足の数（約1年=250日）</p>
        </div>

        <div className="form-group">
          <label>初期資金</label>
          <input
            type="number"
            value={initialCapital}
            min={10000}
            step={10000}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
          />
        </div>

        <IndicatorSelector
          selected={enabledIndicators}
          onChange={setEnabledIndicators}
        />

        <button className="btn-primary" onClick={handleStart}>
          シミュレーション開始
        </button>
      </div>
    </div>
  );
}
