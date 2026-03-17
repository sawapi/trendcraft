import { useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";

interface VolumeSpikeSettingsProps {
  isInDialog?: boolean;
}

export function VolumeSpikeSettings({ isInDialog = false }: VolumeSpikeSettingsProps) {
  const { volumeSpikeSettings, setVolumeSpikeSettings, phase } = useSimulatorStore();
  const [isExpanded, setIsExpanded] = useState(isInDialog);

  // Only show outside dialog when not in setup phase
  if (!isInDialog && phase === "setup") return null;

  // Count enabled detectors
  const enabledCount = [
    volumeSpikeSettings.averageVolumeEnabled,
    volumeSpikeSettings.breakoutVolumeEnabled,
    volumeSpikeSettings.accumulationEnabled,
    volumeSpikeSettings.aboveAverageEnabled,
    volumeSpikeSettings.maCrossEnabled,
    volumeSpikeSettings.cmfEnabled,
    volumeSpikeSettings.obvEnabled,
  ].filter(Boolean).length;

  const content = (
    <div className="settings-content">
      {/* Average Volume Spike */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.averageVolumeEnabled}
            onChange={(e) => setVolumeSpikeSettings({ averageVolumeEnabled: e.target.checked })}
          />
          <span>Average Volume Breakout</span>
        </label>

        {volumeSpikeSettings.averageVolumeEnabled && (
          <div className="setting-inputs">
            <div className="setting-input">
              <label>Period</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={volumeSpikeSettings.averageVolumePeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      averageVolumePeriod: Math.max(5, Math.min(100, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">d</span>
              </div>
            </div>
            <div className="setting-input">
              <label>Multiplier</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={1.1}
                  max={10}
                  step={0.1}
                  value={volumeSpikeSettings.averageVolumeMultiplier}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      averageVolumeMultiplier: Math.max(1.1, Math.min(10, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">x</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Breakout Detection */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.breakoutVolumeEnabled}
            onChange={(e) => setVolumeSpikeSettings({ breakoutVolumeEnabled: e.target.checked })}
          />
          <span>N-Day High Volume Breakout</span>
        </label>

        {volumeSpikeSettings.breakoutVolumeEnabled && (
          <div className="setting-inputs">
            <div className="setting-input">
              <label>Lookback</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={volumeSpikeSettings.breakoutVolumePeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      breakoutVolumePeriod: Math.max(5, Math.min(100, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">d</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accumulation Phase Detection (Regression-based) */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.accumulationEnabled}
            onChange={(e) => setVolumeSpikeSettings({ accumulationEnabled: e.target.checked })}
          />
          <span>Rising Trend (Regression)</span>
        </label>

        {volumeSpikeSettings.accumulationEnabled && (
          <div className="setting-inputs">
            <div className="setting-hint">Detects volume uptrend via linear regression</div>
            <div className="setting-input">
              <label>Period</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={volumeSpikeSettings.accumulationPeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      accumulationPeriod: Math.max(3, Math.min(30, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">d</span>
              </div>
            </div>
            <div className="setting-input">
              <label>Min Slope</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  value={volumeSpikeSettings.accumulationMinSlope}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      accumulationMinSlope: Math.max(0.01, Math.min(0.5, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">/d</span>
              </div>
            </div>
            <div className="setting-input">
              <label>Min Consecutive Days</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={volumeSpikeSettings.accumulationMinDays}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      accumulationMinDays: Math.max(1, Math.min(20, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">d</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Above Average Continuation Detection */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.aboveAverageEnabled}
            onChange={(e) => setVolumeSpikeSettings({ aboveAverageEnabled: e.target.checked })}
          />
          <span>Above Average Continuation</span>
        </label>

        {volumeSpikeSettings.aboveAverageEnabled && (
          <div className="setting-inputs">
            <div className="setting-hint">Consecutive days above N-day average</div>
            <div className="setting-input">
              <label>Avg Period</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={volumeSpikeSettings.aboveAveragePeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      aboveAveragePeriod: Math.max(5, Math.min(100, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">d</span>
              </div>
            </div>
            <div className="setting-input">
              <label>Min Ratio</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  value={volumeSpikeSettings.aboveAverageMinRatio}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      aboveAverageMinRatio: Math.max(0.5, Math.min(3.0, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">x</span>
              </div>
            </div>
            <div className="setting-input">
              <label>Min Consecutive Days</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={volumeSpikeSettings.aboveAverageMinDays}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      aboveAverageMinDays: Math.max(1, Math.min(20, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">d</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Volume MA Cross Detection */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.maCrossEnabled}
            onChange={(e) => setVolumeSpikeSettings({ maCrossEnabled: e.target.checked })}
          />
          <span>Volume MA Cross</span>
        </label>

        {volumeSpikeSettings.maCrossEnabled && (
          <div className="setting-inputs">
            <div className="setting-input">
              <label>Short MA</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={volumeSpikeSettings.maCrossShortPeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      maCrossShortPeriod: Math.max(2, Math.min(20, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">d</span>
              </div>
            </div>
            <div className="setting-input">
              <label>Long MA</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={volumeSpikeSettings.maCrossLongPeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      maCrossLongPeriod: Math.max(10, Math.min(100, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">d</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CMF Accumulation/Distribution Detection */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.cmfEnabled}
            onChange={(e) => setVolumeSpikeSettings({ cmfEnabled: e.target.checked })}
          />
          <span>CMF Accumulation/Distribution</span>
        </label>

        {volumeSpikeSettings.cmfEnabled && (
          <div className="setting-inputs">
            <div className="setting-input">
              <label>Period</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={volumeSpikeSettings.cmfPeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      cmfPeriod: Math.max(5, Math.min(50, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">d</span>
              </div>
            </div>
            <div className="setting-input">
              <label>Threshold</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={-0.5}
                  max={0.5}
                  step={0.05}
                  value={volumeSpikeSettings.cmfThreshold}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      cmfThreshold: Math.max(-0.5, Math.min(0.5, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit" />
              </div>
            </div>
            <div className="setting-hint">
              CMF &gt; threshold: accumulation / CMF &lt; -threshold: distribution
            </div>
          </div>
        )}
      </div>

      {/* OBV Trend Detection */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.obvEnabled}
            onChange={(e) => setVolumeSpikeSettings({ obvEnabled: e.target.checked })}
          />
          <span>OBV Trend Detection</span>
        </label>

        {volumeSpikeSettings.obvEnabled && (
          <div className="setting-inputs">
            <div className="setting-input">
              <label>Lookback</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={volumeSpikeSettings.obvPeriod}
                  onChange={(e) =>
                    setVolumeSpikeSettings({
                      obvPeriod: Math.max(3, Math.min(30, Number(e.target.value))),
                    })
                  }
                />
                <span className="unit">d</span>
              </div>
            </div>
            <div className="setting-hint">
              Rising OBV: buying pressure / Falling OBV: selling pressure
            </div>
          </div>
        )}
      </div>

      {/* Display Options */}
      <div className="setting-group display-options">
        <div className="group-title">Display Options</div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.showRealtimeAlerts}
            onChange={(e) => setVolumeSpikeSettings({ showRealtimeAlerts: e.target.checked })}
          />
          <span>Real-time Alerts</span>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={volumeSpikeSettings.showChartMarkers}
            onChange={(e) => setVolumeSpikeSettings({ showChartMarkers: e.target.checked })}
          />
          <span>Chart Markers</span>
        </label>
      </div>
    </div>
  );

  // Show directly without accordion when inside dialog
  if (isInDialog) {
    return <div className="volume-spike-settings in-dialog">{content}</div>;
  }

  return (
    <div className="volume-spike-settings panel">
      <button className="settings-toggle" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="toggle-icon">{isExpanded ? "▼" : "▶"}</span>
        <span className="toggle-label">Volume Spike Detection</span>
        <span className="toggle-status">{enabledCount > 0 ? `${enabledCount} on` : "OFF"}</span>
      </button>

      {isExpanded && content}
    </div>
  );
}
