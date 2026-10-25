/** Prevent XSS from user-supplied labels / colors / locale strings. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}

let colorCtx: CanvasRenderingContext2D | null = null;
const colorCache = new Map<string, string | null>();

/** Canonical form of `c` from the canvas colour parser, or null if it rejects it. */
function canonicalColor(c: string): string | null {
  // A detached canvas has no inherited colour and would turn this into black.
  if (/^currentcolor$/i.test(c)) return "currentColor";
  colorCtx ??= document.createElement("canvas").getContext("2d");
  if (!colorCtx) return null;
  // A rejected assignment is ignored, so the old value survives: try two
  // different sentinels and accept only a result both were overwritten with.
  colorCtx.fillStyle = "#000";
  colorCtx.fillStyle = c;
  const a = colorCtx.fillStyle;
  colorCtx.fillStyle = "#fff";
  colorCtx.fillStyle = c;
  return typeof a === "string" && a === colorCtx.fillStyle ? a : null;
}

/**
 * Normalise a caller-supplied colour for a `style` attribute. HTML escaping
 * keeps a value inside the attribute but not inside its declaration:
 * `red;background:url(...)`, a bare `url(...)` after `background:`, or a
 * `var(--x, url(...))` fallback would make the browser fetch a URL. The
 * colour is instead round-tripped through the canvas parser, which rejects
 * anything that is not a plain colour and returns a canonical colour string
 * (e.g. `#rrggbb`, `rgba(...)`, `oklch(...)`), so the output cannot carry
 * markup or extra CSS. A rejected colour yields
 * `fallback`, which must itself be safe (another `cssColor` result or "").
 * Without a DOM nothing renders the markup, so the value is only escaped.
 */
export function cssColor(c: string, fallback = ""): string {
  if (typeof document === "undefined") return escapeHtml(c);
  let out = colorCache.get(c);
  if (out === undefined) {
    if (colorCache.size >= 256) colorCache.clear();
    out = canonicalColor(c);
    colorCache.set(c, out);
  }
  return out ?? fallback;
}
