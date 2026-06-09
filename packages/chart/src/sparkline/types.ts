import type { CandleData } from "../core/types";

export type SparklineCandle = CandleData;

/**
 * A trading session for {@link SparklineOptions.session}. All times are
 * ms epoch (the same units as `Candle.time`).
 */
export type SparklineSession = {
  /** Session start (ms epoch). */
  start: number;
  /** Session end (ms epoch). */
  end: number;
  /** Optional in-session breaks (e.g. JPX lunch 11:30-12:30 JST). */
  breaks?: Array<{ start: number; end: number }>;
};

/**
 * Color preset for a sparkline.
 *
 * - `{ trend: 'auto' }` (default): in line mode, the whole line is colored by
 *   period direction (last close vs first close). In candle mode, each candle
 *   is colored by its own open/close (industry-standard "green/red candles").
 * - `{ trend: 'period' }`: forces a single color across the whole sparkline,
 *   chosen by period direction. Useful in candle mode when you want the
 *   *whole* watchlist row to read as up/down at a glance.
 * - `{ baseline: N }`: single color, up/down decided by `last close vs N`.
 * - `{ fixed: '#xxx' }`: a single, trend-independent color.
 * - `{ up, down }`: explicit overrides for the auto palette. In candle mode
 *   these become per-candle up/down colors; in line mode the line is colored
 *   by period direction using the given pair.
 */
export type ColorSpec =
  | { trend: "auto" | "period" }
  | { baseline: number }
  | { fixed: string }
  | { up: string; down: string };

export type HoverPayload = {
  index: number;
  type: "line" | "candle";
  /** For line mode: the close value at index. For candle: candle.close. */
  value: number;
  /** Present when underlying data is OHLC. */
  candle?: SparklineCandle;
};

export type ResolvedColors = {
  /** Default up color (green-ish). */
  up: string;
  /** Default down color (red-ish). */
  down: string;
  /** Stroke color for the dashed baseline. */
  baseline: string;
  /** Optional fill alpha 0..1. */
  fillAlpha: number;
};

export const DEFAULT_COLORS: ResolvedColors = {
  up: "#16a34a",
  down: "#dc2626",
  baseline: "#9ca3af",
  fillAlpha: 0.18,
};

export type SparklineOptions = {
  type: "line" | "candle";
  /**
   * For `line`: number[] (closes) or SparklineCandle[] (will use close).
   * For `candle`: SparklineCandle[] required.
   */
  data: number[] | SparklineCandle[];
  color?: ColorSpec;
  /** Fill area between line and baseline (line mode only). Default: true. */
  fill?: boolean;
  /** Baseline value: 'auto' (data[0] for line / first open for candle), number, or false to disable. Default: 'auto'. */
  baseline?: "auto" | number | false;
  /** Cap candle count from the tail (candle only). Default: 60. */
  maxCandles?: number;
  /**
   * Total horizontal slots the chart represents. Low-level escape hatch —
   * prefer `session` for time-based intraday charts. When set without
   * `session`, data fills only `data.length / totalSlots` of the canvas;
   * the rest stays blank.
   *
   * Default: data.length (data fills the canvas).
   */
  totalSlots?: number;
  /**
   * Map data points to wall-clock positions within a trading session.
   * The canvas's full horizontal extent represents `[start, end]` in ms epoch,
   * minus any `breaks`. Data points are placed at their `time` (Candle.time
   * or DataPoint.time); points outside the session or inside a break are
   * skipped. Requires the data to carry time information — use
   * `Candle[]` (line or candle mode) or omit `session` for plain `number[]`.
   *
   * Overrides `totalSlots` when both are set.
   *
   * @example Nikkei intraday with lunch break
   * ```ts
   * const sessionStart = new Date('2026-04-28T09:00:00+09:00').getTime();
   * const sessionEnd   = new Date('2026-04-28T15:30:00+09:00').getTime();
   * const lunchStart   = new Date('2026-04-28T11:30:00+09:00').getTime();
   * const lunchEnd     = new Date('2026-04-28T12:30:00+09:00').getTime();
   *
   * createSparkline(cv, {
   *   type: 'candle',
   *   data: candles,
   *   session: {
   *     start: sessionStart,
   *     end: sessionEnd,
   *     breaks: [{ start: lunchStart, end: lunchEnd }],
   *   },
   * });
   * ```
   */
  session?: SparklineSession;
  /**
   * Visual gap (in CSS pixels) reserved on the canvas for each session break.
   * 'auto' = max(2, width * 0.03); `0` disables the gap (Yahoo-style — 11:30
   * and 12:30 candles end up adjacent). Default: 'auto'.
   */
  breakGap?: number | "auto";
  /** When candle width < 2px, fall back to line. Default: true. */
  densityFallback?: boolean;
  /** Theme/color overrides. */
  colors?: Partial<ResolvedColors>;
  /** Enable hover (only meaningful when used inside createSparklineGroup). */
  hover?: boolean;
};

/**
 * The `SparklineOptions` keys a live `update()` must react to — the single
 * source of truth the React effect-deps, the Vue watch sources, and the Vue
 * prop→options builder all derive from. Add a new live-updatable option here
 * and every wrapper picks it up; forgetting one is exactly what silently drops
 * an option from live updates. Layout-only props (width / height / style /
 * className) are intentionally excluded.
 */
export const SPARKLINE_OPTION_KEYS = [
  "type",
  "data",
  "color",
  "fill",
  "baseline",
  "maxCandles",
  "totalSlots",
  "session",
  "breakGap",
  "densityFallback",
  "colors",
  "hover",
] as const satisfies readonly (keyof SparklineOptions)[];

export type SparklineHandle = {
  /** Update options and re-render. Pass partial; only changed fields apply. */
  update(opts: Partial<SparklineOptions>): void;
  /** Re-render without changing options (e.g. after canvas resize). */
  render(): void;
  destroy(): void;
};

export type SparklineGroupOptions = {
  container: HTMLElement;
  hover?: boolean | { format?: (d: HoverPayload) => string };
};

export type SparklineGroup = {
  add(canvas: HTMLCanvasElement, opts: SparklineOptions): SparklineHandle;
  destroy(): void;
};
