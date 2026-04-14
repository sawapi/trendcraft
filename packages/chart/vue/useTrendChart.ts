/**
 * Vue composable for @trendcraft/chart.
 *
 * Returns a `containerRef` to bind to a template element and a `chart`
 * shallow ref that is `null` before mount and the live `ChartInstance`
 * after. Use `watch(chart, ...)` or `watchEffect` to run imperative
 * work once the chart is ready.
 *
 * NOTE: chart is intentionally a `shallowRef` — wrapping a `ChartInstance`
 * in a regular `ref` triggers Vue's deep-reactivity proxy and corrupts
 * the chart's internal state.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useTrendChart } from '@trendcraft/chart/vue';
 * import { connectIndicators } from '@trendcraft/chart';
 * import { indicatorPresets } from 'trendcraft';
 *
 * const { containerRef, chart } = useTrendChart({ candles, theme: 'dark' });
 *
 * watchEffect((onCleanup) => {
 *   if (!chart.value) return;
 *   const conn = connectIndicators(chart.value, { presets: indicatorPresets, candles });
 *   conn.add('rsi');
 *   onCleanup(() => conn.disconnect());
 * });
 * </script>
 *
 * <template>
 *   <div ref="containerRef" style="width: 100%; height: 400px" />
 * </template>
 * ```
 */

import {
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  toValue,
  watch,
} from "vue";
import type {
  AnyPrimitivePlugin,
  AnySeriesRendererPlugin,
  PrimitivePlugin,
  SeriesRendererPlugin,
} from "../src/core/plugin-types";
import type {
  BacktestResultData,
  CandleData,
  ChartInstance,
  ChartOptions,
  ChartPatternSignal,
  ChartType,
  CrosshairMoveData,
  DataPoint,
  Drawing,
  LayoutConfig,
  SeriesConfig,
  SeriesHandle,
  SeriesInfo,
  SignalMarker,
  ThemeColors,
  TimeframeOverlay,
  TradeMarker,
} from "../src/core/types";
import { createChart } from "../src/index";

export type IndicatorInput<T = unknown> = {
  data: DataPoint<T>[];
  config?: SeriesConfig;
};

/** Option values may be passed as plain values, refs, or getters. */
type Reactive<T> = MaybeRefOrGetter<T>;

export type UseTrendChartOptions = {
  candles: Reactive<CandleData[]>;
  indicators?: Reactive<(DataPoint<unknown>[] | IndicatorInput)[] | undefined>;
  signals?: Reactive<SignalMarker[] | undefined>;
  trades?: Reactive<TradeMarker[] | undefined>;
  drawings?: Reactive<Drawing[] | undefined>;
  timeframes?: Reactive<TimeframeOverlay[] | undefined>;
  backtest?: Reactive<BacktestResultData | undefined>;
  patterns?: Reactive<ChartPatternSignal[] | undefined>;
  scores?: Reactive<DataPoint<number | null>[] | undefined>;
  plugins?: Reactive<
    | {
        renderers?: AnySeriesRendererPlugin[];
        primitives?: AnyPrimitivePlugin[];
      }
    | undefined
  >;
  chartType?: Reactive<ChartType | undefined>;
  layout?: Reactive<LayoutConfig | undefined>;
  theme?: Reactive<"dark" | "light" | ThemeColors | undefined>;
  /** Chart options — runtime-capable fields (volume, watermark, fontSize, ...) are applied via applyOptions on change */
  options?: Reactive<Omit<ChartOptions, "theme"> | undefined>;
  fitOnLoad?: Reactive<boolean | undefined>;
  onCrosshairMove?: (data: CrosshairMoveData) => void;
  onSeriesAdded?: (data: SeriesInfo) => void;
  onSeriesRemoved?: (data: SeriesInfo) => void;
  onError?: (data: { source: string; error: unknown }) => void;
};

export type UseTrendChartResult = {
  /** Bind to a template element: `<div ref="containerRef" />`. */
  containerRef: Ref<HTMLElement | null>;
  /** `null` before mount, `ChartInstance` after. Shallow ref — do not wrap in `ref()`. */
  chart: ShallowRef<ChartInstance | null>;
};

