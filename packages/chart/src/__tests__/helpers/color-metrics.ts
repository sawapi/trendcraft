/**
 * Colour metrics for the palette and preset colour tests: WCAG contrast,
 * OKLab distance, and colour-vision-deficiency simulation (Machado,
 * Oliveira & Fernandes 2009, severity 1.0, applied in linear sRGB).
 */

function toLinear(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  return [0, 2, 4].map((i) => {
    const c = Number.parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = toLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio of two opaque hex colours. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const CVD = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
} as const;

export type Vision = "normal" | keyof typeof CVD;

function oklab(hex: string, vision: Vision): [number, number, number] {
  let [r, g, b] = toLinear(hex);
  if (vision !== "normal") {
    const m = CVD[vision];
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    [r, g, b] = [
      clamp(m[0][0] * r + m[0][1] * g + m[0][2] * b),
      clamp(m[1][0] * r + m[1][1] * g + m[1][2] * b),
      clamp(m[2][0] * r + m[2][1] * g + m[2][2] * b),
    ];
  }
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Euclidean distance in OKLab (ΔE_OK), as seen with the given vision. */
export function deltaE(a: string, b: string, vision: Vision = "normal"): number {
  const x = oklab(a, vision);
  const y = oklab(b, vision);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/**
 * `color` as an opaque hex colour over `background`: a hex colour as it is,
 * an `rgba()` colour blended onto the background.
 */
export function opaqueOver(color: string, background: string): string {
  const m = color.match(/^rgba?\(([^)]+)\)$/i);
  if (!m) return color;
  const [r, g, b, a = 1] = m[1].split(",").map((p) => Number.parseFloat(p));
  const bg = background.replace("#", "");
  const mix = (c: number, i: number) => {
    const under = Number.parseInt(bg.slice(i, i + 2), 16);
    return Math.round(c * a + under * (1 - a))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${mix(r, 0)}${mix(g, 2)}${mix(b, 4)}`;
}
