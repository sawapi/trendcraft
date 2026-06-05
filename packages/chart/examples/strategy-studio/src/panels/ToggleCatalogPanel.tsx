import type { ReactNode } from "react";

/**
 * Generic catalog entry shape used by SignalsPanel, PluginsPanel, and any
 * future "categorized toggle list" panel. Each domain narrows `category` to
 * its own union and adds a domain-specific payload alongside this base.
 */
export type CatalogEntry<C extends string = string> = {
  kind: string;
  label: string;
  category: C;
  description: string;
};

type Props<C extends string> = {
  title: string;
  items: readonly CatalogEntry<C>[];
  categoryOrder: readonly C[];
  categoryLabels: Record<C, string>;
  enabled: ReadonlySet<string>;
  onToggle: (kind: string) => void;
  /** Optional right-side badge per row (e.g. signal count, warning chip). */
  renderBadge?: (entry: CatalogEntry<C>) => ReactNode;
  /** Optional override for the row tooltip; defaults to `entry.description`. */
  tooltipFor?: (entry: CatalogEntry<C>) => string;
  /** Optional row class modifier (e.g. "unavailable") per entry. */
  classNameFor?: (entry: CatalogEntry<C>) => string | undefined;
};

/**
 * Categorized checkbox-style toggle list. The presentation surface for
 * SignalsPanel and PluginsPanel — both panels now collapse to a thin
 * wrapper that supplies the catalog and per-row badge.
 */
export function ToggleCatalogPanel<C extends string>({
  title,
  items,
  categoryOrder,
  categoryLabels,
  enabled,
  onToggle,
  renderBadge,
  tooltipFor,
  classNameFor,
}: Props<C>) {
  const grouped = new Map<C, CatalogEntry<C>[]>();
  for (const def of items) {
    const list = grouped.get(def.category) ?? [];
    list.push(def);
    grouped.set(def.category, list);
  }

  return (
    <>
      <div className="pane-header">{title}</div>
      {categoryOrder.map((cat) => {
        const entries = grouped.get(cat);
        if (!entries?.length) return null;
        return (
          <div key={cat}>
            <div className="section-title">{categoryLabels[cat]}</div>
            <ul className="signals-list">
              {entries.map((def) => {
                const isOn = enabled.has(def.kind);
                const extra = classNameFor?.(def);
                return (
                  <li
                    key={def.kind}
                    className={`signal-item${isOn ? " active" : ""}${extra ? ` ${extra}` : ""}`}
                  >
                    <button
                      type="button"
                      className="signal-toggle"
                      onClick={() => onToggle(def.kind)}
                      aria-pressed={isOn}
                      title={tooltipFor?.(def) ?? def.description}
                    >
                      <span className={`signal-check${isOn ? " on" : ""}`} aria-hidden="true">
                        {isOn ? "✓" : ""}
                      </span>
                      <span className="signal-name">{def.label}</span>
                      {renderBadge?.(def)}
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
