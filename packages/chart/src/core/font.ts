/**
 * Shared canvas/DOM font helpers for @trendcraft/chart.
 *
 * The default stack matches the historical hardcoded value used by every
 * renderer before `ChartOptions.fontFamily` was wired through.
 */

/** Default system UI font stack (backward-compatible visual default). */
export const DEFAULT_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/**
 * Build a CSS `font` value for canvas `ctx.font` (and similar).
 *
 * @example
 * ```ts
 * const regular = canvasFont(11);
 * // => '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
 * const bold = canvasFont(11, DEFAULT_FONT_FAMILY, "bold");
 * // => 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
 * ```
 */
export function canvasFont(
  sizePx: number,
  fontFamily: string = DEFAULT_FONT_FAMILY,
  weight?: "bold" | "normal",
): string {
  const family = fontFamily || DEFAULT_FONT_FAMILY;
  return weight === "bold" ? `bold ${sizePx}px ${family}` : `${sizePx}px ${family}`;
}
