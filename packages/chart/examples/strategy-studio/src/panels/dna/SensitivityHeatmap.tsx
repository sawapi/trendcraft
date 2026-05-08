import type { SensitivityData } from "trendcraft";

/**
 * Linear interpolation between blue (low) and red (high) for a metric
 * value normalized to [0, 1]. Mirrors echarts-viewer's color palette
 * but as plain CSS so this panel pulls in no charting dependency —
 * keeps Studio's bundle small.
 */
function metricToColor(normalized: number): string {
  // Normalized in [0, 1]: 0 = coldest, 1 = hottest.
  const palette = [
    [49, 54, 149], // #313695
    [69, 117, 180], // #4575b4
    [116, 173, 209], // #74add1
    [171, 217, 233], // #abd9e9
    [254, 224, 144], // #fee090
    [253, 174, 97], // #fdae61
    [244, 109, 67], // #f46d43
    [215, 48, 39], // #d73027
  ];
  const t = Math.max(0, Math.min(1, normalized));
  const idx = t * (palette.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  const a = palette[lo];
  const b = palette[hi];
  const r = Math.round(a[0] + (b[0] - a[0]) * frac);
  const g = Math.round(a[1] + (b[1] - a[1]) * frac);
  const bl = Math.round(a[2] + (b[2] - a[2]) * frac);
  return `rgb(${r}, ${g}, ${bl})`;
}

type Props = {
  data: SensitivityData;
  selectedParam: string | null;
  selectedParamPair: [string, string] | null;
  onSelectParam: (name: string | null) => void;
  onSelectParamPair: (pair: [string, string] | null) => void;
};

/**
 * Sensitivity visualization without an external chart library: a bar
 * list for the 1D view and an HTML table for the 2D pairwise view.
 * The viewer's panel uses echarts; Studio drops that dependency to
 * keep the bundle compact and renders the same data with CSS.
 */
export function SensitivityHeatmap({
  data,
  selectedParam,
  selectedParamPair,
  onSelectParam,
  onSelectParamPair,
}: Props) {
  const paramNames = data.singleParams.map((s) => s.paramName);
  const showAny = selectedParam !== null || selectedParamPair !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Single-param selector */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {paramNames.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              onSelectParamPair(null);
              onSelectParam(selectedParam === name ? null : name);
            }}
            style={{
              padding: "3px 8px",
              fontSize: "var(--font-xs)",
              background:
                selectedParam === name ? "var(--accent, #4a9eff)" : "var(--bg-tertiary, #222)",
              color: selectedParam === name ? "#fff" : "var(--text-secondary, #888)",
              border: "1px solid var(--border, #333)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Pairwise selector */}
      {paramNames.length >= 2 && data.pairwise.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: "var(--text-secondary, #888)", alignSelf: "center" }}>
            2D:
          </span>
          {data.pairwise.map((pair) => {
            const isSelected =
              selectedParamPair !== null &&
              selectedParamPair[0] === pair.paramX &&
              selectedParamPair[1] === pair.paramY;
            return (
              <button
                key={`${pair.paramX}|${pair.paramY}`}
                type="button"
                onClick={() => {
                  onSelectParam(null);
                  onSelectParamPair(isSelected ? null : [pair.paramX, pair.paramY]);
                }}
                style={{
                  padding: "2px 6px",
                  fontSize: 9,
                  background: isSelected
                    ? "var(--accent-secondary, #ff9800)"
                    : "var(--bg-tertiary, #222)",
                  color: isSelected ? "#fff" : "var(--text-secondary, #888)",
                  border: "1px solid var(--border, #333)",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                {pair.paramX} × {pair.paramY}
              </button>
            );
          })}
        </div>
      )}

      {!showAny && (
        <div
          style={{
            textAlign: "center",
            padding: 16,
            color: "var(--text-secondary, #888)",
            fontSize: "var(--font-xs)",
          }}
        >
          Select a parameter to view sensitivity
        </div>
      )}

      {/* 1D bar view */}
      {selectedParam !== null && <SingleParamBars data={data} paramName={selectedParam} />}

      {/* 2D heatmap table view */}
      {selectedParamPair !== null && <PairHeatmapTable data={data} pair={selectedParamPair} />}
    </div>
  );
}

