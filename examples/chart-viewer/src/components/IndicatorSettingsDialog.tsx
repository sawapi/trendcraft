/**
 * Indicator settings dialog component
 */

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useChartStore } from "../store/chartStore";
import type { IndicatorParams, OverlayType, SubChartType, ScoringPreset } from "../types";
import { INDICATOR_PARAM_CONFIGS } from "../types";
import type { IndicatorSettingsDialogProps, TabType } from "./settings/settingsData";
import {
  DISPLAY_START_YEARS_OPTIONS,
  OVERLAY_GROUPS,
  SIGNAL_OPTIONS,
  SUBCHART_GROUPS,
  FUNDAMENTALS_GROUP,
} from "./settings/settingsData";
import { ParameterPanel } from "./settings/ParameterPanel";
import { IndicatorItem } from "./settings/IndicatorItem";

export function IndicatorSettingsDialog({ isOpen, onClose }: IndicatorSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overlay");
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");

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
  const presets = useChartStore((s) => s.presets);
  const savePreset = useChartStore((s) => s.savePreset);
  const loadPreset = useChartStore((s) => s.loadPreset);
  const deletePreset = useChartStore((s) => s.deletePreset);

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

  const handleParamChange = (paramKey: keyof IndicatorParams, value: number | boolean) => {
    setIndicatorParams({ [paramKey]: value });
  };

  const handleSettingsClick = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedIndicator(expandedIndicator === key ? null : key);
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    savePreset(name);
    setPresetName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
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
                    {grp.options.map((opt) => (
                      <IndicatorItem
                        key={opt.key}
                        indicatorKey={opt.key}
                        label={opt.label}
                        isEnabled={enabledOverlays.includes(opt.key)}
                        onChange={handleOverlayChange(opt.key)}
                        expandedIndicator={expandedIndicator}
                        onSettingsClick={handleSettingsClick}
                        indicatorParams={indicatorParams}
                        onParamChange={handleParamChange}
                      />
                    ))}
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

                      return (
                        <IndicatorItem
                          key={opt.key}
                          indicatorKey={opt.key}
                          label={opt.label}
                          isEnabled={isEnabled}
                          onChange={handleSubchartChange(opt.key)}
                          expandedIndicator={expandedIndicator}
                          onSettingsClick={handleSettingsClick}
                          indicatorParams={indicatorParams}
                          onParamChange={handleParamChange}
                        />
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
                        {isExpanded && (
                          <ParameterPanel
                            indicatorKey={opt.key}
                            indicatorParams={indicatorParams}
                            onParamChange={handleParamChange}
                          />
                        )}
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
          <div className="preset-controls">
            <div className="preset-save-row">
              <input
                type="text"
                className="preset-name-input"
                placeholder="Preset name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSavePreset();
                }}
              />
              <button
                type="button"
                className="preset-save-btn"
                disabled={!presetName.trim()}
                onClick={handleSavePreset}
              >
                <span className="material-icons md-16">save</span>
                Save
              </button>
            </div>
            {presets.length > 0 && (
              <div className="preset-list">
                {presets.map((p) => (
                  <div key={p.name} className="preset-item">
                    <button
                      type="button"
                      className="preset-load-btn"
                      onClick={() => loadPreset(p.name)}
                      title={`Load "${p.name}"`}
                    >
                      {p.name}
                    </button>
                    <button
                      type="button"
                      className="preset-delete-btn"
                      onClick={() => deletePreset(p.name)}
                      title={`Delete "${p.name}"`}
                    >
                      <span className="material-icons md-14">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="reset-params-btn" onClick={resetIndicatorParams}>
            <span className="material-icons">refresh</span>
            Reset Parameters
          </button>
        </footer>
      </div>
    </div>
  );
}
