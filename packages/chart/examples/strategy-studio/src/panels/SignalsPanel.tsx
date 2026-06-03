import type { SignalCategory } from "../lib/signals";
import { SIGNAL_CATALOG } from "../lib/signals";
import { ToggleCatalogPanel } from "./ToggleCatalogPanel";

const CATEGORY_LABELS: Record<SignalCategory, string> = {
  cross: "Crosses",
  divergence: "Divergence",
  pattern: "Chart Patterns",
};

const CATEGORY_ORDER: readonly SignalCategory[] = ["cross", "divergence", "pattern"];

type Props = {
  enabled: ReadonlySet<string>;
  countByKind: Record<string, number>;
  onToggle: (kind: string) => void;
};

export function SignalsPanel({ enabled, countByKind, onToggle }: Props) {
  return (
    <ToggleCatalogPanel
      title="Signals"
      items={SIGNAL_CATALOG}
      categoryOrder={CATEGORY_ORDER}
      categoryLabels={CATEGORY_LABELS}
      enabled={enabled}
      onToggle={onToggle}
      renderBadge={(def) => {
        if (!enabled.has(def.kind)) return null;
        const count = countByKind[def.kind] ?? 0;
        return count > 0 ? <span className="signal-count">{count}</span> : null;
      }}
    />
  );
}
