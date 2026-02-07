/**
 * Parameter panel component for indicator settings
 */

import type { IndicatorParams } from "../../types";
import { INDICATOR_PARAM_CONFIGS, DEFAULT_INDICATOR_PARAMS } from "../../types";

interface ParameterPanelProps {
  indicatorKey: string;
  indicatorParams: IndicatorParams;
  onParamChange: (paramKey: keyof IndicatorParams, value: number) => void;
}

/**
 * Renders the parameter panel for a given indicator key.
 * Shows number inputs for each configurable parameter.
 */
export function ParameterPanel({ indicatorKey, indicatorParams, onParamChange }: ParameterPanelProps) {
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
                onParamChange(config.key, Number.parseFloat(e.target.value) || config.min)
              }
            />
          </div>
        );
      })}
    </div>
  );
}
