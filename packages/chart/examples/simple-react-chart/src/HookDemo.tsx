/**
 * Minimal example of `useTrendChart` — the hook-based entry point.
 *
 * Demonstrates the imperative pattern: take the live `ChartInstance`
 * from the hook and drive it from your own `useEffect`. Same chart,
 * different entry point than the `<TrendChart>` component in App.tsx.
 *
 * This component is not mounted by default — import it from `main.tsx`
 * to see it running, or copy into your own app.
 */

import { useTrendChart } from "@trendcraft/chart/react";
import { useEffect, useState } from "react";
import { sma } from "trendcraft";
import sampleData from "../../simple-chart/data.json";

const candles = sampleData.slice(0, 200);
const indicators = [sma(candles, { period: 20 })];

export function HookDemo() {
  const { containerRef, chart } = useTrendChart({
    candles,
    indicators,
    theme: "dark",
    options: { watermark: "HOOK" },
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: 8,
          background: "#1e222d",
          color: "#d1d4dc",
          fontSize: 12,
          fontFamily: "monospace",
        }}
      >
        useTrendChart demo — click chart to place horizontal line · last: {lastEvent}
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
