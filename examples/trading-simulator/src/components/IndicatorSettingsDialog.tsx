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
  const {
    enabledIndicators,
    setEnabledIndicators,
    indicatorParams,
    setIndicatorParams,
  } = useSimulatorStore();

  if (!isOpen) return null;

  return (
    <div className="indicator-dialog-overlay" onClick={onClose}>
      <div className="indicator-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="indicator-dialog-header">
          <h3>インジケーター設定</h3>
          <button className="dialog-close-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="dialog-tabs">
          <button
            className={`dialog-tab ${activeTab === "chart" ? "active" : ""}`}
            onClick={() => setActiveTab("chart")}
          >
            チャート表示
          </button>
          <button
            className={`dialog-tab ${activeTab === "volume" ? "active" : ""}`}
            onClick={() => setActiveTab("volume")}
          >
            出来高検知
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
          {activeTab === "volume" && (
            <VolumeSpikeSettings isInDialog />
          )}
        </div>
      </div>
    </div>
  );
}
