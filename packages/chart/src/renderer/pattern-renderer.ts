/**
 * Pattern Renderer — Draws chart patterns (double top, H&S, harmonics, etc.)
 * from trendcraft's PatternSignal data.
 */

import type { DataLayer } from "../core/data-layer";
import { autoFormatPrice } from "../core/format";
import type { PriceScale, TimeScale } from "../core/scale";
import type { PaneRect, ThemeColors } from "../core/types";

/** Compatible with trendcraft PatternSignal */
export type ChartPatternSignal = {
  time: number;
  type: string;
  pattern: {
    startTime: number;
    endTime: number;
    keyPoints: { time: number; index: number; price: number; label: string }[];
    neckline?: { startPrice: number; endPrice: number; slope: number; currentPrice: number };
    target?: number;
    stopLoss?: number;
    height?: number;
  };
  confidence: number;
  confirmed: boolean;
};

const PATTERN_COLORS: Record<string, string> = {
  bullish: "#26a69a",
  bearish: "#ef5350",
  neutral: "#FF9800",
};

function getPatternDirection(type: string): string {
  if (
    type.includes("bullish") ||
    type.includes("inverse") ||
    type.includes("bottom") ||
    type.includes("ascending") ||
    type.includes("bull") ||
    type.includes("falling_wedge")
  ) {
    return "bullish";
  }
  if (
    type.includes("bearish") ||
    type.includes("top") ||
    type.includes("descending") ||
    type.includes("bear") ||
    type.includes("rising_wedge")
  ) {
    return "bearish";
  }
  return "neutral";
}

/**
 * Render pattern signals on the main pane.
 */
export function renderPatterns(
  ctx: CanvasRenderingContext2D,
  patterns: readonly ChartPatternSignal[],
  paneRects: readonly PaneRect[],
  priceScales: Map<string, PriceScale>,
  timeScale: TimeScale,
  dataLayer: DataLayer,
  theme: ThemeColors,
  fontSize: number,
): void {
  if (patterns.length === 0) return;

  const mainPane = paneRects.find((p) => p.id === "main");
  if (!mainPane) return;

  const ps = priceScales.get("main");
  if (!ps) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mainPane.x, mainPane.y, mainPane.width, mainPane.height);
  ctx.clip();

  for (const signal of patterns) {
    const direction = getPatternDirection(signal.type);
    const color = PATTERN_COLORS[direction];
    const keyPoints = signal.pattern.keyPoints;

    if (keyPoints.length < 2) continue;

    // Draw pattern outline (connect key points)
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();

    for (let i = 0; i < keyPoints.length; i++) {
      const kp = keyPoints[i];
      const x = timeScale.indexToX(kp.index);
      const y = ps.priceToY(kp.price) + mainPane.y;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Key point dots with labels
    ctx.globalAlpha = 1;
    for (const kp of keyPoints) {
      const x = timeScale.indexToX(kp.index);
      const y = ps.priceToY(kp.price) + mainPane.y;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = theme.text;
      ctx.font = `${fontSize - 1}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = direction === "bearish" ? "top" : "bottom";
      ctx.fillText(kp.label, x, y + (direction === "bearish" ? 6 : -6));
    }

    // Neckline
    if (signal.pattern.neckline) {
      const nl = signal.pattern.neckline;
      const startIdx = dataLayer.indexAtTime(signal.pattern.startTime);
      const endIdx = dataLayer.indexAtTime(signal.pattern.endTime);
      const x1 = timeScale.indexToX(startIdx);
      const x2 = timeScale.indexToX(endIdx + 10); // Extend a bit
      const y1 = ps.priceToY(nl.startPrice) + mainPane.y;
      const y2 = ps.priceToY(nl.endPrice) + mainPane.y;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Target price line
    if (signal.pattern.target) {
      const lastKp = keyPoints[keyPoints.length - 1];
      const x = timeScale.indexToX(lastKp.index);
      const targetY = ps.priceToY(signal.pattern.target) + mainPane.y;

      ctx.strokeStyle = direction === "bullish" ? "#26a69a" : "#ef5350";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, targetY);
      ctx.lineTo(x + 60, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = theme.textSecondary;
      ctx.font = `${fontSize - 1}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`T:${autoFormatPrice(signal.pattern.target)}`, x + 64, targetY);
    }

    // Pattern name + confidence label
    const midKp = keyPoints[Math.floor(keyPoints.length / 2)];
    const labelX = timeScale.indexToX(midKp.index);
    const labelY = ps.priceToY(midKp.price) + mainPane.y - 16;
    const patternName = signal.type.replace(/_/g, " ");

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${patternName} (${signal.confidence}%)`, labelX, labelY);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
