import { useEffect, useState } from "react";

type NumInputProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  /** Number for fixed cadence, or `"any"` to allow arbitrary decimals. */
  step?: number | "any";
  integer?: boolean;
  onChange: (v: number) => void;
};

/**
 * Mirrors the parent's numeric `value` but keeps the user's in-progress
 * text locally so transient strings like `"-"`, `"-0."`, or `"0."` aren't
 * snapped back to the previous committed number on every keystroke.
 * Only emits `onChange` when the text parses to a finite number.
 */
export function NumInput({ label, value, min, max, step, integer, onChange }: NumInputProps) {
  const [draft, setDraft] = useState<string>(() => (Number.isFinite(value) ? String(value) : ""));

  // Snap the local draft to the parent's value when it changes via some
  // other path (range reset, programmatic update). Skip while the draft
  // is mid-edit and would round-trip back to the same number — otherwise
  // typing `2.05` flickers as `2 → 2.0 → 2.05`.
  useEffect(() => {
    const parsed = Number.parseFloat(draft);
    if (!Number.isFinite(parsed) || parsed !== value) {
      setDraft(Number.isFinite(value) ? String(value) : "");
    }
  }, [value, draft]);

  return (
    <label className="risk-input">
      <span>{label}</span>
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          if (raw === "" || raw === "-" || raw === "." || raw === "-.") return;
          const n = integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}
