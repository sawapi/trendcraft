import { useMemo, useState } from "react";
import type { IndicatorCategory, IndicatorManifest, MarketRegime } from "trendcraft/manifest";
import type { RegimeSummary } from "../lib/studio-api";
import { localStudioAPI } from "../lib/studio-api";

const CATEGORIES: IndicatorCategory[] = [
  "moving-average",
  "momentum",
  "volatility",
  "trend",
  "volume",
  "price",
  "session",
  "regime",
  "smc",
  "wyckoff",
];

const CATEGORY_LABEL: Record<IndicatorCategory, string> = {
  "moving-average": "Moving Averages",
  momentum: "Momentum",
  volatility: "Volatility",
  trend: "Trend",
  volume: "Volume",
  price: "Price",
  session: "Session",
  regime: "Regime",
  smc: "SMC",
  wyckoff: "Wyckoff",
};

type Props = {
  regime: RegimeSummary;
  /** How many instances of each kind are currently mounted. */
  instanceCountsByKind: Record<string, number>;
  /** Row click — empty kind adds one, non-empty kind clears all. */
  onToggle: (kind: string) => void;
  /** +N chip click — append another instance of the same kind. */
  onAdd: (kind: string) => void;
};

function matchesQuery(m: IndicatorManifest, q: string): boolean {
  if (!q) return true;
  const haystack = [m.displayName, m.kind, m.oneLiner, m.whenToUse.join(" "), m.signals.join(" ")]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/**
 * `suggestForRegime` returns every manifest entry whose `marketRegime`
 * array includes the active regime — for `trending` that's ~73 entries,
 * which defeats the "suggestion" framing and pushes the browse-by-category
 * section below the fold. Cap the default view so the panel surfaces a
 * short shortlist; users can opt in to the full set with "Show all".
 */
const SUGGESTED_TOP_N = 10;

export function PresetSelector({ regime, instanceCountsByKind, onToggle, onAdd }: Props) {
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  // Default: regime suggestions expanded; browse categories collapsed (the
  // user opens what they need). Search overrides — when active every
  // category with a match is expanded.
  const [expandedCats, setExpandedCats] = useState<Set<IndicatorCategory>>(() => new Set());
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  const suggestions = useMemo(
    () => localStudioAPI.suggestPresets(regime.manifestRegime),
    [regime.manifestRegime],
  );

  const allByCategory = useMemo(() => {
    const map = new Map<IndicatorCategory, IndicatorManifest[]>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const m of localStudioAPI.listIndicators()) {
      map.get(m.category)?.push(m);
    }
    return map;
  }, []);

  const q = search.trim().toLowerCase();
  const isSearching = q.length > 0;

  const filteredSuggestions = useMemo(
    () => suggestions.filter((m) => matchesQuery(m, q)),
    [suggestions, q],
  );

  const filteredByCategory = useMemo(() => {
    const out = new Map<IndicatorCategory, IndicatorManifest[]>();
    for (const cat of CATEGORIES) {
      const items = allByCategory.get(cat) ?? [];
      out.set(
        cat,
        items.filter((m) => matchesQuery(m, q)),
      );
    }
    return out;
  }, [allByCategory, q]);

  const totalMatches = useMemo(() => {
    let n = 0;
    for (const items of filteredByCategory.values()) n += items.length;
    return n;
  }, [filteredByCategory]);

  const toggleCat = (cat: IndicatorCategory) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <>
      <div className="pane-header">Preset Selector</div>

      <div className="regime-banner">
        <h3>Detected Regime</h3>
        <div className="regime-row">
          <span className={`regime-chip ${regime.manifestRegime}`}>{regime.manifestRegime}</span>
        </div>
        <div className="regime-detail">
          {regime.reasons.map((r) => (
            <div key={r}>· {r}</div>
          ))}
        </div>
      </div>

      <div className="preset-search">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search indicators…"
          aria-label="Search indicators"
        />
        {isSearching && (
          <span className="preset-search-count">
            {totalMatches} match{totalMatches === 1 ? "" : "es"}
          </span>
        )}
      </div>

      <CategoryHeader
        label={`Suggested for ${regime.manifestRegime}`}
        count={filteredSuggestions.length}
        expanded={suggestionsOpen}
        onToggle={() => setSuggestionsOpen((v) => !v)}
      />
      {suggestionsOpen && (
        <>
          <PresetList
            items={
              isSearching || showAllSuggestions
                ? filteredSuggestions
                : filteredSuggestions.slice(0, SUGGESTED_TOP_N)
            }
            instanceCountsByKind={instanceCountsByKind}
            hovered={hovered}
            onHover={setHovered}
            onToggle={onToggle}
            onAdd={onAdd}
            emptyText={
              isSearching
                ? "No matches in regime suggestions."
                : "No manifest entries match this regime yet."
            }
          />
          {!isSearching && filteredSuggestions.length > SUGGESTED_TOP_N && (
            <button
              type="button"
              className="preset-show-all"
              onClick={() => setShowAllSuggestions((v) => !v)}
            >
              {showAllSuggestions
                ? `Show top ${SUGGESTED_TOP_N}`
                : `Show all (${filteredSuggestions.length})`}
            </button>
          )}
        </>
      )}

      {CATEGORIES.map((cat) => {
        const items = filteredByCategory.get(cat) ?? [];
        if (isSearching && items.length === 0) return null;
        const expanded = isSearching || expandedCats.has(cat);
        return (
          <div key={cat}>
            <CategoryHeader
              label={CATEGORY_LABEL[cat]}
              count={items.length}
              expanded={expanded}
              onToggle={() => toggleCat(cat)}
            />
            {expanded && (
              <PresetList
                items={items}
                instanceCountsByKind={instanceCountsByKind}
                hovered={hovered}
                onHover={setHovered}
                onToggle={onToggle}
                onAdd={onAdd}
                emptyText="No indicators in this category."
              />
            )}
          </div>
        );
      })}
    </>
  );
}

