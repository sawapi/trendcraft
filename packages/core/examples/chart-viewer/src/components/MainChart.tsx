/**
 * Main chart component (candlestick + volume + subcharts + overlays)
 */

import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { IndicatorData, PercentileInfo } from "../hooks/useIndicators";
import { useIndicators } from "../hooks/useIndicators";
import { useOverlays } from "../hooks/useOverlays";
import { useProjectionFan } from "../hooks/useProjectionFan";
import type { SignalData } from "../hooks/useSignals";
import { useSignals } from "../hooks/useSignals";
import { useChartStore } from "../store/chartStore";
import type {
  Drawing,
  FibRetracementDrawing,
  RectDrawing,
  TextDrawing,
  TrendLineDrawing,
} from "../types";
import { buildChartOption } from "../utils/chartConfig";
import { hitTestDrawings } from "../utils/drawingHitTest";
import { BarContextMenu } from "./BarContextMenu";
import { DrawingContextMenu } from "./DrawingContextMenu";

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
  per: {
    current: number;
    sma20: number | null;
    percentile: number | null;
    level: string | null;
  } | null;
  pbr: {
    current: number;
    sma20: number | null;
    percentile: number | null;
    level: string | null;
  } | null;
  roe: {
    current: number;
    sma20: number | null;
    percentile: number | null;
    level: string | null;
  } | null;
}

