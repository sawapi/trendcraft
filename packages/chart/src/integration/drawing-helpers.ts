/**
 * Drawing auto-injection helpers.
 *
 * Several TrendCraft indicators (`autoTrendLine`, `channelLine`,
 * `fibonacciRetracement`, `fibonacciExtension`) produce shape data that the
 * chart already knows how to render via its built-in drawing types. Instead
 * of reinventing primitive plugins for each, these helpers convert raw swing
 * anchors into `Drawing` objects and attach them to the chart.
 *
 * Design: all helpers take **pre-computed swing anchors**, so the chart package
 * keeps zero runtime dependency on `trendcraft`. Compose with
 * `getAlternatingSwingPoints` (or any equivalent detector) on the caller side:
 *
 * @example
 * ```ts
 * import { getAlternatingSwingPoints } from "trendcraft";
 * import { addAutoFibRetracement } from "@trendcraft/chart";
 *
 * const raw = getAlternatingSwingPoints(candles, { leftBars: 10, rightBars: 10 });
 * const anchors = raw.map(p => ({ time: p.time, price: p.value.price, type: p.value.type }));
 * const drawingId = addAutoFibRetracement(chart, anchors);
 * ```
 */

import type {
  ChannelDrawing,
  ChartInstance,
  FibExtensionDrawing,
  FibRetracementDrawing,
  TrendLineDrawing,
} from "../core/types";

/** Normalized swing anchor consumed by the drawing helpers. */
export type SwingAnchor = {
  time: number;
  price: number;
  type: "high" | "low";
};

/** Default Fibonacci retracement levels matching TradingView / most trading UIs. */
export const DEFAULT_FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/** Default Fibonacci extension levels. */
export const DEFAULT_FIB_EXTENSION_LEVELS = [0, 0.618, 1, 1.618, 2.618];

// ============================================
// Shared helpers
// ============================================

function lastTwoOfType(
  anchors: readonly SwingAnchor[],
  type: "high" | "low",
): [SwingAnchor, SwingAnchor] | null {
  const filtered = anchors.filter((a) => a.type === type);
  if (filtered.length < 2) return null;
  return [filtered[filtered.length - 2], filtered[filtered.length - 1]];
}

function lastThreeAlternating(
  anchors: readonly SwingAnchor[],
): [SwingAnchor, SwingAnchor, SwingAnchor] | null {
  if (anchors.length < 3) return null;
  return [anchors[anchors.length - 3], anchors[anchors.length - 2], anchors[anchors.length - 1]];
}

let autoIdCounter = 0;
function nextId(prefix: string): string {
  autoIdCounter += 1;
  return `${prefix}-${autoIdCounter}`;
}

// ============================================
// Fibonacci retracement / extension
// ============================================

export type AddFibOptions = {
  /** Fib ratios to draw. Defaults to DEFAULT_FIB_RETRACEMENT_LEVELS / _EXTENSION_LEVELS. */
  levels?: number[];
  /** Drawing stroke color. */
  color?: string;
  /** Drawing id prefix. Defaults to "auto-fib". */
  idPrefix?: string;
  /** Override drawing id completely (skips idPrefix / counter). */
  id?: string;
};

/**
 * Attach a Fibonacci retracement drawing between the two most recent swing
 * anchors. The high/low order is inferred from the anchors' timestamps.
 *
 * Returns the drawing id, or `null` if fewer than two swings were supplied.
 */
export function addAutoFibRetracement(
  chart: ChartInstance,
  anchors: readonly SwingAnchor[],
  options: AddFibOptions = {},
): string | null {
  if (anchors.length < 2) return null;
  const pairHigh = lastTwoOfType(anchors, "high");
  const pairLow = lastTwoOfType(anchors, "low");
  if (!pairHigh && !pairLow) return null;

  // Use the latest high + latest low as anchors (standard fib retracement).
  const latestHigh = pairHigh ? pairHigh[1] : null;
  const latestLow = pairLow ? pairLow[1] : null;
  if (!latestHigh || !latestLow) return null;

  // Start from the older anchor (the one forming the impulse), end at the newer.
  const [start, end] =
    latestHigh.time < latestLow.time ? [latestHigh, latestLow] : [latestLow, latestHigh];

  const drawing: FibRetracementDrawing = {
    id: options.id ?? nextId(options.idPrefix ?? "auto-fib"),
    type: "fibRetracement",
    startTime: start.time,
    startPrice: start.price,
    endTime: end.time,
    endPrice: end.price,
    levels: options.levels ?? DEFAULT_FIB_RETRACEMENT_LEVELS,
    ...(options.color ? { color: options.color } : {}),
  };
  chart.addDrawing(drawing);
  return drawing.id;
}

/**
 * Attach a Fibonacci extension drawing. Extension needs three anchors
 * (A, B, C) — pass the last three alternating swings.
 *
 * The chart's `fibExtension` drawing type takes A → B as the primary
 * impulse; levels project from B along the A→B direction. We pick the
 * last three alternating anchors in order and draw A→B.
 */
