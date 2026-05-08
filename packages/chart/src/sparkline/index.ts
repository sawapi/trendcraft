/**
 * `@trendcraft/chart/sparkline` — ultra-lightweight mini chart for watchlists.
 *
 * Designed to scale to hundreds of instances on a single page (e.g. a watchlist
 * sidebar). No scales, axes, viewport interaction, or plugins — just a small
 * canvas drawing routine for line (+ optional fill) or compact candles, plus a
 * group wrapper that delegates hover for shared tooltip handling.
 *
 * @example Vanilla, single sparkline
 * ```ts
 * import { createSparkline } from '@trendcraft/chart/sparkline';
 *
 * const sl = createSparkline(document.querySelector('canvas')!, {
 *   type: 'line',
 *   data: closes,
 *   color: { trend: 'auto' },
 *   fill: true,
 * });
 * ```
 *
 * @example Group with shared hover
 * ```ts
 * import { createSparklineGroup } from '@trendcraft/chart/sparkline';
 *
 * const group = createSparklineGroup({ container: listEl, hover: true });
 * for (const ticker of tickers) {
 *   group.add(ticker.canvas, { type: 'line', data: ticker.closes });
 * }
 * ```
 */

import { createSparklineGroup } from "./group";
import type { SparklineHandle, SparklineOptions } from "./types";

export { resolveColors } from "./color-resolve";
export { drawMiniCandles } from "./draw-candle";
export { drawMiniLine } from "./draw-line";
export { createSparklineGroup } from "./group";
export type {
  ColorSpec,
  HoverPayload,
  ResolvedColors,
  SparklineCandle,
  SparklineGroup,
  SparklineGroupOptions,
  SparklineHandle,
  SparklineOptions,
  SparklineSession,
} from "./types";
export { DEFAULT_COLORS } from "./types";

/**
 * Create a single sparkline. For multiple instances on the same page, prefer
 * {@link createSparklineGroup} — it shares one mousemove listener and one
 * tooltip element across all sparklines.
 */
export function createSparkline(
  canvas: HTMLCanvasElement,
  opts: SparklineOptions,
): SparklineHandle {
  const container = canvas.parentElement ?? canvas;
  const enableHover = opts.hover !== false;
  const group = createSparklineGroup({
    container: container as HTMLElement,
    hover: enableHover,
  });
  const handle = group.add(canvas, opts);
  return {
    update: handle.update,
    render: handle.render,
    destroy: () => {
      handle.destroy();
      group.destroy();
    },
  };
}
