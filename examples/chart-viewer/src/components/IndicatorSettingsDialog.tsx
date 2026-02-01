/**
 * Indicator settings dialog component
 */

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useChartStore } from "../store/chartStore";
import type { IndicatorParams, OverlayType, SubChartType, SignalType } from "../types";
import { DEFAULT_INDICATOR_PARAMS, INDICATOR_PARAM_CONFIGS } from "../types";

interface IndicatorSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "overlay" | "subchart" | "signals";

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
    ],
  },
  {
    group: "Volume",
    options: [
      { key: "vwap", label: "VWAP" },
    ],
  },
  {
    group: "Price",
    options: [
      { key: "swingPoints", label: "Swing Points" },
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
  { key: "perfectOrder", label: "Perfect Order", description: "MA順序によるトレンド検出" },
  { key: "rangeBound", label: "Range-Bound", description: "レンジ相場の検出" },
  { key: "cross", label: "GC/DC", description: "ゴールデン/デッドクロス検出" },
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
];

/**
 * Fundamentals group (only shown when CSV contains PER/PBR data)
 */
const FUNDAMENTALS_GROUP: { group: string; options: { key: SubChartType; label: string }[] } = {
  group: "Fundamentals",
  options: [
    { key: "per", label: "PER (株価収益率)" },
    { key: "pbr", label: "PBR (株価純資産倍率)" },
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
              title="パラメータ設定"
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
                    {grp.options.map((opt) =>
                      renderIndicatorItem(
                        opt.key,
                        opt.label,
                        enabledIndicators.includes(opt.key),
                        handleSubchartChange(opt.key),
                      ),
                    )}
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
                        </label>
                        <div className="signal-description">{opt.description}</div>
                      </div>
                    );
                  })}
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
