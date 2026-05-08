/**
 * Vue bindings for `@trendcraft/chart/sparkline`.
 *
 * @example
 * ```vue
 * <script setup>
 * import { Sparkline, SparklineList } from '@trendcraft/chart/vue/sparkline';
 * </script>
 *
 * <template>
 *   <SparklineList :hover="true">
 *     <Sparkline v-for="t in tickers" :key="t.id" type="line" :data="t.closes" />
 *   </SparklineList>
 * </template>
 * ```
 */
import {
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  ref,
  type ShallowRef,
  shallowRef,
  watch,
} from "vue";
import {
  type ColorSpec,
  createSparkline,
  createSparklineGroup,
  type HoverPayload,
  type SparklineCandle,
  type SparklineGroup,
  type SparklineHandle,
  type SparklineOptions,
} from "../src/sparkline";

export type {
  ColorSpec,
  HoverPayload,
  SparklineCandle,
  SparklineOptions,
} from "../src/sparkline";

const GROUP_KEY: InjectionKey<ShallowRef<SparklineGroup | null>> = Symbol("tc-sparkline-group");

export const SparklineList = defineComponent({
  name: "SparklineList",
  props: {
    hover: {
      type: [Boolean, Object] as PropType<boolean | { format?: (d: HoverPayload) => string }>,
      default: true,
    },
  },
  setup(props, { slots }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    const groupRef = shallowRef<SparklineGroup | null>(null);
    provide(GROUP_KEY, groupRef);

    onMounted(() => {
      if (!containerRef.value) return;
      groupRef.value = createSparklineGroup({
        container: containerRef.value,
        hover: props.hover,
      });
    });

    onBeforeUnmount(() => {
      groupRef.value?.destroy();
      groupRef.value = null;
    });

    return () => h("div", { ref: containerRef as unknown as string }, slots.default?.());
  },
});

export const Sparkline = defineComponent({
  name: "Sparkline",
  props: {
    type: {
      type: String as PropType<"line" | "candle">,
      required: true,
    },
    data: {
      type: Array as PropType<number[] | SparklineCandle[]>,
      required: true,
    },
    color: { type: Object as PropType<ColorSpec>, default: undefined },
    fill: { type: Boolean, default: true },
    baseline: {
      type: [String, Number, Boolean] as PropType<"auto" | number | false>,
      default: "auto",
    },
    maxCandles: { type: Number, default: 60 },
    totalSlots: { type: Number, default: undefined },
    session: {
      type: Object as PropType<NonNullable<SparklineOptions["session"]>>,
      default: undefined,
    },
    breakGap: {
      type: [String, Number] as PropType<NonNullable<SparklineOptions["breakGap"]>>,
      default: undefined,
    },
    colors: {
      type: Object as PropType<NonNullable<SparklineOptions["colors"]>>,
      default: undefined,
    },
    densityFallback: { type: Boolean, default: true },
    hover: { type: Boolean, default: true },
    width: { type: Number, default: 80 },
    height: { type: Number, default: 30 },
  },
  setup(props) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const handleRef = shallowRef<SparklineHandle | null>(null);
    const groupRef = inject(GROUP_KEY, null);

    const buildOpts = (): SparklineOptions => ({
      type: props.type,
      data: props.data as SparklineOptions["data"],
      color: props.color,
      fill: props.fill,
      baseline: props.baseline,
      maxCandles: props.maxCandles,
      totalSlots: props.totalSlots,
      session: props.session,
      breakGap: props.breakGap,
      colors: props.colors,
      densityFallback: props.densityFallback,
      hover: props.hover,
    });

    /** Track which mode the current handle was attached in, so we can detect
     *  the standalone→group transition (children mount before parent's onMounted
     *  inside <SparklineList>, so the first attach falls back to standalone). */
    let attachedMode: "standalone" | "group" | null = null;

    const attach = () => {
      if (!canvasRef.value) return;
      handleRef.value?.destroy();
      const opts = buildOpts();
      const group = groupRef?.value ?? null;
      if (group) {
        handleRef.value = group.add(canvasRef.value, opts);
        attachedMode = "group";
      } else {
        handleRef.value = createSparkline(canvasRef.value, opts);
        attachedMode = "standalone";
      }
    };

    onMounted(attach);

    // When the parent's <SparklineList> creates the shared group after our
    // initial mount, re-attach so we use delegated hover instead of our own
    // standalone tooltip.
    if (groupRef) {
      watch(
        () => groupRef.value,
        (g) => {
          if (!canvasRef.value) return;
          if (g && attachedMode !== "group") attach();
          else if (!g && attachedMode === "group") attach();
        },
      );
    }

    watch(
      [
        () => props.data,
        () => props.type,
        () => props.fill,
        () => props.baseline,
        () => props.color,
        () => props.maxCandles,
        () => props.totalSlots,
        () => props.session,
        () => props.breakGap,
        () => props.colors,
        () => props.densityFallback,
        () => props.hover,
      ],
      () => handleRef.value?.update(buildOpts()),
    );

    onBeforeUnmount(() => {
      handleRef.value?.destroy();
      handleRef.value = null;
    });

    return () =>
      h("canvas", {
        ref: canvasRef as unknown as string,
        width: props.width,
        height: props.height,
        style: {
          width: `${props.width}px`,
          height: `${props.height}px`,
          display: "inline-block",
        },
      });
  },
});
