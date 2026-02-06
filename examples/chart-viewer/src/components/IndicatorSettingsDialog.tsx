/**
 * Indicator settings dialog component
 */

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useChartStore } from "../store/chartStore";
import type { DisplayStartYears, IndicatorParams, OverlayType, SubChartType, SignalType, ScoringPreset } from "../types";
import { DEFAULT_INDICATOR_PARAMS, INDICATOR_PARAM_CONFIGS } from "../types";

interface IndicatorSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "overlay" | "subchart" | "signals" | "display";

/**
 * Display start years options
 */
const DISPLAY_START_YEARS_OPTIONS: { value: DisplayStartYears; label: string }[] = [
  { value: null, label: "All Data" },
  { value: 5, label: "Last 5 Years" },
  { value: 10, label: "Last 10 Years" },
  { value: 20, label: "Last 20 Years" },
];

/**
 * Overlay option groups
 */
const OVERLAY_GROUPS: { group: string; options: { key: OverlayType; label: string }[] }[] = [
  {
    group: "Moving Averages",
    options: [
      { key: "sma5", label: "SMA 5" },
      { key: "sma25", label: "SMA 25" },
      { key: "sma75", label: "SMA 75" },
      { key: "ema12", label: "EMA 12" },
      { key: "ema26", label: "EMA 26" },
      { key: "wma20", label: "WMA 20" },
    ],
  },
  {
    group: "Bands / Channels",
    options: [
      { key: "bb", label: "Bollinger Bands" },
      { key: "donchian", label: "Donchian Channel" },
      { key: "keltner", label: "Keltner Channel" },
    ],
  },
  {
    group: "Trend",
    options: [
      { key: "ichimoku", label: "Ichimoku" },
      { key: "supertrend", label: "Supertrend" },
      { key: "psar", label: "Parabolic SAR" },
      { key: "chandelierExit", label: "Chandelier Exit" },
    ],
  },
  {
    group: "Volume",
    options: [
      { key: "vwap", label: "VWAP" },
    ],
  },
  {
    group: "Volatility",
    options: [
      { key: "atrStops", label: "ATR Stops" },
    ],
  },
  {
    group: "Price",
    options: [
      { key: "swingPoints", label: "Swing Points" },
      { key: "pivotPoints", label: "Pivot Points" },
      { key: "fibonacci", label: "Fibonacci Retracement" },
      { key: "fibExtension", label: "Fibonacci Extension" },
      { key: "highestLowest", label: "Highest/Lowest" },
      { key: "autoTrendLine", label: "Auto Trend Line" },
      { key: "channelLine", label: "Channel Line" },
      { key: "andrewsPitchfork", label: "Andrew's Pitchfork" },
    ],
  },
  {
    group: "Smart Money (SMC)",
    options: [
      { key: "orderBlock", label: "Order Block" },
      { key: "fvg", label: "Fair Value Gap" },
      { key: "bos", label: "Break of Structure" },
      { key: "choch", label: "Change of Character" },
      { key: "liquiditySweep", label: "Liquidity Sweep" },
    ],
  },
];

/**
 * Signal options
 */
const SIGNAL_OPTIONS: { key: SignalType; label: string; description: string }[] = [
  { key: "perfectOrder", label: "Perfect Order", description: "Trend detection by MA alignment" },
  { key: "rangeBound", label: "Range-Bound", description: "Sideways market detection" },
  { key: "cross", label: "GC/DC", description: "Golden/Death cross detection" },
  { key: "divergence", label: "Divergence", description: "RSI/MACD/OBV divergence detection" },
  { key: "bbSqueeze", label: "BB Squeeze", description: "Bollinger Band squeeze (breakout signal)" },
  { key: "volumeBreakout", label: "Volume Breakout", description: "Volume breaks N-period high" },
  { key: "volumeMaCross", label: "Volume MA Cross", description: "Short/Long volume MA cross" },
];

/**
 * Subchart indicator groups
 */
