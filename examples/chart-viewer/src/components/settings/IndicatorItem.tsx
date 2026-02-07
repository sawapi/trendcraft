/**
 * Individual indicator item component with checkbox, settings button, and parameter panel
 */

import type { ChangeEvent } from "react";
import type { IndicatorParams } from "../../types";
import { INDICATOR_PARAM_CONFIGS } from "../../types";
import { ParameterPanel } from "./ParameterPanel";

interface IndicatorItemProps {
  indicatorKey: string;
  label: string;
  isEnabled: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  expandedIndicator: string | null;
  onSettingsClick: (e: React.MouseEvent, key: string) => void;
  indicatorParams: IndicatorParams;
  onParamChange: (paramKey: keyof IndicatorParams, value: number) => void;
}

/**
 * Renders a single indicator checkbox with optional settings button and parameter panel.
 */
export function IndicatorItem({
  indicatorKey,
  label,
  isEnabled,
  onChange,
  expandedIndicator,
  onSettingsClick,
  indicatorParams,
  onParamChange,
}: IndicatorItemProps) {
  const hasParams = INDICATOR_PARAM_CONFIGS[indicatorKey] !== undefined;
  const isExpanded = expandedIndicator === indicatorKey;

  return (
    <div key={indicatorKey} className="indicator-item">
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
            onClick={(e) => onSettingsClick(e, indicatorKey)}
            title="Parameter Settings"
          >
            <span className="material-icons">tune</span>
          </button>
        )}
      </label>
      {isExpanded && (
        <ParameterPanel
          indicatorKey={indicatorKey}
          indicatorParams={indicatorParams}
          onParamChange={onParamChange}
        />
      )}
    </div>
  );
}
