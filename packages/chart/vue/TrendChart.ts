/**
 * Vue wrapper component for @trendcraft/chart.
 *
 * Thin component built on top of the `useTrendChart` composable. Covers
 * the common case where you want to drop a chart into a template with a
 * few data props. For imperative control (connectIndicators, setDrawingTool,
 * custom plugins), use `useTrendChart` directly and operate on the
 * returned `chart` shallow ref.
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

import { type PropType, defineComponent, h } from "vue";
import type { AnyPrimitivePlugin, AnySeriesRendererPlugin } from "../src/core/plugin-types";
import type {
  BacktestResultData,
  CandleData,
  ChartOptions,
  ChartPatternSignal,
  DataPoint,
  Drawing,
  LayoutConfig,
  SignalMarker,
  ThemeColors,
  TimeframeOverlay,
  TradeMarker,
} from "../src/core/types";
import { type IndicatorInput, useTrendChart } from "./useTrendChart";

export type { IndicatorInput, UseTrendChartOptions, UseTrendChartResult } from "./useTrendChart";
export { useTrendChart } from "./useTrendChart";

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
  emits: ["crosshairMove", "seriesAdded", "seriesRemoved", "error"],
  setup(props, { emit, expose }) {
    const { containerRef, chart } = useTrendChart({
      candles: () => props.candles,
      indicators: () => props.indicators,
      signals: () => props.signals,
      trades: () => props.trades,
      drawings: () => props.drawings,
      timeframes: () => props.timeframes,
      backtest: () => props.backtest,
      patterns: () => props.patterns,
      scores: () => props.scores,
      plugins: () => props.plugins,
      chartType: () => props.chartType,
      layout: () => props.layout,
      theme: () => props.theme,
      options: props.options,
      fitOnLoad: () => props.fitOnLoad,
      onCrosshairMove: (data) => emit("crosshairMove", data),
      onSeriesAdded: (data) => emit("seriesAdded", data),
      onSeriesRemoved: (data) => emit("seriesRemoved", data),
      onError: (data) => emit("error", data),
    });

    expose({ chart: () => chart.value });

    return () =>
      h("div", {
        ref: containerRef,
        style: { width: "100%", height: "100%" },
      });
  },
});
