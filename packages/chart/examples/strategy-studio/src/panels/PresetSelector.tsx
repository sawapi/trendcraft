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

type Props = {
  regime: RegimeSummary;
  /** How many instances of each kind are currently mounted. */
  instanceCountsByKind: Record<string, number>;
  /** Row click — empty kind adds one, non-empty kind clears all. */
  onToggle: (kind: string) => void;
  /** +N chip click — append another instance of the same kind. */
  onAdd: (kind: string) => void;
};

export function PresetSelector({ regime, instanceCountsByKind, onToggle, onAdd }: Props) {
  const [category, setCategory] = useState<IndicatorCategory | "all">("all");
  const [hovered, setHovered] = useState<string | null>(null);

  const suggestions = useMemo(
    () => localStudioAPI.suggestPresets(regime.manifestRegime),
    [regime.manifestRegime],
  );

  const browse = useMemo(() => {
    const filter = category === "all" ? undefined : { category };
    return localStudioAPI.listIndicators(filter);
  }, [category]);

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

      <div className="section-title">Suggested for this regime</div>
      <PresetList
        items={suggestions}
        instanceCountsByKind={instanceCountsByKind}
        hovered={hovered}
        onHover={setHovered}
        onToggle={onToggle}
        onAdd={onAdd}
        emptyText="No manifest entries match this regime yet."
      />

      <div className="section-title">Browse all indicators</div>
      <select
        className="category-select"
        value={category}
        onChange={(e) => setCategory(e.target.value as IndicatorCategory | "all")}
      >
        <option value="all">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <PresetList
        items={browse}
        instanceCountsByKind={instanceCountsByKind}
        hovered={hovered}
        onHover={setHovered}
        onToggle={onToggle}
        onAdd={onAdd}
        emptyText="No indicators in this category."
      />
    </>
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
              <span className="preset-name">{m.displayName}</span>
              <span className="preset-kind">{m.kind}</span>
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