export function addAutoFibExtension(
  chart: ChartInstance,
  anchors: readonly SwingAnchor[],
  options: AddFibOptions = {},
): string | null {
  const trio = lastThreeAlternating(anchors);
  if (!trio) return null;
  const [a, b] = trio;

  const drawing: FibExtensionDrawing = {
    id: options.id ?? nextId(options.idPrefix ?? "auto-fibext"),
    type: "fibExtension",
    startTime: a.time,
    startPrice: a.price,
    endTime: b.time,
    endPrice: b.price,
    levels: options.levels ?? DEFAULT_FIB_EXTENSION_LEVELS,
    ...(options.color ? { color: options.color } : {}),
  };
  chart.addDrawing(drawing);
  return drawing.id;
}

// ============================================
// Auto trend line (resistance / support)
// ============================================

export type AddTrendLineOptions = {
  /** Which line to draw. Defaults to "resistance". */
  line?: "resistance" | "support";
  /** Extend the line's endpoint to this time. If omitted, uses the last anchor. */
  extendToTime?: number;
  /** Drawing stroke color. */
  color?: string;
  /** Drawing id prefix. Defaults to "auto-trend". */
  idPrefix?: string;
  /** Override drawing id completely. */
  id?: string;
};

/**
 * Attach a trend line connecting the two most recent swing highs (resistance)
 * or swing lows (support). Returns the drawing id, or `null` if fewer than
 * two same-type swings were supplied.
 */
export function addAutoTrendLine(
  chart: ChartInstance,
  anchors: readonly SwingAnchor[],
  options: AddTrendLineOptions = {},
): string | null {
  const wanted = options.line ?? "resistance";
  const type = wanted === "resistance" ? "high" : "low";
  const pair = lastTwoOfType(anchors, type);
  if (!pair) return null;
  const [a, b] = pair;

  // Compute slope-projected price at extendToTime (if past b).
  let endTime = b.time;
  let endPrice = b.price;
  if (options.extendToTime != null && options.extendToTime > b.time && b.time !== a.time) {
    const slope = (b.price - a.price) / (b.time - a.time);
    endTime = options.extendToTime;
    endPrice = b.price + slope * (options.extendToTime - b.time);
  }

  const drawing: TrendLineDrawing = {
    id: options.id ?? nextId(options.idPrefix ?? `auto-${wanted}`),
    type: "trendline",
    startTime: a.time,
    startPrice: a.price,
    endTime,
    endPrice,
    ...(options.color ? { color: options.color } : {}),
  };
  chart.addDrawing(drawing);
  return drawing.id;
}

// ============================================
// Channel line
// ============================================

export type AddChannelLineOptions = {
  /** Extend the channel's endpoint to this time. */
  extendToTime?: number;
  /** Drawing stroke color. */
  color?: string;
  /** Fill color for the channel interior. */
  fillColor?: string;
  /** Drawing id prefix. Defaults to "auto-channel". */
  idPrefix?: string;
  /** Override drawing id completely. */
  id?: string;
};

/**
 * Attach a parallel channel drawn between the two most recent swing highs
 * and offset by the distance to the most recent intervening swing low (or
 * vice versa for a descending channel). The base line goes through the
 * primary anchor pair; `channelWidth` is the perpendicular price distance
 * to the opposing swing.
 *
 * Returns the drawing id, or `null` if insufficient anchors were supplied.
 */
export function addAutoChannelLine(
  chart: ChartInstance,
  anchors: readonly SwingAnchor[],
  options: AddChannelLineOptions = {},
): string | null {
  const trio = lastThreeAlternating(anchors);
  if (!trio) return null;

  // Determine direction: two highs + one low = descending (upper = highs, lower offset)
  // two lows + one high   = ascending  (lower = lows, upper offset)
  const highs = trio.filter((a) => a.type === "high");
  const lows = trio.filter((a) => a.type === "low");

  let baseA: SwingAnchor;
  let baseB: SwingAnchor;
  let oppositeAnchor: SwingAnchor;
  if (highs.length === 2 && lows.length === 1) {
    baseA = highs[0];
    baseB = highs[1];
    oppositeAnchor = lows[0];
  } else if (lows.length === 2 && highs.length === 1) {
    baseA = lows[0];
    baseB = lows[1];
    oppositeAnchor = highs[0];
  } else {
    // Shouldn't happen given alternating input, but fall back to null safely.
    return null;
  }

  // Base line slope
  let endTime = baseB.time;
  let endPrice = baseB.price;
  let slope = 0;
  if (baseB.time !== baseA.time) {
    slope = (baseB.price - baseA.price) / (baseB.time - baseA.time);
  }
  if (options.extendToTime != null && options.extendToTime > baseB.time) {
    endTime = options.extendToTime;
    endPrice = baseB.price + slope * (options.extendToTime - baseB.time);
  }

  // Perpendicular price offset at the opposite swing's time
  const lineAtOppositeTime = baseA.price + slope * (oppositeAnchor.time - baseA.time);
  const channelWidth = oppositeAnchor.price - lineAtOppositeTime;

  const drawing: ChannelDrawing = {
    id: options.id ?? nextId(options.idPrefix ?? "auto-channel"),
    type: "channel",
    startTime: baseA.time,
    startPrice: baseA.price,
    endTime,
    endPrice,
    channelWidth,
    ...(options.color ? { color: options.color } : {}),
    ...(options.fillColor ? { fillColor: options.fillColor } : {}),
  };
  chart.addDrawing(drawing);
  return drawing.id;
}
