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
  const indicatorParams = useChartStore((state) => state.indicatorParams);
  const currentFundamentals = useChartStore((state) => state.currentFundamentals);
  const zoomRange = useChartStore((state) => state.zoomRange);
  const setZoomRange = useChartStore((state) => state.setZoomRange);

  const indicators = useIndicators(currentCandles, enabledIndicators, currentFundamentals);
  const overlays = useOverlays(currentCandles, enabledOverlays);
  const signals = useSignals(currentCandles, enabledSignals, indicatorParams);

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
      chartHeight,
      indicatorParams,
      zoomRange
    );
  }, [currentCandles, indicators, enabledIndicators, signals, enabledSignals, trades, overlays, enabledOverlays, chartHeight, indicatorParams, zoomRange]);

  // Handle dataZoom events from chart interaction
  const onEvents = useMemo(() => ({
    datazoom: (params: { start?: number; end?: number; batch?: Array<{ start?: number; end?: number }> }) => {
      // dataZoom can fire with different structures
      let start: number | undefined;
      let end: number | undefined;

      if (params.batch && params.batch.length > 0) {
        start = params.batch[0].start;
        end = params.batch[0].end;
      } else {
        start = params.start;
        end = params.end;
      }

      if (start !== undefined && end !== undefined) {
        setZoomRange({ start, end });
      }
    },
  }), [setZoomRange]);

  if (currentCandles.length === 0) {
    return null;
  }

  // Use candle count as key to force re-mount when data changes
  const chartKey = `chart-${currentCandles.length}`;

  return (
    <div className="main-chart" style={{ height: chartHeight }}>
      <ReactECharts
        key={chartKey}
        option={option}
        style={{ height: "100%", width: "100%" }}
        notMerge={true}
        lazyUpdate={true}
        onEvents={onEvents}
      />
    </div>
  );
}
