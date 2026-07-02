/**
 * Chart options and runtime behavior types
 */

import type { DrawingType } from "./drawing";
import type { CandleData } from "./fundamental";
import type { ThemeColors } from "./theme";

export type ChartOptions = {
  /** Chart width in pixels (default: container width) */
  width?: number;
  /** Chart height in pixels (default: 400) */
  height?: number;
  /** Color theme */
  theme?: "dark" | "light" | ThemeColors;
  /** Device pixel ratio (default: window.devicePixelRatio) */
  pixelRatio?: number;
  /** Right margin for price axis in pixels (default: 60) */
  priceAxisWidth?: number;
  /** Bottom margin for time axis in pixels (default: 32) */
  timeAxisHeight?: number;
  /** Font family (default: system) */
  fontFamily?: string;
  /** Font size in pixels (default: 11) */
  fontSize?: number;
  /** Custom price formatter (default: auto-precision) */
  priceFormatter?: (price: number) => string;
  /** Custom time formatter (default: smart date/time) */
  timeFormatter?: (time: number) => string;
  /** Watermark text displayed in chart background */
  watermark?: string;
  /** Show legend widget (default: true) */
  legend?: boolean;
  /** Show volume pane (default: true) */
  volume?: boolean;
  /**
   * Show a colored last-value pill on the right price axis for every labeled
   * series (including each channel of multi-channel series like Bollinger
   * Bands / MACD) and for the volume pane. Default: false. The candle
   * current-price badge is always shown regardless of this setting.
   */
  showSeriesBadges?: boolean;
  /**
   * Which "last value" to show in series badges:
   * - `"absolute"` (default): the last non-null value in the underlying data
   *   array — i.e. the live / latest known value, even if the viewport has
   *   scrolled back.
   * - `"visible"`: the last non-null value within the current visible range
   *   — what the user sees at the right edge of the chart.
   */
  seriesBadgeMode?: "absolute" | "visible";
  /** Scroll/pan sensitivity multiplier (default: 0.3, lower = slower) */
  scrollSensitivity?: number;
  /** Base chart type for price data (default: 'candlestick') */
  chartType?: ChartType;
  /** Custom info overlay formatter. Return HTML string or null to use default. */
  formatInfoOverlay?: (data: InfoOverlayData) => string | null;
  /** Animation duration in ms for range transitions (default: 300, 0 to disable) */
  animationDuration?: number;
  /** Locale strings for i18n (partial override of defaults) */
  locale?: Partial<import("../i18n").ChartLocale>;
  /** Maximum number of candles to retain in live mode. Older candles are trimmed when exceeded. */
  maxCandles?: number;
  /** Crosshair behavior */
  crosshair?: CrosshairOptions;
  /** Keyboard shortcut overrides. Pass `false` to disable all shortcuts (including Escape cancel). */
  hotkeys?: Partial<Record<string, HotkeyAction>> | false;
  /** Interaction behavior */
  interaction?: InteractionOptions;
  /** Time scale behavior (session gaps, etc.) */
  timeScale?: TimeScaleOptions;
};

/**
 * Options for the time scale. Currently controls whether visual gaps are
 * inserted between trading sessions when the data is intraday.
 */
export type TimeScaleOptions = {
  /**
   * Insert visual gaps between trading sessions (e.g. overnight breaks in
   * intraday data) so the x-axis shows empty space rather than compressing
   * non-trading hours to a zero-width seam.
   *
   * - `false` / omitted (default): index-based layout with no gaps (legacy).
   * - `true`: auto-detect intraday (median bar interval < 6h) and insert a
   *   gap wherever consecutive bars have a time delta significantly larger
   *   than the median (e.g. overnight, weekends). TZ-agnostic.
   * - object form: fine-grained control.
   */
  sessionGaps?: boolean | SessionGapsOptions;
};

export type SessionGapsOptions = {
  /**
   * Detection mode:
   * - `"timeGap"` (default): insert a gap whenever the time delta between
   *   consecutive bars exceeds `gapThresholdMs` (or 4 hours when unset).
   *   Works correctly regardless of data timezone.
   * - `"dayBoundary"`: insert a gap whenever the UTC calendar day changes
   *   between consecutive bars. Useful for 24×7 data (crypto / FX) where
   *   time deltas are uniform but you still want a daily divider.
   * - `"off"`: disabled.
   */
  mode?: "timeGap" | "dayBoundary" | "off";
  /** Gap size in bar-widths (default: 1.0). */
  sizeBars?: number;
  /** Only enable if median bar interval ≤ this many ms (default: 6h). */
  intradayThresholdMs?: number;
  /** For `"timeGap"` mode: the minimum delta to count as a session gap (default: 4 hours). */
  gapThresholdMs?: number;
};

/**
 * Crosshair modes:
 * - `"normal"` — snaps only to the time axis (x), y follows the pointer (default)
 * - `"magnet"` — snaps x to the nearest bar and y to that bar's close
 * - `"magnetOHLC"` — snaps x to the nearest bar and y to the nearest of the bar's O/H/L/C values
 *   (within `snapThreshold` pixels; falls back to pointer y beyond the threshold)
 */
export type CrosshairMode = "normal" | "magnet" | "magnetOHLC";

export type CrosshairOptions = {
  /** Snap mode (default: "normal") */
  mode?: CrosshairMode;
  /** Pixel distance within which OHLC snapping engages for `magnetOHLC` (default: 12) */
  snapThreshold?: number;
  /** Enable long-press crosshair lock on touch devices (default: true) */
  lockOnLongPress?: boolean;
};

export type InteractionOptions = {
  /**
   * Enable the chart's own inertia tail after a wheel/trackpad gesture ends
   * (default: true). Applies to both horizontal pan and zoom via the wheel.
   *
   * **Platform note:** on macOS, trackpads generate an OS-level momentum
   * scroll that continues sending wheel events for a few hundred ms after
   * the user lifts their fingers. Those are indistinguishable from user
   * input and are always processed; this option only gates the synthetic
   * inertia the chart adds on top once OS momentum has finished. On
   * platforms without OS momentum (Windows mouse wheel, most Linux
   * setups) the gesture stops immediately when this is false.
   */
  wheelInertia?: boolean;
};

/**
 * Hotkey actions. Either a drawing tool to activate (via Alt+letter),
 * `"cancel"` (Escape), or `"toggleOverlays"` (Ctrl+Alt+H — temporarily hide/show every series).
 */
export type HotkeyAction = DrawingType | "cancel" | "toggleOverlays";

/** Base chart rendering type */
export type ChartType = "candlestick" | "line" | "mountain" | "ohlc";

/** Data passed to the formatInfoOverlay callback */
export type InfoOverlayData = {
  candle: CandleData;
  index: number;
  paneId: string;
  series: { label: string; color: string; value: unknown }[];
};

/** Duration presets for range selector */
export type RangeDuration = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "ALL";