const SUBCHART_GROUPS: { group: string; options: { key: SubChartType; label: string }[] }[] = [
  {
    group: "Momentum",
    options: [
      { key: "rsi", label: "RSI" },
      { key: "macd", label: "MACD" },
      { key: "stochastics", label: "Stochastics" },
      { key: "stochrsi", label: "Stochastic RSI" },
      { key: "cci", label: "CCI" },
      { key: "williams", label: "Williams %R" },
      { key: "roc", label: "ROC" },
    ],
  },
  {
    group: "Trend",
    options: [
      { key: "dmi", label: "DMI/ADX" },
      { key: "rangebound", label: "Range-Bound" },
    ],
  },
  {
    group: "Volatility",
    options: [
      { key: "atr", label: "ATR" },
      { key: "volatilityRegime", label: "Volatility Regime" },
    ],
  },
  {
    group: "Volume",
    options: [
      { key: "mfi", label: "MFI" },
      { key: "obv", label: "OBV" },
      { key: "cmf", label: "CMF" },
      { key: "volumeAnomaly", label: "Volume Anomaly" },
      { key: "volumeProfile", label: "Volume Profile" },
      { key: "volumeTrend", label: "Volume Trend" },
    ],
  },
  {
    group: "Scoring",
    options: [
      { key: "scoring", label: "Score" },
    ],
  },
];

/**
 * Fundamentals group (only shown when CSV contains PER/PBR data)
 */
const FUNDAMENTALS_GROUP: { group: string; options: { key: SubChartType; label: string }[] } = {
  group: "Fundamentals",
  options: [
    { key: "per", label: "PER (Price-to-Earnings)" },
    { key: "pbr", label: "PBR (Price-to-Book)" },
    // ROE is hidden but code remains for future use
    // { key: "roe", label: "ROE (Return on Equity)" },
  ],
};

