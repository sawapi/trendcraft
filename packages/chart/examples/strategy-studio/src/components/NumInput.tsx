type NumInputProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  onChange: (v: number) => void;
};

export function NumInput({ label, value, min, max, step, integer, onChange }: NumInputProps) {
  return (
    <label className="risk-input">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return;
          const n = integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}
