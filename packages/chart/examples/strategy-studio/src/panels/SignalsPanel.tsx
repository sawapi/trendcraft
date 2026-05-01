import type { SignalCategory } from "../lib/signals";
import { SIGNAL_CATALOG } from "../lib/signals";

const CATEGORY_LABELS: Record<SignalCategory, string> = {
  cross: "Crosses",
  divergence: "Divergence",
  pattern: "Chart Patterns",
};

const CATEGORY_ORDER: SignalCategory[] = ["cross", "divergence", "pattern"];

type Props = {
  enabled: ReadonlySet<string>;
  countByKind: Record<string, number>;
  onToggle: (kind: string) => void;
};

/**
 * Checkbox-style list of signal detectors. Each detector computes deterministic
 * markers from the candle history and the host paints them via `chart.addSignals()`.
 * Replay mode filters the markers to the playhead in App.tsx.
 */
export function SignalsPanel({ enabled, countByKind, onToggle }: Props) {
  const grouped = new Map<SignalCategory, typeof SIGNAL_CATALOG>();
  for (const def of SIGNAL_CATALOG) {
    const list = (grouped.get(def.category) ?? []) as typeof SIGNAL_CATALOG;
    grouped.set(def.category, [...list, def]);
  }

  return (
    <>
      <div className="pane-header">Signals</div>
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat);
        if (!items?.length) return null;
        return (
          <div key={cat}>
            <div className="section-title">{CATEGORY_LABELS[cat]}</div>
            <ul className="signals-list">
              {items.map((def) => {
                const isOn = enabled.has(def.kind);
                const count = countByKind[def.kind] ?? 0;
                return (
                  <li key={def.kind} className={`signal-item${isOn ? " active" : ""}`}>
                    <button
                      type="button"
                      className="signal-toggle"
                      onClick={() => onToggle(def.kind)}
                      aria-pressed={isOn}
                      title={def.description}
                    >
                      <span className={`signal-check${isOn ? " on" : ""}`} aria-hidden="true">
                        {isOn ? "✓" : ""}
                      </span>
                      <span className="signal-name">{def.label}</span>
                      {isOn && count > 0 && <span className="signal-count">{count}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}