export interface MainChartHandle {
  exportPNG: () => void;
  exportSVG: () => void;
  copyToClipboard: () => Promise<boolean>;
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
  const containerRef = useRef<HTMLDivElement>(null);

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

  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return false;
    try {
      const currentTheme = useChartStore.getState().theme;
      const bgColor = currentTheme === "dark" ? "#1a1a2e" : "#ffffff";
      const dataURL = instance.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor: bgColor,
      });
      const res = await fetch(dataURL);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return true;
    } catch {
      return false;
    }
  }, []);

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
        if (
          typeof v === "object" &&
          !Array.isArray(v) &&
          "value" in (v as Record<string, unknown>)
        ) {
          v = (v as Record<string, unknown>).value;
          if (v == null) continue;
        }
        if (typeof v === "number") {
          readings[s.name] = Math.round(v * 1000) / 1000;
        } else if (Array.isArray(v)) {
          readings[s.name] = v.map((x) =>
            typeof x === "number" ? Math.round(x * 1000) / 1000 : x,
          );
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

    const extractValue = (raw: unknown): number | null => {
      if (raw == null || raw === "-" || raw === "") return null;
      let v: unknown = raw;
      if (
        typeof v === "object" &&
        !Array.isArray(v) &&
        v !== null &&
        "value" in (v as Record<string, unknown>)
      ) {
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
          row.Close = Math.round(candle[1] * 100) / 100;
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
        if (arr[i] !== null) return Math.round((arr[i] as number) * 100) / 100;
      }
      return null;
    };

    const buildEntry = (
      values?: (number | null)[],
      smaValues?: (number | null)[],
      percentile?: PercentileInfo | null,
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

  useImperativeHandle(
    ref,
    () => ({
      exportPNG,
      exportSVG,
      copyToClipboard,
      getBase64PNG,
      getReadings,
      getTimeSeries,
      getSignalSummary,
      getFundamentalSummary,
    }),
    [
      exportPNG,
      exportSVG,
      copyToClipboard,
      getBase64PNG,
      getReadings,
      getTimeSeries,
      getSignalSummary,
      getFundamentalSummary,
    ],
  );

  const chartHeight = useMemo(() => {
    return calculateChartHeight(enabledIndicators.length);
  }, [enabledIndicators.length]);

  const yAxisType = useChartStore((state) => state.yAxisType);
  const yAxisPercent = useChartStore((state) => state.yAxisPercent);
  const theme = useChartStore((state) => state.theme);
  const drawings = useChartStore((state) => state.drawings);
  const subchartHeights = useChartStore((state) => state.subchartHeights);
  const activeDrawingTool = useChartStore((state) => state.activeDrawingTool);
  const setPendingPoint = useChartStore((state) => state.setPendingPoint);
  const addDrawing = useChartStore((state) => state.addDrawing);

  // Drawing tool click handler on ZRender level
  useEffect(() => {
    if (activeDrawingTool === "cursor" || activeDrawingTool === "hline") return;
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;

    let drawingIdCounter = 0;
    const generateId = () => `drawing-${Date.now()}-${++drawingIdCounter}`;

    const handler = (params: { offsetX: number; offsetY: number }) => {
      const point = instance.convertFromPixel({ gridIndex: 0 }, [params.offsetX, params.offsetY]);
      if (!point) return;

      const [dataIndex, rawPrice] = point;
      const roundedIndex = Math.round(dataIndex);
      const storeCandles = useChartStore.getState().currentCandles;
      if (roundedIndex < 0 || roundedIndex >= storeCandles.length) return;

      // OHLC snap: snap to nearest OHLC value if within 15px
      const candle = storeCandles[roundedIndex];
      const ohlcValues = [candle.open, candle.high, candle.low, candle.close];
      let price = rawPrice;
      let minPixelDist = 15;
      for (const ohlc of ohlcValues) {
        const ohlcPixel = instance.convertToPixel({ gridIndex: 0 }, [roundedIndex, ohlc]);
        if (ohlcPixel) {
          const dist = Math.abs(params.offsetY - ohlcPixel[1]);
          if (dist < minPixelDist) {
            minPixelDist = dist;
            price = ohlc;
          }
        }
      }

      const tool = useChartStore.getState().activeDrawingTool;
      const pending = useChartStore.getState().pendingPoint;

      if (tool === "text") {
        const text = window.prompt("Enter text:");
        if (!text) return;
        const drawing: TextDrawing = {
          id: generateId(),
          type: "text",
          color: "#ffffff",
          lineWidth: 1,
          visible: true,
          dateIndex: roundedIndex,
          price,
          text,
          fontSize: 12,
        };
        addDrawing(drawing);
        return;
      }

      // 2-click tools: trendline, fibRetracement, rect
      if (!pending) {
        setPendingPoint({ dateIndex: roundedIndex, price });
        return;
      }

      // Second click — create the drawing
      const p1 = pending;
      const p2 = { dateIndex: roundedIndex, price };

      let drawing: Drawing;
      if (tool === "trendline") {
        drawing = {
          id: generateId(),
          type: "trendline",
          color: "#2196f3",
          lineWidth: 2,
          visible: true,
          point1: p1,
          point2: p2,
        } satisfies TrendLineDrawing;
      } else if (tool === "fibRetracement") {
        drawing = {
          id: generateId(),
          type: "fibRetracement",
          color: "#ff9800",
          lineWidth: 1,
          visible: true,
          point1: p1,
          point2: p2,
          levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
        } satisfies FibRetracementDrawing;
      } else {
        drawing = {
          id: generateId(),
          type: "rect",
          color: "#ff9800",
          lineWidth: 1,
          visible: true,
          point1: p1,
          point2: p2,
          fillColor: "rgba(255, 152, 0, 0.15)",
        } satisfies RectDrawing;
      }

      addDrawing(drawing);
      setPendingPoint(null);
    };

    const zr = instance.getZr();
    zr.on("click", handler);
    return () => {
      zr.off("click", handler);
    };
  }, [activeDrawingTool, addDrawing, setPendingPoint]);

  const selectDrawing = useChartStore((state) => state.selectDrawing);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    drawingId: string;
  } | null>(null);

  // Bar context menu state
  const [barContextMenu, setBarContextMenu] = useState<{
    x: number;
    y: number;
    barIndex: number;
  } | null>(null);

  // Guard against ECharts' getRawIndex crash on mouseup (right-click) and mouseout.
  //
  // Root cause: ECharts dispatches mouse events to series elements and calls
  // getDataParams → getRawIndex on data that may not exist. This is an ECharts
  // bug triggered by:
  //   - mouseup with button=2 (right-click)
  //   - mouseout when the cursor leaves the canvas (e.g. context menu appears)
  //
  // Fix: attach capture-phase listeners on the ECharts canvas DOM element itself
  // (not the parent div), so we intercept before ECharts' own HandlerDomProxy.
  // biome-ignore lint/correctness/useExhaustiveDependencies: must re-attach when chart key remounts (driven by currentCandles.length)
  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const zr = instance.getZr();
    // biome-ignore lint/suspicious/noExplicitAny: accessing ZRender internal DOM
    const canvasDom = (zr as any).dom as HTMLElement | undefined;
    if (!canvasDom) return;

    const blockMouseUp = (e: MouseEvent) => {
      if (e.button === 2) e.stopImmediatePropagation();
    };
    const blockMouseOut = (e: MouseEvent) => {
      // Only block mouseout that leaves the canvas entirely (not between child elements)
      if (!canvasDom.contains(e.relatedTarget as Node)) {
        e.stopImmediatePropagation();
      }
    };

    canvasDom.addEventListener("mouseup", blockMouseUp, true);
    canvasDom.addEventListener("mouseout", blockMouseOut, true);
    return () => {
      canvasDom.removeEventListener("mouseup", blockMouseUp, true);
      canvasDom.removeEventListener("mouseout", blockMouseOut, true);
    };
  }, [currentCandles.length]);

  /**
   * Check whether ECharts' grid coordinate system is initialized.
   * convertFromPixel / convertToPixel crash if called before setOption
   * has been processed (e.g. during key-based re-mount).
   */
  const isGridReady = useCallback((): boolean => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return false;
    const opt = instance.getOption();
    return !!(opt && (opt as { grid?: unknown }).grid);
  }, []);

  // Right-click handler for drawings and bar context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();

      const instance = chartRef.current?.getEchartsInstance();
      if (!instance || !isGridReady()) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      const convertToPixel = (dataPoint: [number, number]) =>
        instance.convertToPixel({ gridIndex: 0 }, dataPoint);

      const hit = hitTestDrawings(
        useChartStore.getState().drawings,
        offsetX,
        offsetY,
        convertToPixel,
        instance.getWidth(),
      );

      if (hit) {
        selectDrawing(hit.id);
        setContextMenu({ x: e.clientX, y: e.clientY, drawingId: hit.id });
        setBarContextMenu(null);
      } else {
        selectDrawing(null);
        setContextMenu(null);
        // Show bar context menu
        const point = instance.convertFromPixel({ gridIndex: 0 }, [offsetX, offsetY]);
        if (point) {
          const dataIndex = Math.round(point[0]);
          if (dataIndex >= 0 && dataIndex < useChartStore.getState().currentCandles.length) {
            setBarContextMenu({ x: e.clientX, y: e.clientY, barIndex: dataIndex });
          }
        }
      }
    },
    [selectDrawing, isGridReady],
  );

  // Click handler to select/deselect drawings
  useEffect(() => {
    if (activeDrawingTool !== "cursor") return;
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;

    const handler = (params: { offsetX: number; offsetY: number }) => {
      const convertToPixel = (dataPoint: [number, number]) =>
        instance.convertToPixel({ gridIndex: 0 }, dataPoint);

      const hit = hitTestDrawings(
        useChartStore.getState().drawings,
        params.offsetX,
        params.offsetY,
        convertToPixel,
        instance.getWidth(),
      );

      selectDrawing(hit?.id ?? null);
    };

    const zr = instance.getZr();
    zr.on("click", handler);
    return () => {
      zr.off("click", handler);
    };
  }, [activeDrawingTool, selectDrawing]);

  const isDrawingActive = activeDrawingTool !== "cursor" && activeDrawingTool !== "hline";
  const selectedDrawingId = useChartStore((state) => state.selectedDrawingId);
  const comparisonSymbols = useChartStore((state) => state.comparisonSymbols);

  // Pattern replay
  const replayPattern = useChartStore((state) => state.replayPattern);
  const replayEndIndex = useChartStore((state) => state.replayEndIndex);
  const projectionFanSeries = useProjectionFan(
    replayPattern,
    signals.chartPatterns,
    currentCandles,
    replayEndIndex,
  );

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
      zoomRange,
      yAxisType,
      yAxisPercent,
      theme,
      drawings,
      subchartHeights,
      selectedDrawingId,
      comparisonSymbols,
      replayEndIndex,
      projectionFanSeries,
    );
  }, [
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
    zoomRange,
    yAxisType,
    yAxisPercent,
    theme,
    drawings,
    subchartHeights,
    selectedDrawingId,
    comparisonSymbols,
    replayEndIndex,
    projectionFanSeries,
  ]);

  const setHoveredDataIndex = useChartStore((state) => state.setHoveredDataIndex);

  // Track hovered data index via DOM mousemove + convertFromPixel
  const handleChartMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const instance = chartRef.current?.getEchartsInstance();
      if (!instance) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const point = instance.convertFromPixel({ gridIndex: 0 }, [x, y]);
      if (!point) return;
      const idx = Math.round(point[0]);
      if (idx >= 0 && idx < currentCandles.length) {
        setHoveredDataIndex(idx);
      }
    },
    [currentCandles.length, setHoveredDataIndex],
  );

  // Handle dataZoom events from chart interaction
  const onEvents = useMemo(
    () => ({
      datazoom: (params: {
        start?: number;
        end?: number;
        batch?: Array<{ start?: number; end?: number }>;
      }) => {
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
    }),
    [setZoomRange],
  );

  if (currentCandles.length === 0) {
    return null;
  }

  // Use candle count as key to force re-mount when data changes
  const chartKey = `chart-${currentCandles.length}`;

  return (
    <div
      ref={containerRef}
      className={`main-chart${isDrawingActive ? " drawing-active" : ""}`}
      style={{ height: chartHeight }}
      onMouseMove={handleChartMouseMove}
      onMouseLeave={() => setHoveredDataIndex(null)}
      onContextMenu={handleContextMenu}
    >
      <ReactECharts
        ref={chartRef}
        key={chartKey}
        option={option}
        style={{ height: "100%", width: "100%" }}
        notMerge={true}
        lazyUpdate={true}
        onEvents={onEvents}
      />
      {contextMenu && (
        <DrawingContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          drawingId={contextMenu.drawingId}
          onClose={() => {
            setContextMenu(null);
            selectDrawing(null);
          }}
        />
      )}
      {barContextMenu && !contextMenu && (
        <BarContextMenu
          x={barContextMenu.x}
          y={barContextMenu.y}
          barIndex={barContextMenu.barIndex}
          onClose={() => setBarContextMenu(null)}
        />
      )}
    </div>
  );
});
