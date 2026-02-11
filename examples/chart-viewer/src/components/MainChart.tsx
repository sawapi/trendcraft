/**
 * Main chart component (candlestick + volume + subcharts + overlays)
 */

import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import ReactECharts from "echarts-for-react";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import type { IndicatorData, PercentileInfo } from "../hooks/useIndicators";
import type { SignalData } from "../hooks/useSignals";
import { useChartStore } from "../store/chartStore";
import { useIndicators } from "../hooks/useIndicators";
import { useOverlays } from "../hooks/useOverlays";
import { useSignals } from "../hooks/useSignals";
import { buildChartOption } from "../utils/chartConfig";

// Register SVG renderer for SVG export support
echarts.use([SVGRenderer]);

export interface SignalSummary {
  cross: {
    date: string;
    type: "golden" | "dead";
    isFake: boolean;
    score: number;
    daysUntilReverse: number | null;
  }[];
  divergence: {
    date: string;
    type: "bullish" | "bearish";
    indicator: string;
    priceChange: [number, number];
    indicatorChange: [number, number];
  }[];
  bbSqueeze: {
    date: string;
    bandwidth: number;
    percentile: number;
  }[];
}

export interface FundamentalSummary {
  per: { current: number; sma20: number | null; percentile: number | null; level: string | null } | null;
  pbr: { current: number; sma20: number | null; percentile: number | null; level: string | null } | null;
  roe: { current: number; sma20: number | null; percentile: number | null; level: string | null } | null;
}

export interface MainChartHandle {
  exportPNG: () => void;
  exportSVG: () => void;
  getBase64PNG: () => string | null;
  getReadings: () => Record<string, number | number[] | null>;
  getTimeSeries: (count: number) => Record<string, unknown>[];
  getSignalSummary: () => SignalSummary | null;
  getFundamentalSummary: () => FundamentalSummary | null;
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

  // Keep refs to latest data so imperative handle methods can access them
  const signalsRef = useRef<SignalData>(signals);
  signalsRef.current = signals;
  const indicatorsRef = useRef<IndicatorData>(indicators);
  indicatorsRef.current = indicators;

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

