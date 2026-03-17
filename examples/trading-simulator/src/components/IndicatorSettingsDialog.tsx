import { useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { IndicatorSelector } from "./IndicatorSelector";
import { VolumeSpikeSettings } from "./VolumeSpikeSettings";

interface IndicatorSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "chart" | "volume";

export function IndicatorSettingsDialog({ isOpen, onClose }: IndicatorSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("chart");
  const { enabledIndicators, setEnabledIndicators, indicatorParams, setIndicatorParams } =
    useSimulatorStore();

  if (!isOpen) return null;

  return (
    <div
      className="indicator-dialog-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="indicator-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="indicator-dialog-header">
          <h3>Indicator Settings</h3>
          <button type="button" className="dialog-close-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="dialog-tabs">
          <button
            type="button"
            className={`dialog-tab ${activeTab === "chart" ? "active" : ""}`}
            onClick={() => setActiveTab("chart")}
          >
            Chart Display
          </button>
          <button
            type="button"
            className={`dialog-tab ${activeTab === "volume" ? "active" : ""}`}
            onClick={() => setActiveTab("volume")}
          >
            Volume Detection
          </button>
        </div>

        <div className="indicator-dialog-content">
          {activeTab === "chart" && (
            <IndicatorSelector
              selected={enabledIndicators}
              onChange={setEnabledIndicators}
              params={indicatorParams}
              onParamsChange={setIndicatorParams}
              isInDialog
            />
          )}
          {activeTab === "volume" && <VolumeSpikeSettings isInDialog />}
        </div>
      </div>
    </div>
  );
}