export function IndicatorSettingsDialog({ isOpen, onClose }: IndicatorSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overlay");
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);

  const enabledOverlays = useChartStore((s) => s.enabledOverlays);
  const setEnabledOverlays = useChartStore((s) => s.setEnabledOverlays);
  const enabledIndicators = useChartStore((s) => s.enabledIndicators);
  const setEnabledIndicators = useChartStore((s) => s.setEnabledIndicators);
  const indicatorParams = useChartStore((s) => s.indicatorParams);
  const setIndicatorParams = useChartStore((s) => s.setIndicatorParams);
  const resetIndicatorParams = useChartStore((s) => s.resetIndicatorParams);
  const enabledSignals = useChartStore((s) => s.enabledSignals);
  const toggleSignal = useChartStore((s) => s.toggleSignal);
  const fundamentals = useChartStore((s) => s.fundamentals);
  const displayStartYears = useChartStore((s) => s.displayStartYears);
  const setDisplayStartYears = useChartStore((s) => s.setDisplayStartYears);

  // Build subchart groups with optional fundamentals
  const subchartGroups = fundamentals
    ? [...SUBCHART_GROUPS, FUNDAMENTALS_GROUP]
    : SUBCHART_GROUPS;

  if (!isOpen) return null;

  const handleOverlayChange = (key: OverlayType) => (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setEnabledOverlays([...enabledOverlays, key]);
    } else {
      setEnabledOverlays(enabledOverlays.filter((k) => k !== key));
      if (expandedIndicator === key) {
        setExpandedIndicator(null);
      }
    }
  };

  const handleSubchartChange = (key: SubChartType) => (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setEnabledIndicators([...enabledIndicators, key]);
    } else {
      setEnabledIndicators(enabledIndicators.filter((k) => k !== key));
      if (expandedIndicator === key) {
        setExpandedIndicator(null);
      }
    }
  };

  const handleParamChange = (paramKey: keyof IndicatorParams, value: number) => {
    setIndicatorParams({ [paramKey]: value });
  };

  const handleSettingsClick = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedIndicator(expandedIndicator === key ? null : key);
  };

  const handleReset = () => {
    resetIndicatorParams();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  const renderParamPanel = (indicatorKey: string) => {
    const configs = INDICATOR_PARAM_CONFIGS[indicatorKey];
    if (!configs || configs.length === 0) return null;

    return (
      <div className="param-panel">
        {configs.map((config) => {
          const paramValue = indicatorParams[config.key];
          const defaultValue = DEFAULT_INDICATOR_PARAMS[config.key];
          const displayValue =
            typeof paramValue === "number"
              ? paramValue
              : typeof defaultValue === "number"
                ? defaultValue
                : config.min;

          return (
            <div key={config.key} className="param-row">
              <label>{config.label}</label>
              <input
                type="number"
                min={config.min}
                max={config.max}
                step={config.step}
                value={displayValue}
                onChange={(e) =>
                  handleParamChange(config.key, Number.parseFloat(e.target.value) || config.min)
                }
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderIndicatorItem = (
    key: string,
    label: string,
    isEnabled: boolean,
    onChange: (e: ChangeEvent<HTMLInputElement>) => void,
  ) => {
    const hasParams = INDICATOR_PARAM_CONFIGS[key] !== undefined;
    const isExpanded = expandedIndicator === key;

    return (
      <div key={key} className="indicator-item">
        <label className="indicator-checkbox custom-checkbox">
          <input type="checkbox" checked={isEnabled} onChange={onChange} />
          <span className="material-icons checkbox-icon">
            {isEnabled ? "check_box" : "check_box_outline_blank"}
          </span>
          <span className="indicator-name">{label}</span>
          {hasParams && isEnabled && (
            <button
              type="button"
              className={`settings-btn ${isExpanded ? "active" : ""}`}
              onClick={(e) => handleSettingsClick(e, key)}
              title="Parameter Settings"
            >
              <span className="material-icons">tune</span>
            </button>
          )}
        </label>
        {isExpanded && renderParamPanel(key)}
      </div>
    );
  };

  return (
    <div
      className="settings-dialog-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="settings-dialog-header">
          <h3>Indicator Settings</h3>
          <button type="button" className="dialog-close-btn" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </header>

        <div className="dialog-tabs">
          <button
            type="button"
            className={`dialog-tab ${activeTab === "overlay" ? "active" : ""}`}
            onClick={() => setActiveTab("overlay")}
          >
            Overlays
          </button>
          <button
            type="button"
            className={`dialog-tab ${activeTab === "subchart" ? "active" : ""}`}
            onClick={() => setActiveTab("subchart")}
          >
            Subcharts
          </button>
          <button
            type="button"
            className={`dialog-tab ${activeTab === "signals" ? "active" : ""}`}
            onClick={() => setActiveTab("signals")}
          >
            Signals
          </button>
          <button
            type="button"
            className={`dialog-tab ${activeTab === "display" ? "active" : ""}`}
            onClick={() => setActiveTab("display")}
          >
            Display
          </button>
        </div>

        <div className="settings-dialog-content">
          {activeTab === "overlay" && (
            <div className="indicator-groups">
              {OVERLAY_GROUPS.map((grp) => (
                <div key={grp.group} className="indicator-group">
                  <div className="group-header">{grp.group}</div>
                  <div className="indicator-list">
                    {grp.options.map((opt) =>
                      renderIndicatorItem(
                        opt.key,
                        opt.label,
                        enabledOverlays.includes(opt.key),
                        handleOverlayChange(opt.key),
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "subchart" && (
            <div className="indicator-groups">
              {subchartGroups.map((grp) => (
                <div key={grp.group} className="indicator-group">
                  <div className="group-header">{grp.group}</div>
                  <div className="indicator-list">
                    {grp.options.map((opt) => {
                      const isEnabled = enabledIndicators.includes(opt.key);

                      // Special handling for scoring preset selector
                      if (opt.key === "scoring") {
                        return (
                          <div key={opt.key} className="indicator-item">
                            <label className="indicator-checkbox custom-checkbox">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={handleSubchartChange(opt.key)}
                              />
                              <span className="material-icons checkbox-icon">
                                {isEnabled ? "check_box" : "check_box_outline_blank"}
                              </span>
                              <span className="indicator-name">{opt.label}</span>
                            </label>
                            {isEnabled && (
                              <div className="scoring-preset-select">
                                <label>Preset:</label>
                                <select
                                  value={indicatorParams.scoringPreset}
                                  onChange={(e) =>
                                    setIndicatorParams({
                                      scoringPreset: e.target.value as ScoringPreset,
                                    })
                                  }
                                >
                                  <option value="balanced">Balanced</option>
                                  <option value="momentum">Momentum</option>
                                  <option value="meanReversion">Mean Reversion</option>
                                  <option value="trendFollowing">Trend Following</option>
                                  <option value="aggressive">Aggressive</option>
                                  <option value="conservative">Conservative</option>
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return renderIndicatorItem(
                        opt.key,
                        opt.label,
                        isEnabled,
                        handleSubchartChange(opt.key),
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "signals" && (
            <div className="indicator-groups">
              <div className="indicator-group">
                <div className="group-header">Signal Detection</div>
                <div className="indicator-list">
                  {SIGNAL_OPTIONS.map((opt) => {
                    const isChecked = enabledSignals.includes(opt.key);
                    const hasParams = INDICATOR_PARAM_CONFIGS[opt.key] !== undefined;
                    const isExpanded = expandedIndicator === opt.key;

                    return (
                      <div key={opt.key} className="indicator-item">
                        <label className="indicator-checkbox custom-checkbox">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSignal(opt.key)}
                          />
                          <span className="material-icons checkbox-icon">
                            {isChecked ? "check_box" : "check_box_outline_blank"}
                          </span>
                          <span className="indicator-name">{opt.label}</span>
                          {hasParams && isChecked && (
                            <button
                              type="button"
                              className={`settings-btn ${isExpanded ? "active" : ""}`}
                              onClick={(e) => handleSettingsClick(e, opt.key)}
                              title="Parameter Settings"
                            >
                              <span className="material-icons">tune</span>
                            </button>
                          )}
                        </label>
                        <div className="signal-description">{opt.description}</div>
                        {/* Divergence indicator selector */}
                        {opt.key === "divergence" && isChecked && (
                          <div className="divergence-indicator-select">
                            <label>Indicator:</label>
                            <select
                              value={indicatorParams.divergenceIndicator}
                              onChange={(e) =>
                                setIndicatorParams({
                                  divergenceIndicator: e.target.value as "rsi" | "macd" | "obv",
                                })
                              }
                            >
                              <option value="rsi">RSI</option>
                              <option value="macd">MACD</option>
                              <option value="obv">OBV</option>
                            </select>
                          </div>
                        )}
                        {isExpanded && renderParamPanel(opt.key)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "display" && (
            <div className="indicator-groups">
              <div className="indicator-group">
                <div className="group-header">Chart Display Settings</div>
                <div className="display-settings-list">
                  <div className="display-setting-item">
                    <label className="display-setting-label">Data Range Limit</label>
                    <p className="display-setting-description">
                      Filter data to only include the specified period.
                      Older data will be excluded from analysis.
                    </p>
                    <div className="display-start-years-options">
                      {DISPLAY_START_YEARS_OPTIONS.map((opt) => (
                        <label key={String(opt.value)} className="display-option custom-checkbox">
                          <input
                            type="radio"
                            name="displayStartYears"
                            checked={displayStartYears === opt.value}
                            onChange={() => setDisplayStartYears(opt.value)}
                          />
                          <span className="material-icons checkbox-icon">
                            {displayStartYears === opt.value ? "radio_button_checked" : "radio_button_unchecked"}
                          </span>
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="settings-dialog-footer">
          <button type="button" className="reset-params-btn" onClick={handleReset}>
            <span className="material-icons">refresh</span>
            Reset Parameters
          </button>
        </footer>
      </div>
    </div>
  );
}
