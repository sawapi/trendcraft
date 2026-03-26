/**
 * Vue wrapper for @trendcraft/chart.
 *
 * @example
 * ```vue
 * <script setup>
 * import { TrendChart } from '@trendcraft/chart/vue';
 * import { sma, rsi } from 'trendcraft';
 *
 * const candles = ref([...]);
 * const indicators = computed(() => [sma(candles.value, { period: 20 }), rsi(candles.value)]);
 * </script>
 *
 * <template>
 *   <TrendChart :candles="candles" :indicators="indicators" theme="dark" />
 * </template>
 * ```
 */

import { type PropType, defineComponent, h, onMounted, onUnmounted, ref, watch } from "vue";
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

export type IndicatorInput<T = unknown> = {
  data: DataPoint<T>[];
  config?: SeriesConfig;
};

export const TrendChart = defineComponent({
  name: "TrendChart",
  props: {
    candles: { type: Array as PropType<CandleData[]>, required: true },
    indicators: {
      type: Array as PropType<(DataPoint<unknown>[] | IndicatorInput)[]>,
      default: undefined,
    },
    signals: { type: Array as PropType<SignalMarker[]>, default: undefined },
    trades: { type: Array as PropType<TradeMarker[]>, default: undefined },
    drawings: { type: Array as PropType<Drawing[]>, default: undefined },
    timeframes: { type: Array as PropType<TimeframeOverlay[]>, default: undefined },
    backtest: { type: Object as PropType<BacktestResultData>, default: undefined },
    patterns: { type: Array as PropType<ChartPatternSignal[]>, default: undefined },
    scores: { type: Array as PropType<DataPoint<number | null>[]>, default: undefined },
    plugins: {
      type: Object as PropType<{
        renderers?: AnySeriesRendererPlugin[];
        primitives?: AnyPrimitivePlugin[];
      }>,
      default: undefined,
    },
    chartType: {
      type: String as PropType<"candlestick" | "line" | "mountain" | "ohlc">,
      default: undefined,
    },
    layout: { type: Object as PropType<LayoutConfig>, default: undefined },
    theme: { type: [String, Object] as PropType<"dark" | "light" | ThemeColors>, default: "dark" },
    options: { type: Object as PropType<Omit<ChartOptions, "theme">>, default: undefined },
    fitOnLoad: { type: Boolean, default: true },
  },
  emits: ["crosshairMove", "seriesAdded", "seriesRemoved"],
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLElement | null>(null);
    let chart: ChartInstance | null = null;
    let indicatorHandles: { remove(): void }[] = [];

    // Expose chart instance
    expose({ chart: () => chart });

    onMounted(() => {
      if (!containerRef.value) return;
      chart = createChart(containerRef.value, { ...props.options, theme: props.theme });

      // Events
      chart.on("crosshairMove", (data: unknown) => emit("crosshairMove", data));
      chart.on("seriesAdded", (data: unknown) => emit("seriesAdded", data));
      chart.on("seriesRemoved", (data: unknown) => emit("seriesRemoved", data));

      // Initial data
      chart.setCandles(props.candles);
      if (props.fitOnLoad) chart.fitContent();
      applyIndicators();
      if (props.signals) chart.addSignals(props.signals);
      if (props.trades) chart.addTrades(props.trades);
      applyDrawings();
      applyTimeframes();
      if (props.backtest) chart.addBacktest(props.backtest);
      if (props.patterns) chart.addPatterns(props.patterns);
      if (props.scores) chart.addScores(props.scores);
      applyPlugins();
      if (props.layout) chart.setLayout(props.layout);
    });

    onUnmounted(() => {
      chart?.destroy();
      chart = null;
    });

    function applyIndicators() {
      if (!chart) return;
      // Remove previous
      for (const h of indicatorHandles) h.remove();
      indicatorHandles = [];
      // Add new
      for (const ind of props.indicators ?? []) {
        if (Array.isArray(ind)) {
          indicatorHandles.push(chart.addIndicator(ind));
        } else {
          indicatorHandles.push(chart.addIndicator(ind.data, ind.config));
        }
      }
    }

    function applyDrawings() {
      if (!chart || !props.drawings) return;
      for (const d of props.drawings) chart.addDrawing(d);
    }

    function applyTimeframes() {
      if (!chart || !props.timeframes) return;
      for (const tf of props.timeframes) chart.addTimeframe(tf);
    }

    function applyPlugins() {
      if (!chart || !props.plugins) return;
      for (const r of props.plugins.renderers ?? [])
        chart.registerRenderer(r as SeriesRendererPlugin);
      for (const p of props.plugins.primitives ?? []) chart.registerPrimitive(p as PrimitivePlugin);
    }

    // Watchers
    watch(
      () => props.candles,
      (val) => {
        if (!chart) return;
        chart.setCandles(val);
        if (props.fitOnLoad) chart.fitContent();
      },
    );

    watch(
      () => props.theme,
      (val) => {
        chart?.setTheme(val);
      },
    );

    watch(
      () => props.chartType,
      (val) => {
        if (val) chart?.setChartType(val);
      },
    );

    watch(
      () => props.layout,
      (val) => {
        if (val) chart?.setLayout(val);
      },
    );

    watch(
      () => props.indicators,
      () => {
        applyIndicators();
      },
    );

    watch(
      () => props.signals,
      (val) => {
        if (val) chart?.addSignals(val);
      },
    );

    watch(
      () => props.trades,
      (val) => {
        if (val) chart?.addTrades(val);
      },
    );

    watch(
      () => props.drawings,
      (newVal, oldVal) => {
        if (!chart) return;
        if (oldVal) {
          for (const d of oldVal) chart.removeDrawing(d.id);
        }
        if (newVal) {
          for (const d of newVal) chart.addDrawing(d);
        }
      },
    );

    watch(
      () => props.timeframes,
      (newVal, oldVal) => {
        if (!chart) return;
        if (oldVal) {
          for (const tf of oldVal) chart.removeTimeframe(tf.id);
        }
        if (newVal) {
          for (const tf of newVal) chart.addTimeframe(tf);
        }
      },
    );

    watch(
      () => props.backtest,
      (val) => {
        if (val) chart?.addBacktest(val);
      },
    );

    watch(
      () => props.patterns,
      (val) => {
        if (val) chart?.addPatterns(val);
      },
    );

    watch(
      () => props.scores,
      (val) => {
        if (val) chart?.addScores(val);
      },
    );

    watch(
      () => props.plugins,
      (newVal, oldVal) => {
        if (!chart) return;
        // Remove old primitives
        if (oldVal?.primitives) {
          for (const p of oldVal.primitives) chart.removePrimitive(p.name);
        }
        // Apply new plugins
        if (newVal) {
          for (const r of newVal.renderers ?? []) chart.registerRenderer(r as SeriesRendererPlugin);
          for (const p of newVal.primitives ?? []) chart.registerPrimitive(p as PrimitivePlugin);
        }
      },
    );

    return () =>
      h("div", {
        ref: containerRef,
        style: { width: "100%", height: "100%" },
      });
  },
});

export default TrendChart;
