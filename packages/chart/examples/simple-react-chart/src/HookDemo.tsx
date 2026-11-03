/**
 * Minimal example of `useTrendChart` — the hook-based entry point.
 *
 * Demonstrates the imperative pattern: take the live `ChartInstance`
 * from the hook and drive it from your own `useEffect`. Same chart,
 * different entry point than the `<TrendChart>` component in App.tsx.
 *
 * Shown by the "Hook" tab in the demo header (see App.tsx).
 */

import { registerDrawingTools } from "@trendcraft/chart/features";
import { useTrendChart } from "@trendcraft/chart/react";
import { useEffect, useState } from "react";
import { sma } from "trendcraft";
import sampleData from "../../simple-chart/data.json";

const candles = sampleData.slice(0, 200);
const indicators = [sma(candles, { period: 20 })];

export function HookDemo({ theme }: { theme: "dark" | "light" }) {
  const { containerRef, chart } = useTrendChart({
    candles,
    indicators,
    theme,
    // Open on the latest bars rather than fitting all of them
    fitOnLoad: false,
    options: { watermark: "HOOK" },
    features: [registerDrawingTools],
  });

  const [lastEvent, setLastEvent] = useState<string>("—");

  // Imperative hookups land here: drawing tool, live feed, custom plugin
  // registration, etc. `chart` is `null` before mount and the real
  // instance after, so this effect fires exactly once per mount.
  useEffect(() => {
    if (!chart) return;

    chart.setDrawingTool("hline");

    const onDrawing = (d: unknown) => {
      setLastEvent(`drawingComplete ${JSON.stringify(d).slice(0, 80)}`);
    };
    chart.on("drawingComplete", onDrawing);

    return () => {
      chart.off("drawingComplete", onDrawing);
      chart.setDrawingTool(null);
    };
  }, [chart]);

  return (
    <div className="hook-demo">
      <div className="hook-demo-info">
        useTrendChart demo — click the chart to place a horizontal line ·{" "}
        <span className="muted">last:</span> {lastEvent}
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
