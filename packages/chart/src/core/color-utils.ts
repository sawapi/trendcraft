/**
 * Color helpers for theme-aware label rendering.
 *
 * The chart draws small filled rectangles (crosshair labels, info overlay badges)
 * with text on top. When the user supplies a custom theme, the label fill can
 * land anywhere in the luminance range — so picking the text color based on the
 * background keeps labels readable regardless of theme.
 */

/**
 * Parse a CSS color string into an sRGB triplet in the [0, 1] range.
 * Supports `#rgb`, `#rrggbb`, `rgb()`, `rgba()`, and the named colors `black` / `white`.
 * Returns `null` on unrecognized input — callers fall back to a safe default.
 */
export function parseColor(input: string): [number, number, number] | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();

  if (s === "black") return [0, 0, 0];
  if (s === "white") return [1, 1, 1];

  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = Number.parseInt(hex[0] + hex[0], 16);
      const g = Number.parseInt(hex[1] + hex[1], 16);
      const b = Number.parseInt(hex[2] + hex[2], 16);
      if ([r, g, b].every((n) => Number.isFinite(n))) return [r / 255, g / 255, b / 255];
      return null;
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].every((n) => Number.isFinite(n))) return [r / 255, g / 255, b / 255];
      return null;
    }
    return null;
  }

  if (s.startsWith("rgb")) {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(",").map((p) => p.trim());
    if (parts.length < 3) return null;
    const r = Number.parseFloat(parts[0]);
    const g = Number.parseFloat(parts[1]);
    const b = Number.parseFloat(parts[2]);
    if (![r, g, b].every((n) => Number.isFinite(n))) return null;
    return [r / 255, g / 255, b / 255];
  }

  return null;
}

/** WCAG 2.1 relative luminance of an sRGB color. */
export function relativeLuminance(rgb: [number, number, number]): number {
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgb;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Pick a readable text color (black or white) for the given background.
 * Uses WCAG relative luminance — returns white for dark backgrounds, black
 * for light ones. Unparseable inputs fall back to `fallback`.
 */
export function pickReadableTextColor(background: string, fallback = "#ffffff"): string {
  const rgb = parseColor(background);
  if (!rgb) return fallback;
  // 0.5 threshold keeps grey labels in the brighter-text regime, which matches
  // how most chart themes (dark + light) are already tuned.
  return relativeLuminance(rgb) < 0.5 ? "#ffffff" : "#000000";
}
