/**
 * Genome Visualization - SVG segment bar showing parameter DNA
 */

import { useState } from "react";
import type { GenomeSegment } from "../../utils/strategyDna";

/**
 * Interpolate between blue and red based on position (0-1)
 */
function positionToColor(position: number): string {
  // Blue (cool) → Red (hot)
  const r = Math.round(60 + position * 170);
  const g = Math.round(120 - position * 80);
  const b = Math.round(220 - position * 180);
  return `rgb(${r}, ${g}, ${b})`;
}

interface Props {
  segments: GenomeSegment[];
  onSegmentClick?: (paramName: string) => void;
}

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
              style={{ cursor: "pointer" }}
            >
              <rect
                x={x}
                y={4}
                width={segmentWidth}
                height={segmentHeight}
                rx={6}
                ry={6}
                fill={positionToColor(seg.position)}
                stroke={isHovered ? "var(--accent-primary)" : "transparent"}
                strokeWidth={2}
                opacity={isHovered ? 1 : 0.85}
              />
              <text
                x={x + segmentWidth / 2}
                y={segmentHeight + 18}
                textAnchor="middle"
                fill="var(--text-secondary)"
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
                {seg.value % 1 === 0 ? seg.value : seg.value.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredIdx !== null && (
        <div
          style={{
            position: "absolute",
            top: -4,
            left: "50%",
            transform: "translate(-50%, -100%)",
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: "var(--font-xs)",
            color: "var(--text-primary)",
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
          <div style={{ color: "var(--text-secondary)" }}>
            Range: {segments[hoveredIdx].min} - {segments[hoveredIdx].max}
          </div>
        </div>
      )}
    </div>
  );
}
