/**
 * Read `window.devicePixelRatio` and clamp to a finite positive value.
 * Falls back to 1 when running outside a browser, when DPR is 0 / NaN /
 * negative, or when DPR is `±Infinity` (the last is rare in practice
 * but breaks `canvas.width = w * dpr` if it slips through).
 */
export function safeDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  const dpr = window.devicePixelRatio;
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}
