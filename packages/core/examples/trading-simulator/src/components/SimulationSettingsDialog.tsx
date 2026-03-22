import { useEffect, useMemo, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import type { Currency } from "../types";

interface SimulationSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SimulationSettingsDialog({ isOpen, onClose }: SimulationSettingsDialogProps) {
  const store = useSimulatorStore();
  const {
    symbols,
    initialCandleCount: currentCandleCount,
    initialCapital: currentCapital,
    commissionRate: currentCommission,
    slippageBps: currentSlippage,
    taxRate: currentTax,
    stopLossPercent: currentSL,
    takeProfitPercent: currentTP,
    trailingStopEnabled: currentTrailingEnabled,
    trailingStopPercent: currentTrailingPercent,
    enabledIndicators,
    indicatorParams,
    startSimulation,
  } = store;

  // Calculate date range from loaded data
  const dateRange = useMemo(() => {
    if (symbols.length === 0) return { min: "", max: "", dates: [] as number[] };

    const allDateSets = symbols.map((s) => new Set(s.allCandles.map((c) => c.time)));
    let commonDates: number[];
    if (symbols.length === 1) {
      commonDates = symbols[0].allCandles.map((c) => c.time);
    } else {
      const firstDates = [...allDateSets[0]];
      commonDates = firstDates.filter((d) => allDateSets.every((set) => set.has(d)));
    }

    const sorted = commonDates.sort((a, b) => a - b);
    return {
      min: sorted.length > 0 ? new Date(sorted[0]).toISOString().split("T")[0] : "",
      max: sorted.length > 0 ? new Date(sorted[sorted.length - 1]).toISOString().split("T")[0] : "",
      dates: sorted,
    };
  }, [symbols]);

  // Compute the current start date from store state
  const currentStartDate = useMemo(() => {
    if (dateRange.dates.length === 0) return "";
    const idx = Math.max(0, dateRange.dates.length - currentCandleCount);
    return new Date(dateRange.dates[idx]).toISOString().split("T")[0];
  }, [dateRange.dates, currentCandleCount]);

  const [startDate, setStartDate] = useState(currentStartDate);
  const [initialCandleCount, setInitialCandleCount] = useState(currentCandleCount);
  const [initialCapital, setInitialCapital] = useState(currentCapital);
  const [commissionRate, setCommissionRate] = useState(currentCommission);
  const [slippageBps, setSlippageBps] = useState(currentSlippage);
  const [taxRate, setTaxRate] = useState(currentTax);
  const [stopLossPercent, setStopLossPercent] = useState(currentSL);
  const [takeProfitPercent, setTakeProfitPercent] = useState(currentTP);
  const [trailingStopEnabled, setTrailingStopEnabled] = useState(currentTrailingEnabled);
  const [trailingStopPercent, setTrailingStopPercent] = useState(currentTrailingPercent);
  const [showConfirm, setShowConfirm] = useState(false);

  // Sync form state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStartDate(currentStartDate);
      setInitialCandleCount(currentCandleCount);
      setInitialCapital(currentCapital);
      setCommissionRate(currentCommission);
      setSlippageBps(currentSlippage);
      setTaxRate(currentTax);
      setStopLossPercent(currentSL);
      setTakeProfitPercent(currentTP);
      setTrailingStopEnabled(currentTrailingEnabled);
      setTrailingStopPercent(currentTrailingPercent);
      setShowConfirm(false);
    }
  }, [
    isOpen,
    currentStartDate,
    currentCandleCount,
    currentCapital,
    currentCommission,
    currentSlippage,
    currentTax,
    currentSL,
    currentTP,
    currentTrailingEnabled,
    currentTrailingPercent,
  ]);

  // First run: no trades or positions yet — no need for restart confirmation
  const activeSymbol = symbols.find((s) => s.id === store.activeSymbolId) ?? symbols[0];
  const isFirstRun =
    activeSymbol && activeSymbol.tradeHistory.length === 0 && activeSymbol.positions.length === 0;

  if (!isOpen) return null;

  const applySettings = () => {
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
    setShowConfirm(false);
    onClose();
  };

  const handleApply = () => {
    if (isFirstRun) {
      applySettings();
      return;
    }
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    applySettings();
  };

  return (
    <div
      className="indicator-dialog-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="indicator-dialog sim-settings-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
      >
        <div className="indicator-dialog-header">
          <h3>Simulation Settings</h3>
          <button type="button" className="dialog-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="sim-settings-content">
          {/* Date Range */}
          <div className="sim-settings-section">
            <h4 className="sim-settings-section-title">
              <span className="material-icons">date_range</span>
              Date Range
            </h4>
            <div className="form-group">
              <label>Simulation Start Date</label>
              <input
                type="date"
                value={startDate}
                min={dateRange.min}
                max={dateRange.max}
                onChange={(e) => setStartDate(e.target.value)}
              />
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
          </div>

          {/* Currency */}
          <div className="sim-settings-section">
            <h4 className="sim-settings-section-title">
              <span className="material-icons">language</span>
              Currency
            </h4>
            {symbols.map((sym) => (
              <div key={sym.id} className="form-group currency-row">
                <label>{sym.fileName}</label>
                <div className="currency-toggle">
                  {(["JPY", "USD"] as Currency[]).map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      className={`currency-btn ${sym.currency === cur ? "active" : ""}`}
                      onClick={() => store.setSymbolCurrency(sym.id, cur)}
                    >
                      {cur === "JPY" ? "¥ JPY" : "$ USD"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Capital & Cost */}
          <div className="sim-settings-section">
            <h4 className="sim-settings-section-title">
              <span className="material-icons">account_balance</span>
              Capital & Cost
            </h4>
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
              </div>
              <div className="cost-input">
                <label>Tax (%)</label>
                <input
                  type="number"
                  value={taxRate}
                  min={0}
                  max={50}
                  step={0.001}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Stop Loss / Take Profit */}
          <div className="sim-settings-section">
            <h4 className="sim-settings-section-title">
              <span className="material-icons">security</span>
              Risk Management
            </h4>
            <div className="cost-inputs">
              <div className="cost-input">
                <label>Stop Loss (%)</label>
                <input
                  type="number"
                  value={stopLossPercent}
                  min={1}
                  max={50}
                  step={0.5}
                  onChange={(e) => setStopLossPercent(Number(e.target.value))}
                />
              </div>
              <div className="cost-input">
                <label>Take Profit (%)</label>
                <input
                  type="number"
                  value={takeProfitPercent}
                  min={1}
                  max={100}
                  step={0.5}
                  onChange={(e) => setTakeProfitPercent(Number(e.target.value))}
                />
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
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="sim-settings-actions">
            {showConfirm ? (
              <div className="sim-settings-confirm">
                <p className="confirm-warning">
                  <span className="material-icons">warning</span>
                  This will reset all positions and trade history. Continue?
                </p>
                <div className="confirm-buttons">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button type="button" className="btn-primary" onClick={handleApply}>
                    <span className="material-icons">restart_alt</span>
                    Confirm Restart
                  </button>
                </div>
              </div>
            ) : (
              <div className="confirm-buttons">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  {isFirstRun ? "Use Defaults" : "Cancel"}
                </button>
                <button type="button" className="btn-primary" onClick={handleApply}>
                  <span className="material-icons">
                    {isFirstRun ? "play_arrow" : "restart_alt"}
                  </span>
                  {isFirstRun ? "Apply & Start" : "Apply & Restart"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
