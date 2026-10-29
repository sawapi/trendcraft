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
  ChartEvent,
  ChartInstance,
  ChartOptions,
  ChartPatternSignal,
  ChartType,
  DataPoint,
  Drawing,
  LayoutConfig,
  SeriesConfig,
  SignalMarker,
  ThemeColors,
  TimeframeOverlay,
  TradeMarker,
} from "../src/core/types";
import { createChart } from "../src/index";
import {
  CHART_EVENTS,
  type ChartEventProps,
  eventProp,
  wantsEvent,
} from "../src/integration/chart-event-props";

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
  /**
   * Optional features from `@trendcraft/chart/features` (e.g.
   * `[registerBacktest, registerMarkers]`). `signals`, `trades`, `drawings`,
   * `backtest`, `patterns` and `scores` need theirs. Attached when the chart
   * is created; changing the array later has no effect.
   */
  features?: ((chart: ChartInstance) => void)[];
  plugins?: {
    renderers?: AnySeriesRendererPlugin[];
    primitives?: AnyPrimitivePlugin[];
  };
  chartType?: ChartType;
  layout?: LayoutConfig;
  theme?: "dark" | "light" | ThemeColors;
  options?: Omit<ChartOptions, "theme">;
  fitOnLoad?: boolean;
} & ChartEventProps;

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
    features,
    plugins,
    chartType,
    layout,
    theme = "dark",
    options,
    fitOnLoad = true,
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
    for (const register of features ?? []) register(instance);
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
  const callbacks = useRef<ChartEventProps>(opts);
  // Updated in a layout effect, not during render: a render React does not
  // commit (a transition held back by a suspended sibling) must not redirect
  // the events of the chart that is still on screen to its callbacks. Layout
  // effects run before the passive phase, so the ref is current by the time
  // the passive cleanups of the same commit — the indicators cleanup that
  // emits `seriesRemoved` — fire.
  useIsomorphicLayoutEffect(() => {
    callbacks.current = opts;
  });

  // The legend-action events change what the chart draws while subscribed
  // (see wantsEvent), so re-subscribe when their handlers come or go.
  const subscribed = CHART_EVENTS.filter((e) => wantsEvent(e, opts[eventProp(e)])).join();
  useEffect(() => {
    if (!chart) return;
    const offs = subscribed.split(",").map((name) => {
      const e = name as ChartEvent;
      // The prop for `e` holds `e`'s handler (ChartEventProps); the
      // name-indexed read loses that pairing, hence the cast.
      const h = (d: unknown) =>
        (callbacks.current[eventProp(e)] as ((d: unknown) => void) | undefined)?.(d);
      chart.on(e, h);
      return () => chart.off(e, h);
    });
    return () => {
      for (const off of offs) off();
    };
  }, [chart, subscribed]);

  // Options — forward only the fields that changed since the chart consumed
  // them (at creation, or on the previous change). Replaying the whole object
  // would re-dispatch every setter and redraw on every render.
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

  // Plugins. The prop wins: every listed renderer is (re-)registered when
  // `plugins` changes, replacing one registered for its type elsewhere;
  // re-registering the same object is a no-op. A renderer this hook
  // registered that is dropped, or replaced by another object of its type,
  // is unregistered (running its destroy), unless other code has taken the
  // type since. For a type listed twice the last one wins.
  const appliedRenderers = useRef<{
    chart: ChartInstance;
    byType: Map<string, SeriesRendererPlugin>;
  } | null>(null);
  useEffect(() => {
    if (!chart) return;
    const byType = new Map<string, SeriesRendererPlugin>(
      (plugins?.renderers ?? []).map((r) => [r.type, r as SeriesRendererPlugin]),
    );
    const applied = appliedRenderers.current;
    if (applied?.chart === chart) {
      for (const [type, plugin] of applied.byType) {
        if (byType.get(type) !== plugin) chart.unregisterRenderer(type, plugin);
      }
    }
    for (const r of byType.values()) chart.registerRenderer(r);
    appliedRenderers.current = { chart, byType };
    const primitives = plugins?.primitives ?? [];
    for (const p of primitives) chart.registerPrimitive(p as PrimitivePlugin);
    return () => {
      for (const p of primitives) chart.removePrimitive(p.name);
    };
  }, [chart, plugins]);

  return { containerRef, chart };
}
