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

import { defineComponent, getCurrentInstance, h, type PropType } from "vue";
import type { AnyPrimitivePlugin, AnySeriesRendererPlugin } from "../src/core/plugin-types";
import type {
  BacktestResultData,
  CandleData,
  ChartEvent,
  ChartEventMap,
  ChartInstance,
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
import { CHART_EVENTS, eventProp, wantsEvent } from "../src/integration/chart-event-props";
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
    /** Optional features from `@trendcraft/chart/features`; read when the chart is created. */
    features: {
      type: Array as PropType<((chart: ChartInstance) => void)[]>,
      default: undefined,
    },
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
  // One emit per chart event, carrying the chart's own payload.
  emits: Object.fromEntries(CHART_EVENTS.map((e) => [e, null])) as unknown as {
    [E in ChartEvent]: (data: ChartEventMap[E]) => true;
  },
  setup(props, { emit, expose }) {
    // Re-emit every chart event. The legend-action ones only when the parent
    // listens at mount: subscribing makes the legend draw its ⚙ / ✕ (see
    // wantsEvent). A listener can be bound under any key emit() resolves:
    // camelCase or hyphenated, with or without the `.once` suffix.
    const listeners = getCurrentInstance()?.vnode.props ?? {};
    const handlers: Record<string, (d: unknown) => void> = {};
    for (const e of CHART_EVENTS) {
      const prop = eventProp(e);
      const kebab = `on${e[0].toUpperCase()}${e
        .slice(1)
        .replace(/\B([A-Z])/g, "-$1")
        .toLowerCase()}`;
      const listened = [prop, `${prop}Once`, kebab, `${kebab}Once`].some((k) => listeners[k]);
      if (wantsEvent(e, listened)) {
        handlers[prop] = (d) => (emit as (event: string, data: unknown) => void)(e, d);
      }
    }
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
      features: () => props.features,
      plugins: () => props.plugins,
      chartType: () => props.chartType,
      layout: () => props.layout,
      theme: () => props.theme,
      // Pass as a getter (like every sibling prop) so `useTrendChart`'s watcher
      // re-runs applyOptions when the parent replaces `options` with a new
      // object. Passing `props.options` by value captured the initial reference,
      // so runtime option changes were silently ignored.
      options: () => props.options,
      fitOnLoad: () => props.fitOnLoad,
      ...handlers,
    });

    expose({ chart: () => chart.value });

    return () =>
      h("div", {
        ref: containerRef,
        style: { width: "100%", height: "100%" },
      });
  },
});
