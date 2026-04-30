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
  activeKinds: ReadonlySet<string>;
  onToggle: (kind: string) => void;
};

export function PresetSelector({ regime, activeKinds, onToggle }: Props) {
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
        activeKinds={activeKinds}
        hovered={hovered}
        onHover={setHovered}
        onToggle={onToggle}
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
        activeKinds={activeKinds}
        hovered={hovered}
        onHover={setHovered}
        onToggle={onToggle}
        emptyText="No indicators in this category."
      />
    </>
  );
}

type ListProps = {
  items: IndicatorManifest[];
  activeKinds: ReadonlySet<string>;
  hovered: string | null;
  onHover: (kind: string | null) => void;
  onToggle: (kind: string) => void;
  emptyText: string;
};

function PresetList({ items, activeKinds, hovered, onHover, onToggle, emptyText }: ListProps) {
  if (items.length === 0) return <div className="empty">{emptyText}</div>;

  return (
    <ul className="preset-list">
      {items.map((m) => {
        const active = activeKinds.has(m.kind);
        const renderable = localStudioAPI.getIndicatorPreset(m.kind) !== undefined;
        const className = `preset-item${active ? " active" : ""}${renderable ? "" : " disabled"}`;
        return (
          <li
            key={m.kind}
            className={className}
            onClick={renderable ? () => onToggle(m.kind) : undefined}
            onMouseEnter={() => onHover(m.kind)}
            onMouseLeave={() => onHover(null)}
            title={renderable ? undefined : "No chart preset (event-only or regime classifier)"}
          >
            <span className="preset-name">{m.displayName}</span>
            <span className="preset-kind">{m.kind}</span>
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
