import type { PluginCategory } from "../lib/plugins";
import { PLUGIN_CATALOG } from "../lib/plugins";
import { ToggleCatalogPanel } from "./ToggleCatalogPanel";

const CATEGORY_LABELS: Record<PluginCategory, string> = {
  smc: "Smart Money",
  structure: "Structure",
  volume: "Volume",
  patterns: "Patterns",
  regime: "Regime",
  session: "Session",
  drawings: "Auto Drawings",
  signals: "Signals",
};

const CATEGORY_ORDER: readonly PluginCategory[] = [
  "smc",
  "structure",
  "volume",
  "patterns",
  "regime",
  "session",
  "drawings",
  "signals",
];

type Props = {
  enabled: ReadonlySet<string>;
  /** Kinds whose `build()` returned `null` last attempt (insufficient data). */
  unavailable: ReadonlySet<string>;
  onToggle: (kind: string) => void;
};

export function PluginsPanel({ enabled, unavailable, onToggle }: Props) {
  return (
    <ToggleCatalogPanel
      title="Plugins"
      items={PLUGIN_CATALOG}
      categoryOrder={CATEGORY_ORDER}
      categoryLabels={CATEGORY_LABELS}
      enabled={enabled}
      onToggle={onToggle}
      classNameFor={(def) => (unavailable.has(def.kind) ? "unavailable" : undefined)}
      tooltipFor={(def) =>
        unavailable.has(def.kind)
          ? `${def.description} — not enough data at the current playhead.`
          : def.description
      }
      renderBadge={(def) =>
        enabled.has(def.kind) && unavailable.has(def.kind) ? (
          <span className="signal-count signal-count--warn">!</span>
        ) : null
      }
    />
  );
}
