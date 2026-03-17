import { useState } from "react";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DEFAULT_INDICATOR_PARAMS,
  INDICATOR_DEFINITIONS,
  INDICATOR_PARAM_CONFIGS,
  type IndicatorParams,
} from "../types";

interface Props {
  selected: string[];
  onChange: (indicators: string[]) => void;
  params: IndicatorParams;
  onParamsChange: (params: IndicatorParams) => void;
  isInDialog?: boolean;
}

export function IndicatorSelector({
  selected,
  onChange,
  params,
  onParamsChange,
  isInDialog = false,
}: Props) {
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);

  const handleToggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
      if (expandedIndicator === key) {
        setExpandedIndicator(null);
      }
    } else {
      onChange([...selected, key]);
    }
  };

  const handleParamChange = (paramKey: keyof IndicatorParams, value: number) => {
    onParamsChange({
      ...params,
      [paramKey]: value,
    });
  };

  const handleSettingsClick = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedIndicator(expandedIndicator === key ? null : key);
  };

  // Group by category
  const groupedIndicators = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    indicators: INDICATOR_DEFINITIONS.filter((ind) => ind.category === category),
  }));

  return (
    <div className={`indicator-selector ${isInDialog ? "in-dialog" : ""}`}>
      {!isInDialog && <span className="section-label">Indicators</span>}
      {groupedIndicators.map(({ category, label, indicators }) => (
        <div key={category} className="indicator-category">
          <div className="category-header">{label}</div>
          <div className="indicator-grid">
            {indicators.map(({ key, label: indLabel, chartType }) => {
              const hasParams = INDICATOR_PARAM_CONFIGS[key] !== undefined;
              const isExpanded = expandedIndicator === key;
              const paramConfigs = INDICATOR_PARAM_CONFIGS[key] || [];

              return (
                <div key={key} className="indicator-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selected.includes(key)}
                      onChange={() => handleToggle(key)}
                    />
                    <span className="indicator-name">
                      {indLabel}
                      {chartType === "subchart" && (
                        <span className="subchart-badge" title="Subchart">
                          ⬜
                        </span>
                      )}
                    </span>
                    {hasParams && selected.includes(key) && (
                      <button
                        type="button"
                        className={`param-toggle ${isExpanded ? "active" : ""}`}
                        onClick={(e) => handleSettingsClick(e, key)}
                        title="Parameters"
                      >
                        <span className="material-icons">settings</span>
                      </button>
                    )}
                  </label>
                  {isExpanded && paramConfigs.length > 0 && (
                    <div className="param-panel">
                      {paramConfigs.map((config) => {
                        const paramValue = params[config.key];
                        const defaultValue = DEFAULT_INDICATOR_PARAMS[config.key];
                        // Use param value if numeric, otherwise fall back to default or min
                        const displayValue =
                          typeof paramValue === "number"
                            ? paramValue
                            : typeof defaultValue === "number"
                              ? defaultValue
                              : config.min;
                        return (
                          <div key={config.key} className="param-row">
                            <label>
                              {config.label}
                              <input
                                type="number"
                                min={config.min}
                                max={config.max}
                                step={config.step}
                                value={displayValue}
                                onChange={(e) =>
                                  handleParamChange(
                                    config.key,
                                    Number.parseFloat(e.target.value) || config.min,
                                  )
                                }
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
