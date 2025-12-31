import { AVAILABLE_INDICATORS } from "../types";

interface Props {
  selected: string[];
  onChange: (indicators: string[]) => void;
}

export function IndicatorSelector({ selected, onChange }: Props) {
  const handleToggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <div className="indicator-selector">
      <label className="section-label">表示するインジケーター</label>
      <div className="indicator-grid">
        {AVAILABLE_INDICATORS.map(({ key, label }) => (
          <label key={key} className="checkbox-label">
            <input
              type="checkbox"
              checked={selected.includes(key)}
              onChange={() => handleToggle(key)}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