export function useTrendChart(opts: UseTrendChartOptions): UseTrendChartResult {
  const containerRef = ref<HTMLElement | null>(null);
  const chart = shallowRef<ChartInstance | null>(null);

  // Track indicator handles across re-applies so we can release them
  let indicatorHandles: SeriesHandle[] = [];
  // Track drawings/timeframes applied per watch so cleanup removes the right ones
  let appliedDrawingIds: string[] = [];
  let appliedTimeframeIds: string[] = [];
  let appliedPrimitiveNames: string[] = [];

  onMounted(() => {
    if (!containerRef.value) return;
    const instance = createChart(containerRef.value, {
      ...toValue(opts.options),
      theme: toValue(opts.theme) ?? "dark",
    });

    // Subscribe events unconditionally — handlers are invoked only if the
    // consumer passed a callback, so this keeps registration count stable.
    if (opts.onCrosshairMove) {
      instance.on("crosshairMove", (d) => opts.onCrosshairMove?.(d as CrosshairMoveData));
    }
    if (opts.onSeriesAdded) {
      instance.on("seriesAdded", (d) => opts.onSeriesAdded?.(d as SeriesInfo));
    }
    if (opts.onSeriesRemoved) {
      instance.on("seriesRemoved", (d) => opts.onSeriesRemoved?.(d as SeriesInfo));
    }
    if (opts.onError) {
      instance.on("error", (d) => opts.onError?.(d as { source: string; error: unknown }));
    }

    // Seed initial state synchronously so first render sees data
    instance.setCandles(toValue(opts.candles));
    if (toValue(opts.fitOnLoad) ?? true) instance.fitContent();
    applyIndicators(instance, toValue(opts.indicators));
    applyDrawings(instance, toValue(opts.drawings));
    applyTimeframes(instance, toValue(opts.timeframes));
    applyPlugins(instance, toValue(opts.plugins));
    const sigs = toValue(opts.signals);
    if (sigs) instance.addSignals(sigs);
    const tds = toValue(opts.trades);
    if (tds) instance.addTrades(tds);
    const bt = toValue(opts.backtest);
    if (bt) instance.addBacktest(bt);
    const pats = toValue(opts.patterns);
    if (pats) instance.addPatterns(pats);
    const scr = toValue(opts.scores);
    if (scr) instance.addScores(scr);
    const lay = toValue(opts.layout);
    if (lay) instance.setLayout(lay);
    const ct = toValue(opts.chartType);
    if (ct) instance.setChartType(ct);

    chart.value = instance;
  });

  onUnmounted(() => {
    chart.value?.destroy();
    chart.value = null;
    indicatorHandles = [];
    appliedDrawingIds = [];
    appliedTimeframeIds = [];
    appliedPrimitiveNames = [];
  });

  // Reactive bindings — only fire after mount because `chart.value` is null until then
  watch(
    () => toValue(opts.options),
    (val) => {
      if (val) chart.value?.applyOptions(val);
    },
    { deep: true },
  );

  watch(
    () => toValue(opts.candles),
    (val) => {
      const c = chart.value;
      if (!c) return;
      c.setCandles(val);
      if (toValue(opts.fitOnLoad) ?? true) c.fitContent();
    },
  );

  watch(
    () => toValue(opts.theme),
    (val) => {
      if (val) chart.value?.setTheme(val);
    },
  );

  watch(
    () => toValue(opts.chartType),
    (val) => {
      if (val) chart.value?.setChartType(val);
    },
  );

  watch(
    () => toValue(opts.layout),
    (val) => {
      if (val) chart.value?.setLayout(val);
    },
  );

  watch(
    () => toValue(opts.indicators),
    (val) => {
      const c = chart.value;
      if (!c) return;
      applyIndicators(c, val);
    },
  );

  watch(
    () => toValue(opts.signals),
    (val) => {
      if (val) chart.value?.addSignals(val);
    },
  );

  watch(
    () => toValue(opts.trades),
    (val) => {
      if (val) chart.value?.addTrades(val);
    },
  );

  watch(
    () => toValue(opts.drawings),
    (val) => {
      const c = chart.value;
      if (!c) return;
      applyDrawings(c, val);
    },
  );

  watch(
    () => toValue(opts.timeframes),
    (val) => {
      const c = chart.value;
      if (!c) return;
      applyTimeframes(c, val);
    },
  );

  watch(
    () => toValue(opts.backtest),
    (val) => {
      if (val) chart.value?.addBacktest(val);
    },
  );

  watch(
    () => toValue(opts.patterns),
    (val) => {
      if (val) chart.value?.addPatterns(val);
    },
  );

  watch(
    () => toValue(opts.scores),
    (val) => {
      if (val) chart.value?.addScores(val);
    },
  );

  watch(
    () => toValue(opts.plugins),
    (val) => {
      const c = chart.value;
      if (!c) return;
      applyPlugins(c, val);
    },
  );

  function applyIndicators(
    c: ChartInstance,
    list: (DataPoint<unknown>[] | IndicatorInput)[] | undefined,
  ) {
    for (const h of indicatorHandles) h.remove();
    indicatorHandles = [];
    for (const ind of list ?? []) {
      if (Array.isArray(ind)) {
        indicatorHandles.push(c.addIndicator(ind));
      } else {
        indicatorHandles.push(c.addIndicator(ind.data, ind.config));
      }
    }
  }

  function applyDrawings(c: ChartInstance, list: Drawing[] | undefined) {
    for (const id of appliedDrawingIds) c.removeDrawing(id);
    appliedDrawingIds = [];
    if (list) {
      for (const d of list) {
        c.addDrawing(d);
        appliedDrawingIds.push(d.id);
      }
    }
  }

  function applyTimeframes(c: ChartInstance, list: TimeframeOverlay[] | undefined) {
    for (const id of appliedTimeframeIds) c.removeTimeframe(id);
    appliedTimeframeIds = [];
    if (list) {
      for (const tf of list) {
        c.addTimeframe(tf);
        appliedTimeframeIds.push(tf.id);
      }
    }
  }

  function applyPlugins(
    c: ChartInstance,
    val:
      | {
          renderers?: AnySeriesRendererPlugin[];
          primitives?: AnyPrimitivePlugin[];
        }
      | undefined,
  ) {
    for (const name of appliedPrimitiveNames) c.removePrimitive(name);
    appliedPrimitiveNames = [];
    if (!val) return;
    for (const r of val.renderers ?? []) c.registerRenderer(r as SeriesRendererPlugin);
    for (const p of val.primitives ?? []) {
      c.registerPrimitive(p as PrimitivePlugin);
      appliedPrimitiveNames.push(p.name);
    }
  }

  return { containerRef, chart };
}
