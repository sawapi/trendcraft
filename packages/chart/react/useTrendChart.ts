/**
 * React hook for @trendcraft/chart.
 *
 * Returns a `containerRef` to attach to a host element and a `chart`
 * state value that is `null` before mount and the live `ChartInstance`
 * after. Put `chart` in your effect dependencies to run imperative work
 * once the chart is ready.
 *
 * @example
 * ```tsx
 * import { useTrendChart } from '@trendcraft/chart/react';
 * import { connectIndicators } from '@trendcraft/chart';
 * import { indicatorPresets } from 'trendcraft';
 *
 * function MyChart() {
 *   const { containerRef, chart } = useTrendChart({ candles, theme: 'dark' });
 *
 *   useEffect(() => {
 *     if (!chart) return;
 *     const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
 *     conn.add('rsi');
 *     return () => conn.disconnect();
 *   }, [chart]);
 *
 *   return <div ref={containerRef} style={{ width: '100%', height: 400 }} />;
 * }
 * ```
 */

import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type ChartOptionsTracker, createChartOptionsTracker } from "../src/core/options-tracker";
import type {
  AnyPrimitivePlugin,
  AnySeriesRendererPlugin,
  PrimitivePlugin,
  SeriesRendererPlugin,
} from "../src/core/plugin-types";
import type {
  BacktestResultData,
  CandleData,
  ChartErrorPayload,
  ChartEvent,
  ChartInstance,
  ChartOptions,
  ChartPatternSignal,
  ChartType,
  CrosshairMoveData,
  DataPoint,
  Drawing,
  LayoutConfig,
  SeriesAddedData,
  SeriesConfig,
  SeriesRemovedData,
  SignalMarker,
  ThemeColors,
  TimeframeOverlay,
  TradeMarker,
} from "../src/core/types";
import { createChart } from "../src/index";

/**
 * `useLayoutEffect` is a no-op on the server and React 18 warns about it
 * there; the ref it maintains is only read by browser event handlers, so the
 * passive effect is an adequate stand-in for SSR.
 */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type IndicatorInput<T = unknown> = {
  data: DataPoint<T>[];
  config?: SeriesConfig;
};

export type UseTrendChartOptions = {
  candles: CandleData[];
  indicators?: (DataPoint<unknown>[] | IndicatorInput)[];
  signals?: SignalMarker[];
  trades?: TradeMarker[];
  drawings?: Drawing[];
  timeframes?: TimeframeOverlay[];
  backtest?: BacktestResultData;
  patterns?: ChartPatternSignal[];
  scores?: DataPoint<number | null>[];
  plugins?: {
    renderers?: AnySeriesRendererPlugin[];
    primitives?: AnyPrimitivePlugin[];
  };
  chartType?: ChartType;
  layout?: LayoutConfig;
  theme?: "dark" | "light" | ThemeColors;
  options?: Omit<ChartOptions, "theme">;
  fitOnLoad?: boolean;
  onCrosshairMove?: (data: CrosshairMoveData) => void;
  onSeriesAdded?: (data: SeriesAddedData) => void;
  onSeriesRemoved?: (data: SeriesRemovedData) => void;
  onError?: (data: ChartErrorPayload) => void;
};

export type UseTrendChartResult = {
  /** Attach to the host element (`<div ref={containerRef} />`) */
  containerRef: RefObject<HTMLDivElement | null>;
  /** `null` before mount, `ChartInstance` after. Suitable for effect deps. */
  chart: ChartInstance | null;
};

