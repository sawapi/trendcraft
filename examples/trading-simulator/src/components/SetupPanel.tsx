import { useEffect, useMemo, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { DEFAULT_INDICATOR_PARAMS, type IndicatorParams } from "../types";
import { formatDate } from "../utils/fileParser";
import { IndicatorSelector } from "./IndicatorSelector";

export function SetupPanel() {
  const { symbols, activeSymbolId, startSimulation, reset } = useSimulatorStore();

  // アクティブ銘柄のデータを取得
  const activeSymbol = symbols.find((s) => s.id === activeSymbolId);
  const allCandles = activeSymbol?.allCandles || [];
  const fileName = activeSymbol?.fileName || "";

  // 全銘柄の共通日付範囲を計算
  const commonDateRange = useMemo(() => {
    if (symbols.length === 0) return { min: "", max: "", defaultStart: "" };

    // 各銘柄の日付セットを作成
    const allDateSets = symbols.map((s) => new Set(s.allCandles.map((c) => c.time)));

    // 共通日付を抽出
    let commonDates: number[];
    if (symbols.length === 1) {
      commonDates = symbols[0].allCandles.map((c) => c.time);
    } else {
      const firstDates = [...allDateSets[0]];
      commonDates = firstDates.filter((d) => allDateSets.every((set) => set.has(d)));
    }

    if (commonDates.length === 0) return { min: "", max: "", defaultStart: "" };

    const sortedDates = commonDates.sort((a, b) => a - b);
    const min = new Date(sortedDates[0]).toISOString().split("T")[0];
    const max = new Date(sortedDates[sortedDates.length - 1]).toISOString().split("T")[0];

    // Default start: 250 days before the end
    const defaultStartIndex = Math.max(0, sortedDates.length - 250);
    const defaultStart = new Date(sortedDates[defaultStartIndex]).toISOString().split("T")[0];

    return { min, max, defaultStart };
  }, [symbols]);

  const [startDate, setStartDate] = useState("");

  // Set default start date when commonDateRange is calculated
  useEffect(() => {
    if (commonDateRange.defaultStart && !startDate) {
      setStartDate(commonDateRange.defaultStart);
    }
  }, [commonDateRange.defaultStart, startDate]);
  const [initialCandleCount, setInitialCandleCount] = useState(250);
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [enabledIndicators, setEnabledIndicators] = useState<string[]>([
    "sma25",
    "sma75",
    "volume",
  ]);
  const [indicatorParams, setIndicatorParams] = useState<IndicatorParams>({
    ...DEFAULT_INDICATOR_PARAMS,
  });
  const [commissionRate, setCommissionRate] = useState(0);
  const [slippageBps, setSlippageBps] = useState(0);
  const [taxRate, setTaxRate] = useState(20.315);
  const [stopLossPercent, setStopLossPercent] = useState(5);
  const [takeProfitPercent, setTakeProfitPercent] = useState(10);
  const [trailingStopEnabled, setTrailingStopEnabled] = useState(false);
  const [trailingStopPercent, setTrailingStopPercent] = useState(5);

  const handleStart = () => {
    const date = new Date(startDate).getTime();
    startSimulation({
      startDate: date,
      initialCandleCount,
      initialCapital,
      enabledIndicators,
      indicatorParams,
      commissionRate,
      slippageBps,
      taxRate,
      stopLossPercent,
      takeProfitPercent,
      trailingStopEnabled,
      trailingStopPercent,
    });
  };

  const handleReset = () => {
    reset();
  };

  // データがない場合は何も表示しない
  if (symbols.length === 0) {
    return (
      <div className="setup-panel">
        <p>銘柄データがありません。CSVファイルを読み込んでください。</p>
      </div>
    );
  }

  return (
    <div className="setup-panel">
      {/* アクティブ銘柄のファイル情報（タブ切り替えで変わる部分） */}
      <div className="file-info">
        <span className="label">ファイル:</span>
        <span className="value">{fileName}</span>
        <span className="label">期間:</span>
        <span className="value">
          {allCandles.length > 0
            ? `${formatDate(allCandles[0].time)} - ${formatDate(allCandles[allCandles.length - 1].time)}`
            : "-"}
        </span>
        <span className="label">データ数:</span>
        <span className="value">{allCandles.length}件</span>
        <button className="btn-secondary" onClick={handleReset}>
          別のファイルを選択
        </button>
      </div>

      {/* 複数銘柄の場合、共通期間を表示 */}
      {symbols.length > 1 && (
        <div className="common-date-info">
          <span className="label">共通期間:</span>
          <span className="value">
            {commonDateRange.min} - {commonDateRange.max}
          </span>
          <span className="hint">（{symbols.length}銘柄の共通日付範囲でシミュレーション）</span>
        </div>
      )}

      <div className="setup-form">
        <div className="form-group">
          <label>シミュレーション開始日</label>
          <input
            type="date"
            value={startDate}
            min={commonDateRange.min}
            max={commonDateRange.max}
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

        <div className="form-group cost-settings">
          <label>コスト・税金設定</label>
          <div className="cost-inputs">
            <div className="cost-input">
              <label>手数料率 (%)</label>
              <input
                type="number"
                value={commissionRate}
                min={0}
                max={1}
                step={0.01}
                onChange={(e) => setCommissionRate(Number(e.target.value))}
              />
              <p className="hint">例: 0.1% = 10万円取引で100円</p>
            </div>
            <div className="cost-input">
              <label>スリッページ (bps)</label>
              <input
                type="number"
                value={slippageBps}
                min={0}
                max={100}
                step={1}
                onChange={(e) => setSlippageBps(Number(e.target.value))}
              />
              <p className="hint">例: 10bps = 0.1%の価格変動</p>
            </div>
            <div className="cost-input">
              <label>譲渡益税率 (%)</label>
              <input
                type="number"
                value={taxRate}
                min={0}
                max={50}
                step={0.001}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
              <p className="hint">利益に対する税金（日本: 20.315%）</p>
            </div>
          </div>
        </div>

        <div className="form-group chart-settings">
          <label>チャート表示設定</label>
          <div className="chart-setting-inputs">
            <div className="chart-setting-input">
              <label>損切りライン (%)</label>
              <input
                type="number"
                value={stopLossPercent}
                min={1}
                max={50}
                step={0.5}
                onChange={(e) => setStopLossPercent(Number(e.target.value))}
              />
              <p className="hint">エントリー価格からN%下に損切りラインを表示</p>
            </div>
            <div className="chart-setting-input">
              <label>利確ライン (%)</label>
              <input
                type="number"
                value={takeProfitPercent}
                min={1}
                max={100}
                step={0.5}
                onChange={(e) => setTakeProfitPercent(Number(e.target.value))}
              />
              <p className="hint">エントリー価格からN%上に利確ラインを表示</p>
            </div>
          </div>
          <div className="trailing-stop-settings">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={trailingStopEnabled}
                onChange={(e) => setTrailingStopEnabled(e.target.checked)}
              />
              トレーリングストップを有効にする
            </label>
            {trailingStopEnabled && (
              <div className="trailing-stop-input">
                <label>トレーリングストップ幅 (%)</label>
                <input
                  type="number"
                  value={trailingStopPercent}
                  min={1}
                  max={50}
                  step={0.5}
                  onChange={(e) => setTrailingStopPercent(Number(e.target.value))}
                />
                <p className="hint">高値からN%下落でストップ（価格上昇に追従）</p>
              </div>
            )}
          </div>
        </div>

        <IndicatorSelector
          selected={enabledIndicators}
          onChange={setEnabledIndicators}
          params={indicatorParams}
          onParamsChange={setIndicatorParams}
        />

        <button className="btn-primary" onClick={handleStart}>
          シミュレーション開始
        </button>
      </div>
    </div>
  );
}