  const getBase64PNG = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return null;
    return instance.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#1a1a2e",
    });
  }, []);

  const getReadings = useCallback((): Record<string, number | number[] | null> => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return {};
    const option = instance.getOption();
    const series = option.series as { name?: string; type?: string; data?: unknown[] }[];
    if (!series) return {};

    const readings: Record<string, number | number[] | null> = {};
    for (const s of series) {
      if (!s.name || !s.data || s.data.length === 0) continue;
      // Skip Candlestick/Volume main series
      if (s.type === "candlestick") continue;
      if (s.name === "Volume") continue;
      // Find last non-null value from the end
      for (let i = s.data.length - 1; i >= 0; i--) {
        let v = s.data[i];
        if (v == null || v === "-" || v === "") continue;
        // Handle ECharts object format: { value: n, itemStyle: {...} }
        if (typeof v === "object" && !Array.isArray(v) && "value" in (v as Record<string, unknown>)) {
          v = (v as Record<string, unknown>).value;
          if (v == null) continue;
        }
        if (typeof v === "number") {
          readings[s.name] = Math.round(v * 1000) / 1000;
        } else if (Array.isArray(v)) {
          readings[s.name] = v.map((x) => (typeof x === "number" ? Math.round(x * 1000) / 1000 : x));
        }
        break;
      }
    }
    return readings;
  }, []);

  const getTimeSeries = useCallback((count: number): Record<string, unknown>[] => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return [];
    const option = instance.getOption();
    const xAxisData = (option.xAxis as { data?: string[] }[])?.[0]?.data;
    const seriesList = option.series as { name?: string; type?: string; data?: unknown[] }[];
    if (!xAxisData || !seriesList) return [];

    const len = xAxisData.length;
    const startIdx = Math.max(0, len - count);

    // Extract close price from candlestick series
    let candlestickData: unknown[] | null = null;
    // Collect valid series (skip candlestick/volume)
    const validSeries: { name: string; data: unknown[] }[] = [];
    for (const s of seriesList) {
      if (!s.name || !s.data || s.data.length === 0) continue;
      if (s.type === "candlestick") {
        candlestickData = s.data;
        continue;
      }
      if (s.name === "Volume") continue;
      validSeries.push({ name: s.name, data: s.data });
    }

    const extractValue = (v: unknown): number | null => {
      if (v == null || v === "-" || v === "") return null;
      if (typeof v === "object" && !Array.isArray(v) && v !== null && "value" in (v as Record<string, unknown>)) {
        v = (v as Record<string, unknown>).value;
      }
      return typeof v === "number" ? Math.round(v * 100) / 100 : null;
    };

    const rows: Record<string, unknown>[] = [];
    for (let i = startIdx; i < len; i++) {
      const row: Record<string, unknown> = { date: xAxisData[i] };
      // Close price from candlestick [open, close, low, high]
      if (candlestickData?.[i]) {
        const candle = candlestickData[i] as number[];
        if (Array.isArray(candle) && candle.length >= 2) {
          row["Close"] = Math.round(candle[1] * 100) / 100;
        }
      }
      for (const s of validSeries) {
        row[s.name] = extractValue(s.data[i]);
      }
      rows.push(row);
    }
    return rows;
  }, []);

  const getSignalSummary = useCallback((): SignalSummary | null => {
    const sig = signalsRef.current;
    const fmt = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    };

    const cross = (sig.crossSignals ?? []).map((c) => ({
      date: fmt(c.time),
      type: c.type,
      isFake: c.isFake,
      score: c.score,
      daysUntilReverse: c.details.daysUntilReverse,
    }));

    const divergenceIndicator = indicatorParams?.divergenceIndicator ?? "rsi";
    const divergence = (sig.divergence ?? []).map((d) => ({
      date: fmt(d.time),
      type: d.type,
      indicator: divergenceIndicator,
      priceChange: [
        Math.round(d.price.first * 100) / 100,
        Math.round(d.price.second * 100) / 100,
      ] as [number, number],
      indicatorChange: [
        Math.round(d.indicator.first * 100) / 100,
        Math.round(d.indicator.second * 100) / 100,
      ] as [number, number],
    }));

    const bbSqueeze = (sig.bbSqueeze ?? []).map((s) => ({
      date: fmt(s.time),
      bandwidth: Math.round(s.bandwidth * 10000) / 10000,
      percentile: s.percentile,
    }));

    return { cross, divergence, bbSqueeze };
  }, [indicatorParams]);

  const getFundamentalSummary = useCallback((): FundamentalSummary | null => {
    const ind = indicatorsRef.current;
    if (!ind.per && !ind.pbr && !ind.roe) return null;

    const lastVal = (arr?: (number | null)[]): number | null => {
      if (!arr) return null;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i] !== null) return Math.round(arr[i]! * 100) / 100;
      }
      return null;
    };

    const buildEntry = (
      values?: (number | null)[],
      smaValues?: (number | null)[],
      percentile?: PercentileInfo | null
    ) => {
      const current = lastVal(values);
      if (current === null) return null;
      return {
        current,
        sma20: lastVal(smaValues),
        percentile: percentile?.value ?? null,
        level: percentile?.level ?? null,
      };
    };

    return {
      per: buildEntry(ind.per, ind.perSma, ind.perPercentile),
      pbr: buildEntry(ind.pbr, ind.pbrSma, ind.pbrPercentile),
      roe: buildEntry(ind.roe, ind.roeSma, ind.roePercentile),
    };
  }, []);

  useImperativeHandle(ref, () => ({ exportPNG, exportSVG, getBase64PNG, getReadings, getTimeSeries, getSignalSummary, getFundamentalSummary }), [exportPNG, exportSVG, getBase64PNG, getReadings, getTimeSeries, getSignalSummary, getFundamentalSummary]);

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