export function useTrendChart(opts: UseTrendChartOptions): UseTrendChartResult {
  const {
    candles,
    indicators,
    signals,
    trades,
    drawings,
    timeframes,
    backtest,
    patterns,
    scores,
    plugins,
    chartType,
    layout,
    theme = "dark",
    options,
    fitOnLoad = true,
    onCrosshairMove,
    onSeriesAdded,
    onSeriesRemoved,
    onError,
  } = opts;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chart, setChart] = useState<ChartInstance | null>(null);
  const optionsTracker = useRef<ChartOptionsTracker | null>(null);

  // Init chart — create on mount, destroy on unmount. `options`/`theme` only
  // feed the initial creation; runtime updates go through dedicated setters.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — chart recreation is expensive; runtime changes handled by separate effects
  useEffect(() => {
    if (!containerRef.current) return;
    const instance = createChart(containerRef.current, { ...options, theme });
    optionsTracker.current = createChartOptionsTracker(options);
    setChart(instance);
    return () => {
      instance.destroy();
      setChart(null);
    };
  }, []);

  // Events — subscribed once per chart instance, before any data effect, and
  // dispatched to the *current* callbacks through a ref. Subscribing per
  // callback identity (the previous design, declared after the data effects)
  // meant an event emitted by another effect's cleanup in the same commit —
  // `seriesRemoved` from the indicators cleanup — reached the *previous*
  // render's closure, and `seriesAdded` from the initial indicators reached
  // nobody, because that subscription had not been made yet.
  const callbacks = useRef({ onCrosshairMove, onSeriesAdded, onSeriesRemoved, onError });
  // Updated in a layout effect, not during render: a render React does not
  // commit (a transition held back by a suspended sibling) must not redirect
  // the events of the chart that is still on screen to its callbacks. Layout
  // effects run before the passive phase, so the ref is current by the time
  // the passive cleanups of the same commit — the indicators cleanup that
  // emits `seriesRemoved` — fire.
  useIsomorphicLayoutEffect(() => {
    callbacks.current = { onCrosshairMove, onSeriesAdded, onSeriesRemoved, onError };
  });

  useEffect(() => {
    if (!chart) return;
    const subscribe = <T>(
      event: ChartEvent,
      pick: (c: typeof callbacks.current) => ((data: T) => void) | undefined,
    ) => {
      const h = (d: unknown) => pick(callbacks.current)?.(d as T);
      chart.on(event, h);
      return () => chart.off(event, h);
    };
    const offs = [
      subscribe<CrosshairMoveData>("crosshairMove", (c) => c.onCrosshairMove),
      subscribe<SeriesAddedData>("seriesAdded", (c) => c.onSeriesAdded),
      subscribe<SeriesRemovedData>("seriesRemoved", (c) => c.onSeriesRemoved),
      subscribe<ChartErrorPayload>("error", (c) => c.onError),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [chart]);

  // Options — forward only the fields that changed since the chart consumed
  // them (at creation, or on the previous change). Replaying the whole object
  // would re-dispatch every setter and warn for creation-only fields such as
  // `locale` that the consumer never changed.
  useEffect(() => {
    if (!chart) return;
    const changed = optionsTracker.current?.diff(options);
    if (changed) chart.applyOptions(changed);
  }, [chart, options]);

  // Candles + fit
  useEffect(() => {
    if (!chart) return;
    chart.setCandles(candles);
    if (fitOnLoad) chart.fitContent();
  }, [chart, candles, fitOnLoad]);

  // Theme
  useEffect(() => {
    chart?.setTheme(theme);
  }, [chart, theme]);

  // Chart type
  useEffect(() => {
    if (chartType) chart?.setChartType(chartType);
  }, [chart, chartType]);

  // Layout
  useEffect(() => {
    if (layout) chart?.setLayout(layout);
  }, [chart, layout]);

  // Indicators
  useEffect(() => {
    if (!chart) return;
    const handles = (indicators ?? []).map((ind) => {
      if (Array.isArray(ind)) return chart.addIndicator(ind);
      return chart.addIndicator(ind.data, ind.config);
    });
    return () => {
      for (const h of handles) h.remove();
    };
  }, [chart, indicators]);

  // Signals
  useEffect(() => {
    if (signals) chart?.addSignals(signals);
  }, [chart, signals]);

  // Trades
  useEffect(() => {
    if (trades) chart?.addTrades(trades);
  }, [chart, trades]);

  // Drawings
  useEffect(() => {
    if (!chart || !drawings) return;
    for (const d of drawings) chart.addDrawing(d);
    return () => {
      for (const d of drawings) chart.removeDrawing(d.id);
    };
  }, [chart, drawings]);

  // Timeframes
  useEffect(() => {
    if (!chart || !timeframes) return;
    for (const tf of timeframes) chart.addTimeframe(tf);
    return () => {
      for (const tf of timeframes) chart.removeTimeframe(tf.id);
    };
  }, [chart, timeframes]);

  // Backtest
  useEffect(() => {
    if (backtest) chart?.addBacktest(backtest);
  }, [chart, backtest]);

  // Patterns
  useEffect(() => {
    if (patterns) chart?.addPatterns(patterns);
  }, [chart, patterns]);

  // Scores
  useEffect(() => {
    if (scores) chart?.addScores(scores);
  }, [chart, scores]);

  // Plugins
  useEffect(() => {
    if (!chart || !plugins) return;
    for (const r of plugins.renderers ?? []) chart.registerRenderer(r as SeriesRendererPlugin);
    for (const p of plugins.primitives ?? []) chart.registerPrimitive(p as PrimitivePlugin);
    return () => {
      for (const p of plugins.primitives ?? []) chart.removePrimitive(p.name);
    };
  }, [chart, plugins]);

  return { containerRef, chart };
}
