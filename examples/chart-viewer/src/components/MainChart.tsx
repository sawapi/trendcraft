/**
 * Main chart component (candlestick + volume + subcharts + overlays)
 */

import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import { useChartStore } from "../store/chartStore";
import { useIndicators } from "../hooks/useIndicators";
import { useOverlays } from "../hooks/useOverlays";
import { useSignals } from "../hooks/useSignals";
import { buildChartOption } from "../utils/chartConfig";

/**
 * Calculate chart height based on subchart count
 * Base height (main + volume + dataZoom) + additional height per subchart
 */
function calculateChartHeight(subchartCount: number): number {
  // main(300) + gap(10) + volume(80) + gap(10) + dataZoom(30) + dataZoomGap(20) + margins(60)
  const baseHeight = 510;
  const subchartHeight = 116; // label(26) + height(70) + gap(20)
  return baseHeight + subchartCount * subchartHeight;
}

export function MainChart() {
  const currentCandles = useChartStore((state) => state.currentCandles);
  const enabledIndicators = useChartStore((state) => state.enabledIndicators);
  const enabledOverlays = useChartStore((state) => state.enabledOverlays);
  const enabledSignals = useChartStore((state) => state.enabledSignals);
  const backtestResult = useChartStore((state) => state.backtestResult);

  const indicators = useIndicators(currentCandles, enabledIndicators);
  const overlays = useOverlays(currentCandles, enabledOverlays);
  const signals = useSignals(currentCandles, enabledSignals);

  const trades = backtestResult?.trades ?? null;

  const chartHeight = useMemo(() => {
    return calculateChartHeight(enabledIndicators.length);
  }, [enabledIndicators.length]);

  const option = useMemo(() => {
    return buildChartOption(
      currentCandles,
      indicators,
      enabledIndicators,
      signals,
      enabledSignals,
      trades,
      overlays,
      enabledOverlays,
      chartHeight
    );
  }, [currentCandles, indicators, enabledIndicators, signals, enabledSignals, trades, overlays, enabledOverlays, chartHeight]);

  if (currentCandles.length === 0) {
    return null;
  }

  return (
    <div className="main-chart" style={{ height: chartHeight }}>
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}
