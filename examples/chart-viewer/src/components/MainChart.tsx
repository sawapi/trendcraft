/**
 * Main chart component (candlestick + volume + subcharts + overlays)
 */

import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import ReactECharts from "echarts-for-react";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { useChartStore } from "../store/chartStore";
import { useIndicators } from "../hooks/useIndicators";
import { useOverlays } from "../hooks/useOverlays";
import { useSignals } from "../hooks/useSignals";
import { buildChartOption } from "../utils/chartConfig";

// Register SVG renderer for SVG export support
echarts.use([SVGRenderer]);

export interface MainChartHandle {
  exportPNG: () => void;
  exportSVG: () => void;
}

/**
 * Trigger a file download from a data URL
 */
function downloadDataURL(dataURL: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = filename;
  link.click();
}

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

export const MainChart = forwardRef<MainChartHandle>(function MainChart(_props, ref) {
  const chartRef = useRef<ReactECharts>(null);

  const currentCandles = useChartStore((state) => state.currentCandles);
  const enabledIndicators = useChartStore((state) => state.enabledIndicators);
  const enabledOverlays = useChartStore((state) => state.enabledOverlays);
  const enabledSignals = useChartStore((state) => state.enabledSignals);
  const backtestResult = useChartStore((state) => state.backtestResult);
  const indicatorParams = useChartStore((state) => state.indicatorParams);
  const currentFundamentals = useChartStore((state) => state.currentFundamentals);
  const zoomRange = useChartStore((state) => state.zoomRange);
  const setZoomRange = useChartStore((state) => state.setZoomRange);
  const fileName = useChartStore((state) => state.fileName);

  const indicators = useIndicators(currentCandles, enabledIndicators, currentFundamentals);
  const overlays = useOverlays(currentCandles, enabledOverlays);
  const signals = useSignals(currentCandles, enabledSignals, indicatorParams);

  const trades = backtestResult?.trades ?? null;

  const baseName = fileName?.replace(/\.[^.]+$/, "") ?? "chart";

  const exportPNG = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;

    const dataURL = instance.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#1a1a2e",
    });
    downloadDataURL(dataURL, `chart-${baseName}.png`);
  }, [baseName]);

  const exportSVG = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;

    const width = instance.getWidth();
    const height = instance.getHeight();

    // Create an offscreen SVG renderer instance with the same option
    const container = document.createElement("div");
    Object.assign(container.style, {
      width: `${width}px`,
      height: `${height}px`,
      position: "absolute",
      left: "-9999px",
    });
    document.body.appendChild(container);

    const svgInstance = echarts.init(container, undefined, {
      renderer: "svg",
      width,
      height,
    });
    svgInstance.setOption(instance.getOption());

    const dataURL = svgInstance.getDataURL({
      type: "svg",
      backgroundColor: "#1a1a2e",
    });

    svgInstance.dispose();
    document.body.removeChild(container);

    downloadDataURL(dataURL, `chart-${baseName}.svg`);
  }, [baseName]);

  useImperativeHandle(ref, () => ({ exportPNG, exportSVG }), [exportPNG, exportSVG]);

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
        ref={chartRef}
        key={chartKey}
        option={option}
        style={{ height: "100%", width: "100%" }}
        notMerge={true}
        lazyUpdate={true}
        onEvents={onEvents}
      />
    </div>
  );
});
