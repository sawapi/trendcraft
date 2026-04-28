import type { ColorSpec, ResolvedColors, SparklineCandle } from "./types";

export type StrokeAndFill = {
  /** Single stroke color for line mode, or default up color for candle. */
  stroke: string;
  /** Fill color (line mode). */
  fill: string;
  /** Per-candle up color. */
  up: string;
  /** Per-candle down color. */
  down: string;
  /** Whether per-candle coloring should compare each candle's open vs close. */
  perCandle: boolean;
};

function isCandle(d: number | SparklineCandle): d is SparklineCandle {
  return typeof d === "object" && d !== null && "close" in d;
}

function lastClose(data: number[] | SparklineCandle[]): number {
  if (data.length === 0) return 0;
  const last = data[data.length - 1];
  return isCandle(last) ? last.close : last;
}

function firstClose(data: number[] | SparklineCandle[]): number {
  if (data.length === 0) return 0;
  const first = data[0];
  return isCandle(first) ? first.close : first;
}

/**
 * Resolve a {@link ColorSpec} against the data into concrete colors.
 *
 * @param mode - 'line' or 'candle'. Affects whether `auto` and `up/down`
 *   map to per-candle coloring.
 */
export function resolveColors(
  spec: ColorSpec | undefined,
  data: number[] | SparklineCandle[],
  mode: "line" | "candle",
  defaults: ResolvedColors,
): StrokeAndFill {
  // Default: trend 'auto' — line uses period direction, candle uses per-bar.
  const effective: ColorSpec = spec ?? { trend: "auto" };

  if ("fixed" in effective) {
    return {
      stroke: effective.fixed,
      fill: effective.fixed,
      up: effective.fixed,
      down: effective.fixed,
      perCandle: false,
    };
  }

  if ("up" in effective && "down" in effective) {
    // Explicit up/down: per-candle for candle mode, period direction for line.
    if (mode === "candle") {
      return {
        stroke: effective.up,
        fill: effective.up,
        up: effective.up,
        down: effective.down,
        perCandle: true,
      };
    }
    const isUp = lastClose(data) >= firstClose(data);
    const color = isUp ? effective.up : effective.down;
    return {
      stroke: color,
      fill: color,
      up: effective.up,
      down: effective.down,
      perCandle: false,
    };
  }

  if ("baseline" in effective) {
    const isUp = lastClose(data) >= effective.baseline;
    const color = isUp ? defaults.up : defaults.down;
    return {
      stroke: color,
      fill: color,
      up: defaults.up,
      down: defaults.down,
      perCandle: false,
    };
  }

  // trend
  if (effective.trend === "auto" && mode === "candle") {
    // Industry standard: each candle colored by its own open/close.
    return {
      stroke: defaults.up,
      fill: defaults.up,
      up: defaults.up,
      down: defaults.down,
      perCandle: true,
    };
  }

  // 'auto' on line, or 'period' on either: single color by period direction.
  const isUp = lastClose(data) >= firstClose(data);
  const color = isUp ? defaults.up : defaults.down;
  return {
    stroke: color,
    fill: color,
    up: defaults.up,
    down: defaults.down,
    perCandle: false,
  };
}
