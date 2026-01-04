import { useState } from "react";
import {
  INDICATOR_DEFINITIONS,
  CATEGORY_LABELS,
  INDICATOR_PARAM_CONFIGS,
  DEFAULT_INDICATOR_PARAMS,
  type IndicatorCategory,
  type IndicatorParams,
} from "../types";

interface Props {
  selected: string[];
  onChange: (indicators: string[]) => void;
  params: IndicatorParams;
  onParamsChange: (params: IndicatorParams) => void;
}

// カテゴリ順序
const CATEGORY_ORDER: IndicatorCategory[] = [
  "trend",
  "volatility",
  "momentum",
  "volume",
];

export function IndicatorSelector({ selected, onChange, params, onParamsChange }: Props) {
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

  // カテゴリ別にグループ化
  const groupedIndicators = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    indicators: INDICATOR_DEFINITIONS.filter((ind) => ind.category === category),
  }));

  return (
    <div className="indicator-selector">
      <label className="section-label">表示するインジケーター</label>
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
                        <span className="subchart-badge" title="サブチャート表示">
                          ⬜
                        </span>
                      )}
                    </span>
                    {hasParams && selected.includes(key) && (
                      <button
                        type="button"
                        className={`param-toggle ${isExpanded ? "active" : ""}`}
                        onClick={(e) => handleSettingsClick(e, key)}
                        title="パラメータ設定"
                      >
                        <span className="material-icons">settings</span>
                      </button>
                    )}
                  </label>
                  {isExpanded && paramConfigs.length > 0 && (
                    <div className="param-panel">
                      {paramConfigs.map((config) => (
                        <div key={config.key} className="param-row">
                          <label>{config.label}</label>
                          <input
                            type="number"
                            min={config.min}
                            max={config.max}
                            step={config.step}
                            value={params[config.key] ?? DEFAULT_INDICATOR_PARAMS[config.key]}
                            onChange={(e) =>
                              handleParamChange(config.key, parseFloat(e.target.value) || config.min)
                            }
                          />
                        </div>
                      ))}
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
