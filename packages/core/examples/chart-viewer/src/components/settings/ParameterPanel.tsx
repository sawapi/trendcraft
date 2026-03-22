/**
 * Parameter panel component for indicator settings
 */

import type { IndicatorParams, NumericParamConfig } from "../../types";
import { DEFAULT_INDICATOR_PARAMS, INDICATOR_PARAM_CONFIGS } from "../../types";

interface ParameterPanelProps {
  indicatorKey: string;
  indicatorParams: IndicatorParams;
  onParamChange: (paramKey: keyof IndicatorParams, value: number | boolean) => void;
}

/**
 * Renders the parameter panel for a given indicator key.
 * Shows number inputs for each configurable parameter.
 */
export function ParameterPanel({
  indicatorKey,
  indicatorParams,
  onParamChange,
}: ParameterPanelProps) {
  const configs = INDICATOR_PARAM_CONFIGS[indicatorKey];
  if (!configs || configs.length === 0) return null;

  return (
    <div className="param-panel">
      {configs.map((config) => {
        if ("type" in config && config.type === "boolean") {
          const checked = !!indicatorParams[config.key];
          return (
            <div key={config.key} className="param-row param-row-boolean">
              <label className="custom-checkbox">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onParamChange(config.key, e.target.checked)}
                />
                <span className="material-icons checkbox-icon">
                  {checked ? "check_box" : "check_box_outline_blank"}
                </span>
                <span>{config.label}</span>
              </label>
            </div>
          );
        }

        const numConfig = config as NumericParamConfig;
        const paramValue = indicatorParams[numConfig.key];
        const defaultValue = DEFAULT_INDICATOR_PARAMS[numConfig.key];
        const displayValue =
          typeof paramValue === "number"
            ? paramValue
            : typeof defaultValue === "number"
              ? defaultValue
              : numConfig.min;

        return (
          <div key={numConfig.key} className="param-row">
            <label>{numConfig.label}</label>
            <input
              type="number"
              min={numConfig.min}
              max={numConfig.max}
              step={numConfig.step}
              value={displayValue}
              onChange={(e) =>
                onParamChange(numConfig.key, Number.parseFloat(e.target.value) || numConfig.min)
              }
            />
          </div>
        );
      })}
    </div>
  );
}