type CategoryHeaderProps = {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
};

function CategoryHeader({ label, count, expanded, onToggle }: CategoryHeaderProps) {
  return (
    <button type="button" className="preset-cat-header" onClick={onToggle} aria-expanded={expanded}>
      <span className="preset-cat-label">
        <span className="preset-cat-chevron">{expanded ? "▼" : "▶"}</span>
        {label}
      </span>
      <span className="preset-cat-count">{count}</span>
    </button>
  );
}

type ListProps = {
  items: IndicatorManifest[];
  instanceCountsByKind: Record<string, number>;
  hovered: string | null;
  onHover: (kind: string | null) => void;
  onToggle: (kind: string) => void;
  onAdd: (kind: string) => void;
  emptyText: string;
};

function PresetList({
  items,
  instanceCountsByKind,
  hovered,
  onHover,
  onToggle,
  onAdd,
  emptyText,
}: ListProps) {
  if (items.length === 0) return <div className="empty">{emptyText}</div>;

  return (
    <ul className="preset-list">
      {items.map((m) => {
        const count = instanceCountsByKind[m.kind] ?? 0;
        const renderable = localStudioAPI.getIndicatorPreset(m.kind) !== undefined;
        const className = `preset-item${count > 0 ? " active" : ""}${renderable ? "" : " disabled"}`;
        const tip = !renderable
          ? "No chart preset (event-only or regime classifier)"
          : count > 0
            ? `Click to remove all ${m.displayName}; use +N to add another`
            : `Click to add ${m.displayName}`;
        return (
          <li
            key={m.kind}
            className={className}
            onMouseEnter={() => onHover(m.kind)}
            onMouseLeave={() => onHover(null)}
          >
            <button
              type="button"
              className="preset-toggle"
              onClick={renderable ? () => onToggle(m.kind) : undefined}
              disabled={!renderable}
              aria-pressed={count > 0}
              title={tip}
            >
              <span className="preset-name-row">
                <span className="preset-name">{m.displayName}</span>
                <span className="preset-kind">{m.kind}</span>
              </span>
              <span className="preset-oneliner">{m.oneLiner}</span>
            </button>
            {renderable && count > 0 && (
              <button
                type="button"
                className="preset-count"
                onClick={() => onAdd(m.kind)}
                aria-label={`Add another ${m.displayName}`}
                title={`Add another ${m.displayName} instance`}
              >
                +{count}
              </button>
            )}
            {hovered === m.kind && <ManifestTooltip manifest={m} />}
          </li>
        );
      })}
    </ul>
  );
}

function ManifestTooltip({ manifest }: { manifest: IndicatorManifest }) {
  return (
    <div className="preset-tooltip">
      <h4>{manifest.displayName}</h4>
      <div style={{ color: "#787b86", fontSize: 11, marginBottom: 4 }}>{manifest.oneLiner}</div>
      {manifest.whenToUse.length > 0 && <Section label="When to use" items={manifest.whenToUse} />}
      {manifest.pitfalls.length > 0 && <Section label="Pitfalls" items={manifest.pitfalls} />}
      <div className="preset-tooltip-section">
        <div className="preset-tooltip-label">Regimes</div>
        <RegimeChips regimes={manifest.marketRegime} />
      </div>
    </div>
  );
}

function Section({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="preset-tooltip-section">
      <div className="preset-tooltip-label">{label}</div>
      <ul>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function RegimeChips({ regimes }: { regimes: MarketRegime[] }) {
  return (
    <div className="regime-row" style={{ marginTop: 4 }}>
      {regimes.map((r) => (
        <span key={r} className={`regime-chip ${r}`}>
          {r}
        </span>
      ))}
    </div>
  );
}
