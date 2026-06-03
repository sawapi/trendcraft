import { useMemo } from "react";
import type { IndicatorPreset, ParamSchema } from "trendcraft";
import type { IndicatorInstance } from "../App";

type Props = {
  instance: IndicatorInstance;
  preset: IndicatorPreset;
  onChange: (key: string, value: number) => void;
  onReset: () => void;
  onRemove?: () => void;
  /** Adds a Remove button to the action row (popover uses it). */
  showRemoveButton?: boolean;
};

/**
 * The slider/input form for one indicator instance. Pure rendering — owners
 * supply state, callbacks, and chrome (header, container). Reused by the
 * legend popover and (historically) by an inline card list.
 */
export function ParamCardBody({
  instance,
  preset,
  onChange,
  onReset,
  onRemove,
  showRemoveButton,
}: Props) {
  const fields = useMemo(() => buildFields(preset), [preset]);
  const hasOverrides = Object.keys(instance.params).length > 0;

  if (fields.length === 0) {
    return <div className="empty">No tunable parameters.</div>;
  }

  return (
    <div className="param-card-body">
      {fields.map((f) => {
        const current = instance.params[f.key] ?? f.default;
        return (
          <div key={f.key} className="param-row">
            <div className="param-row-head">
              <label htmlFor={`${instance.id}-${f.key}`} className="param-row-label">
                {f.label}
              </label>
              <span className="param-row-value">{current}</span>
            </div>
            {f.min !== undefined && f.max !== undefined ? (
              <input
                id={`${instance.id}-${f.key}`}
                type="range"
                min={f.min}
                max={f.max}
                step={f.step ?? 1}
                value={current}
                onChange={(e) => onChange(f.key, Number(e.target.value))}
              />
            ) : (
              <input
                id={`${instance.id}-${f.key}`}
                type="number"
                min={f.min}
                max={f.max}
                step={f.step ?? 1}
                value={current}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return;
                  const n = Number(raw);
                  if (Number.isFinite(n)) onChange(f.key, n);
                }}
              />
            )}
          </div>
        );
      })}
      <div className="param-card-actions">
        <button
          type="button"
          className="ghost"
          onClick={onReset}
          disabled={!hasOverrides}
          aria-label="Reset to defaults"
        >
          Reset
        </button>
        {showRemoveButton && onRemove && (
          <button
            type="button"
            className="ghost danger"
            onClick={onRemove}
            aria-label="Remove instance"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

type Field = {
  key: string;
  label: string;
  default: number;
  min?: number;
  max?: number;
  step?: number;
};

function buildFields(preset: IndicatorPreset): Field[] {
  if (preset.paramSchema && preset.paramSchema.length > 0) {
    return preset.paramSchema.map(toField);
  }
  const out: Field[] = [];
  for (const [key, val] of Object.entries(preset.defaultParams)) {
    if (typeof val === "number" && Number.isFinite(val)) {
      out.push({ key, label: key, default: val });
    }
  }
  return out;
}

function toField(s: ParamSchema): Field {
  return {
    key: s.key,
    label: s.label,
    default: s.default,
    min: s.min,
    max: s.max,
    step: s.step,
  };
}

/**
 * One-line param summary for compact listings — `Period 5` or `Period 20 · k 2.5`.
 * Useful when showing many instances in legends / quick lists.
 */
export function formatParamSummary(
  preset: IndicatorPreset,
  overrides: Record<string, number>,
): string {
  const fields = buildFields(preset);
  if (fields.length === 0) return "";
  return fields
    .slice(0, 2)
    .map((f) => `${f.label} ${overrides[f.key] ?? f.default}`)
    .join(" · ");
}