function SingleParamBars({ data, paramName }: { data: SensitivityData; paramName: string }) {
  const single = data.singleParams.find((s) => s.paramName === paramName);
  const safeZone = data.safeZones.find((z) => z.paramName === paramName);
  if (!single || single.data.length === 0) return null;

  const max = Math.max(...single.data.map((d) => d.metric));
  const min = Math.min(...single.data.map((d) => d.metric));
  // Normalize bars against absolute span so negative metrics still
  // render with a visible bar (drawdowns etc.).
  const span = max - min || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
      {single.data.map((d) => {
        const inSafeZone = safeZone && d.value >= safeZone.min && d.value <= safeZone.max;
        const widthPct = ((d.metric - min) / span) * 100;
        return (
          <div
            key={d.value}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}
          >
            <span
              style={{
                width: 36,
                color: "var(--text-secondary, #888)",
                fontFamily: "monospace",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {d.value}
            </span>
            <div
              style={{
                flex: 1,
                height: 14,
                background: "var(--bg-primary, #1a1a1a)",
                borderRadius: 2,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(2, widthPct)}%`,
                  height: "100%",
                  background: inSafeZone ? "rgba(0, 200, 100, 0.55)" : "rgba(220, 100, 80, 0.45)",
                }}
              />
            </div>
            <span
              style={{
                width: 56,
                color: "var(--text-primary, #e0e0e0)",
                fontFamily: "monospace",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {d.metric.toFixed(3)}
            </span>
          </div>
        );
      })}
      {safeZone && (
        <div
          style={{
            marginTop: 4,
            fontSize: 9,
            color: "var(--text-secondary, #888)",
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              background: "rgba(0, 200, 100, 0.55)",
              borderRadius: 2,
              display: "inline-block",
            }}
          />
          Safe Zone: {safeZone.min}–{safeZone.max} (top 25%)
        </div>
      )}
    </div>
  );
}

function PairHeatmapTable({
  data,
  pair: [x, y],
}: {
  data: SensitivityData;
  pair: [string, string];
}) {
  const pair = data.pairwise.find((p) => p.paramX === x && p.paramY === y);
  if (!pair || pair.data.length === 0) return null;

  const metricByCell = new Map<string, number>();
  for (const d of pair.data) metricByCell.set(`${d.x}|${d.y}`, d.metric);
  const metricValues = pair.data.map((d) => d.metric);
  const minM = Math.min(...metricValues);
  const maxM = Math.max(...metricValues);
  const span = maxM - minM || 1;

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          borderCollapse: "collapse",
          fontSize: 9,
          color: "var(--text-secondary, #888)",
          marginTop: 4,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                padding: 2,
                textAlign: "right",
                fontWeight: 400,
                color: "var(--text-secondary, #888)",
              }}
            >
              {y}↓ \ {x}→
            </th>
            {pair.xValues.map((xv) => (
              <th
                key={xv}
                style={{
                  padding: "2px 4px",
                  fontFamily: "monospace",
                  fontWeight: 400,
                }}
              >
                {xv}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pair.yValues.map((yv) => (
            <tr key={yv}>
              <th
                scope="row"
                style={{
                  padding: "2px 4px",
                  fontFamily: "monospace",
                  fontWeight: 400,
                  textAlign: "right",
                  color: "var(--text-secondary, #888)",
                }}
              >
                {yv}
              </th>
              {pair.xValues.map((xv) => {
                const m = metricByCell.get(`${xv}|${yv}`);
                if (m === undefined) {
                  return (
                    <td key={xv} style={{ padding: 0 }}>
                      <div style={{ width: 44, height: 22, background: "transparent" }} />
                    </td>
                  );
                }
                const norm = (m - minM) / span;
                return (
                  <td
                    key={xv}
                    title={`${x}=${xv}, ${y}=${yv}: ${m.toFixed(3)}`}
                    style={{
                      padding: 0,
                      width: 44,
                      height: 22,
                      background: metricToColor(norm),
                      color: norm > 0.5 ? "#fff" : "#000",
                      fontFamily: "monospace",
                      textAlign: "center",
                      fontSize: 9,
                    }}
                  >
                    {m.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
