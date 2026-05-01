import type { PluginCategory } from "../lib/plugins";
import { PLUGIN_CATALOG } from "../lib/plugins";

const CATEGORY_LABELS: Record<PluginCategory, string> = {
  smc: "Smart Money",
  structure: "Structure",
  volume: "Volume",
};

const CATEGORY_ORDER: PluginCategory[] = ["smc", "structure", "volume"];

type Props = {
  enabled: ReadonlySet<string>;
  /** kinds whose `build()` returned `null` last attempt (insufficient data). */
  unavailable: ReadonlySet<string>;
  onToggle: (kind: string) => void;
};

/**
 * Toggle list for chart-side primitive plugins (SMC layer, Wyckoff phase,
 * Andrews Pitchfork, Volume Profile). Each row's `build()` runs in App.tsx
 * — this panel is pure presentation.
 */
export function PluginsPanel({ enabled, unavailable, onToggle }: Props) {
  const grouped = new Map<PluginCategory, typeof PLUGIN_CATALOG>();
  for (const def of PLUGIN_CATALOG) {
    const list = (grouped.get(def.category) ?? []) as typeof PLUGIN_CATALOG;
    grouped.set(def.category, [...list, def]);
  }

  return (
    <>
      <div className="pane-header">Plugins</div>
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat);
        if (!items?.length) return null;
        return (
          <div key={cat}>
            <div className="section-title">{CATEGORY_LABELS[cat]}</div>
            <ul className="signals-list">
              {items.map((def) => {
                const isOn = enabled.has(def.kind);
                const noData = unavailable.has(def.kind);
                return (
                  <li
                    key={def.kind}
                    className={`signal-item${isOn ? " active" : ""}${noData ? " unavailable" : ""}`}
                  >
                    <button
                      type="button"
                      className="signal-toggle"
                      onClick={() => onToggle(def.kind)}
                      aria-pressed={isOn}
                      title={
                        noData
                          ? `${def.description} — not enough data at the current playhead.`
                          : def.description
                      }
                    >
                      <span className={`signal-check${isOn ? " on" : ""}`} aria-hidden="true">
                        {isOn ? "✓" : ""}
                      </span>
                      <span className="signal-name">{def.label}</span>
                      {isOn && noData && <span className="signal-count signal-count--warn">!</span>}
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
