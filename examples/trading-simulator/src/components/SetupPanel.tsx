import { useEffect, useMemo, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { DEFAULT_INDICATOR_PARAMS, type IndicatorParams } from "../types";
import { formatDate } from "../utils/fileParser";
import { IndicatorSelector } from "./IndicatorSelector";

export function SetupPanel() {
  const { symbols, activeSymbolId, startSimulation, reset } = useSimulatorStore();

  // Get active symbol data
  const activeSymbol = symbols.find((s) => s.id === activeSymbolId);
  const allCandles = activeSymbol?.allCandles || [];
  const fileName = activeSymbol?.fileName || "";

  // Calculate common date range across all symbols
  const commonDateRange = useMemo(() => {
    if (symbols.length === 0) return { min: "", max: "", defaultStart: "" };

    // Create date sets for each symbol
    const allDateSets = symbols.map((s) => new Set(s.allCandles.map((c) => c.time)));

    // Extract common dates
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

  // Show nothing if no data
  if (symbols.length === 0) {
    return (
      <div className="setup-panel">
        <p>No symbol data. Please load a CSV file.</p>
      </div>
    );
  }

  return (
    <div className="setup-panel">
      {/* Active symbol file info (changes with tab switching) */}
      <div className="file-info">
        <span className="label">File:</span>
        <span className="value">{fileName}</span>
        <span className="label">Range:</span>
        <span className="value">
          {allCandles.length > 0
            ? `${formatDate(allCandles[0].time)} - ${formatDate(allCandles[allCandles.length - 1].time)}`
            : "-"}
        </span>
        <span className="label">Rows:</span>
        <span className="value">{allCandles.length}</span>
        <button className="btn-secondary" onClick={handleReset}>
          Select Different File
        </button>
      </div>

      {/* Show common date range for multiple symbols */}
      {symbols.length > 1 && (
        <div className="common-date-info">
          <span className="label">Common Range:</span>
          <span className="value">
            {commonDateRange.min} - {commonDateRange.max}
          </span>
          <span className="hint">({symbols.length} symbols, common dates only)</span>
        </div>
      )}

      <div className="setup-form">
        <div className="form-group">
          <label>Simulation Start Date</label>
          <input
            type="date"
            value={startDate}
            min={commonDateRange.min}
            max={commonDateRange.max}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <p className="hint">Simulation advances one day at a time from this date</p>
        </div>

        <div className="form-group">
          <label>Initial Chart Bars</label>
          <input
            type="number"
            value={initialCandleCount}
            min={20}
            max={500}
            onChange={(e) => setInitialCandleCount(Number(e.target.value))}
          />
          <p className="hint">Candles shown before start date (~1 year = 250)</p>
        </div>

        <div className="form-group">
          <label>Initial Capital</label>
          <input
            type="number"
            value={initialCapital}
            min={10000}
            step={10000}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
          />
        </div>

        <div className="form-group cost-settings">
          <label>Cost & Tax Settings</label>
          <div className="cost-inputs">
            <div className="cost-input">
              <label>Commission (%)</label>
              <input
                type="number"
                value={commissionRate}
                min={0}
                max={1}
                step={0.01}
                onChange={(e) => setCommissionRate(Number(e.target.value))}
              />
              <p className="hint">e.g. 0.1% = ¥100 on ¥100K trade</p>
            </div>
            <div className="cost-input">
              <label>Slippage (bps)</label>
              <input
                type="number"
                value={slippageBps}
                min={0}
                max={100}
                step={1}
                onChange={(e) => setSlippageBps(Number(e.target.value))}
              />
              <p className="hint">e.g. 10 bps = 0.1% price impact</p>
            </div>
            <div className="cost-input">
              <label>Capital Gains Tax (%)</label>
              <input
                type="number"
                value={taxRate}
                min={0}
                max={50}
                step={0.001}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
              <p className="hint">Tax on gains (Japan: 20.315%)</p>
            </div>
          </div>
        </div>

        <div className="form-group chart-settings">
          <label>Chart Display Settings</label>
          <div className="chart-setting-inputs">
            <div className="chart-setting-input">
              <label>Stop Loss Line (%)</label>
              <input
                type="number"
                value={stopLossPercent}
                min={1}
                max={50}
                step={0.5}
                onChange={(e) => setStopLossPercent(Number(e.target.value))}
              />
              <p className="hint">Shows stop loss line N% below entry price</p>
            </div>
            <div className="chart-setting-input">
              <label>Take Profit Line (%)</label>
              <input
                type="number"
                value={takeProfitPercent}
                min={1}
                max={100}
                step={0.5}
                onChange={(e) => setTakeProfitPercent(Number(e.target.value))}
              />
              <p className="hint">Shows take profit line N% above entry price</p>
            </div>
          </div>
          <div className="trailing-stop-settings">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={trailingStopEnabled}
                onChange={(e) => setTrailingStopEnabled(e.target.checked)}
              />
              Enable Trailing Stop
            </label>
            {trailingStopEnabled && (
              <div className="trailing-stop-input">
                <label>Trailing Stop Width (%)</label>
                <input
                  type="number"
                  value={trailingStopPercent}
                  min={1}
                  max={50}
                  step={0.5}
                  onChange={(e) => setTrailingStopPercent(Number(e.target.value))}
                />
                <p className="hint">Stops N% below high (follows price up)</p>
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
          Start Simulation
        </button>
      </div>
    </div>
  );
}
