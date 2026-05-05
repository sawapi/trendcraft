import { useState } from "react";
import type { GenomeSegment } from "trendcraft";

/**
 * Format a genome value compactly without losing finer-step precision
 * (`0.05`, `0.005`, etc.). `toFixed(1)` collapsed those into "0.1" /
 * "0.0", which is misleading for strategies optimized at sub-decimal
 * step sizes. Approach: integer values render as-is; fractional
 * values show up to 4 decimals with trailing zeros trimmed.
 */
function formatGenomeValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  // Number(...) drops trailing zeros from "0.0500" → "0.05".
  return String(Number(v.toFixed(4)));
}

/**
 * Cool→hot gradient based on the segment's [0, 1] position within its
 * declared search range. Pure math; no theme dependency.
 */
function positionToColor(position: number): string {
  const r = Math.round(60 + position * 170);
  const g = Math.round(120 - position * 80);
  const b = Math.round(220 - position * 180);
  return `rgb(${r}, ${g}, ${b})`;
}

type Props = {
  segments: GenomeSegment[];
  /** Click a segment to drive the panel state (e.g. switch to sensitivity tab). */
  onSegmentClick?: (paramName: string) => void;
};

/**
 * SVG bar chart showing each tunable parameter's `value` placed on a
 * `[0, 1]` axis within its declared range. Hover surfaces the raw
 * value plus the search range; click forwards the param name so the
 * outer panel can react (e.g. switch to the sensitivity tab pre-
 * filtered to that param).
 */
export function GenomeVisualization({ segments, onSegmentClick }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const segmentWidth = 36;
  const segmentHeight = 48;
  const gap = 4;
  const totalWidth = segments.length * (segmentWidth + gap) - gap;
  const svgWidth = Math.max(totalWidth + 16, 100);

  return (
    <div style={{ position: "relative" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${svgWidth} ${segmentHeight + 24}`}
        style={{ display: "block" }}
        role="img"
        aria-label="Strategy genome parameter visualization"
      >
        {segments.map((seg, idx) => {
          const x = 8 + idx * (segmentWidth + gap);
          const isHovered = hoveredIdx === idx;
          return (
            <g
              key={seg.name}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => onSegmentClick?.(seg.name)}
              style={{ cursor: onSegmentClick ? "pointer" : "default" }}
            >
              <rect
                x={x}
                y={4}
                width={segmentWidth}
                height={segmentHeight}
                rx={6}
                ry={6}
                fill={positionToColor(seg.position)}
                stroke={isHovered ? "var(--accent, #4a9eff)" : "transparent"}
                strokeWidth={2}
                opacity={isHovered ? 1 : 0.85}
              />
              <text
                x={x + segmentWidth / 2}
                y={segmentHeight + 18}
                textAnchor="middle"
                fill="var(--text-secondary, #888)"
                fontSize={9}
              >
                {seg.name.length > 6 ? `${seg.name.slice(0, 5)}..` : seg.name}
              </text>
              <text
                x={x + segmentWidth / 2}
                y={segmentHeight / 2 + 6}
                textAnchor="middle"
                fill="white"
                fontSize={11}
                fontWeight={600}
              >
                {formatGenomeValue(seg.value)}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredIdx !== null && segments[hoveredIdx] && (
        // Guard `segments[hoveredIdx]` against the case where a new
        // optimization run replaces `segments` with a shorter array
        // while a hover is active — `hoveredIdx` survives the prop
        // change and `onMouseLeave` won't fire until the user moves,
        // so we'd otherwise crash on `.name` before the tooltip can
        // be dismissed.
        <div
          style={{
            position: "absolute",
            top: -4,
            left: "50%",
            transform: "translate(-50%, -100%)",
            background: "var(--bg-primary, #1a1a1a)",
            border: "1px solid var(--border, #333)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: "var(--font-xs)",
            color: "var(--text-primary, #e0e0e0)",
            whiteSpace: "nowrap",
            zIndex: 10,
            pointerEvents: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{segments[hoveredIdx].name}</div>
          <div>
            Value: <strong>{segments[hoveredIdx].value}</strong>
          </div>
          <div style={{ color: "var(--text-secondary, #888)" }}>
            Range: {segments[hoveredIdx].min} – {segments[hoveredIdx].max}
          </div>
        </div>
      )}
    </div>
  );
}
