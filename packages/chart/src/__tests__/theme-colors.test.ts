/**
 * Theme colours: the built-in palettes and semantic colours are checked
 * against each built-in theme (contrast with the background, distance from
 * the candle, crosshair and text colours, distance between entries with
 * normal vision and with protanopia / deuteranopia), and colour tokens are
 * resolved against the theme.
 */

import { describe, expect, it } from "vitest";
import {
  BUILTIN_PALETTES,
  BUILTIN_SEMANTIC,
  isKnownThemeColorToken,
  readThemeMode,
  resolveSeriesColors,
  resolveThemeColor,
} from "../core/theme-colors";
import { DARK_THEME, LIGHT_THEME, type ThemeColors } from "../core/types";
import { INDICATOR_PRESETS, type IndicatorPreset } from "../integration/indicator-presets";
import { registerTrendCraftPresets } from "../presets";
import { contrastRatio, deltaE, opaqueOver, type Vision } from "./helpers/color-metrics";

const THEMES = [
  ["dark", DARK_THEME],
  ["light", LIGHT_THEME],
] as const;

/** WCAG 2.2 SC 1.4.11: graphical objects need 3:1 against adjacent colours. */
const MIN_CONTRAST = 3;
/** ΔE_OK a line keeps from the candle colours. */
const MIN_FROM_CANDLES = 0.1;
/** ΔE_OK a palette colour keeps from the crosshair and text colours. */
const MIN_FROM_CHROME = 0.08;
/** ΔE_OK between any two of the first five palette colours, every vision. */
const MIN_FIRST_FIVE = 0.12;
/** ΔE_OK between any two palette colours, normal vision. */
const MIN_ALL = 0.09;
/** ΔE_OK between two shades of one meaning, and between meanings. */
const MIN_SEMANTIC = 0.12;

const VISIONS: Vision[] = ["normal", "protan", "deutan"];

function minPairwise(colors: readonly string[], vision: Vision): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      min = Math.min(min, deltaE(colors[i], colors[j], vision));
    }
  }
  return min;
}

describe.each(THEMES)("built-in %s palette", (mode, theme) => {
  const palette = BUILTIN_PALETTES[mode];

  it("has 3:1 contrast with the background", () => {
    for (const c of palette) {
      expect(contrastRatio(c, theme.background), c).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it("stays clear of the candle, crosshair and text colours", () => {
    for (const c of palette) {
      for (const candle of [theme.upColor, theme.downColor]) {
        expect(deltaE(c, candle), `${c} vs ${candle}`).toBeGreaterThanOrEqual(MIN_FROM_CANDLES);
      }
      for (const chrome of [theme.crosshair, theme.text, theme.textSecondary]) {
        expect(deltaE(c, chrome), `${c} vs ${chrome}`).toBeGreaterThanOrEqual(MIN_FROM_CHROME);
      }
    }
  });

  it.each(VISIONS)("keeps its first five colours apart (%s)", (vision) => {
    expect(minPairwise(palette.slice(0, 5), vision)).toBeGreaterThanOrEqual(MIN_FIRST_FIVE);
  });

  it("keeps every colour apart with normal vision", () => {
    expect(minPairwise(palette, "normal")).toBeGreaterThanOrEqual(MIN_ALL);
  });
});

it("gives both built-in palettes the same length, so dark ↔ light never renumbers", () => {
  expect(BUILTIN_PALETTES.dark.length).toBe(BUILTIN_PALETTES.light.length);
});

describe.each(THEMES)("built-in %s semantic colours", (mode, theme) => {
  const s = BUILTIN_SEMANTIC[mode];

  it("have 3:1 contrast with the background and stay clear of the candles", () => {
    for (const c of Object.values(s)) {
      expect(contrastRatio(c, theme.background), c).toBeGreaterThanOrEqual(MIN_CONTRAST);
      for (const candle of [theme.upColor, theme.downColor]) {
        expect(deltaE(c, candle), `${c} vs ${candle}`).toBeGreaterThanOrEqual(MIN_FROM_CANDLES);
      }
    }
  });

  it("tell the two shades of each meaning apart", () => {
    expect(deltaE(s.loss, s.lossSoft)).toBeGreaterThanOrEqual(MIN_SEMANTIC);
    expect(deltaE(s.profit, s.profitSoft)).toBeGreaterThanOrEqual(MIN_SEMANTIC);
  });

  it("keep the soft shade the one with less contrast", () => {
    const bg = theme.background;
    expect(contrastRatio(s.lossSoft, bg)).toBeLessThan(contrastRatio(s.loss, bg));
    expect(contrastRatio(s.profitSoft, bg)).toBeLessThan(contrastRatio(s.profit, bg));
  });

  it("keep all five apart with normal vision", () => {
    expect(minPairwise(Object.values(s), "normal")).toBeGreaterThanOrEqual(MIN_SEMANTIC);
  });
});

/**
 * Preset colours below 3:1 on a built-in theme when theme colours arrived.
 * Each is fixed in its own change; a fixed entry must leave this list (the
 * test fails while it is still listed), and a new colour must pass.
 */
const KNOWN_LOW_CONTRAST = new Set([
  "ichimoku.kijun dark",
  "ichimoku.senkouA dark",
  "ichimoku.senkouA light",
  "ichimoku.senkouB dark",
  "ichimoku.senkouB light",
  "ichimoku.chikou dark",
  "macd.signal light",
  "macd.histogramUp light",
  "dmi.adx light",
  "dmi.plusDi light",
  "oscillator.d light",
  "stochastics.d light",
  "aroon.up light",
  "supertrend.lowerBand light",
  "parabolicSar.color light",
  "pivotPoints.pivot light",
  "pivotPoints.s1 light",
  "pivotPoints.s2 light",
  "hmmRegime.color dark",
  "atrStops.shortStop light",
  "atrStops.longTP light",
  "atrStops.shortTP light",
  "fractals.downPrice light",
  "vsa.volume light",
  "ppo.signal light",
  "ppo.histogramUp light",
  "vortex.viPlus light",
  "trix.signal light",
  "tsi.signal light",
  "kst.signal light",
  "elderForceIndex.short light",
  "elderForceIndex.long dark",
  "klinger.signal light",
  "klinger.histogramUp light",
  "rsi.color light",
  "roc.color dark",
  "williamsR.color dark",
  "adxr.color light",
  "hurst.color dark",
  "bop.color light",
  "qstick.color dark",
  "massIndex.color dark",
  "choppiness.color dark",
  "garmanKlass.color dark",
  "obv.color light",
  "cmf.color light",
  "mfi.color light",
  "adl.color light",
  "nvi.color dark",
  "adaptiveRsi.color light",
  "adaptiveMa.color light",
  "adaptiveStochastics.color dark",
  "standardDeviation.color dark",
  "volatilityRegime.color dark",
  "volumeMa.color light",
  "cvdWithSignal.signal light",
  "slowStochastics.color light",
  "heikinAshi.color light",
  "swingPoints.low light",
  "zigzag.color light",
  "sessionBreakout.low light",
  "superSmoother.color light",
  "roofingFilter.color light",
  "lowest.color light",
  "medianPrice.color light",
  "atrPercent.color light",
]);

/**
 * Preset colours within ΔE_OK 0.10 of a candle colour when theme colours
 * arrived (several are histogram bars meant to match the candles, which
 * belong on "@up" / "@down"). Same rule as above: fixed entries leave.
 */
const KNOWN_NEAR_CANDLES = new Set([
  "macd.histogramUp dark",
  "macd.histogramDown dark",
  "macd.histogramUp light",
  "macd.histogramDown light",
  "dmi.plusDi dark",
  "dmi.minusDi dark",
  "dmi.plusDi light",
  "dmi.minusDi light",
  "aroon.up dark",
  "aroon.down dark",
  "aroon.up light",
  "aroon.down light",
  "supertrend.upperBand dark",
  "supertrend.lowerBand dark",
  "supertrend.upperBand light",
  "supertrend.lowerBand light",
  "pivotPoints.r1 dark",
  "pivotPoints.r2 dark",
  "pivotPoints.s1 dark",
  "pivotPoints.s2 dark",
  "pivotPoints.r1 light",
  "pivotPoints.r2 light",
  "pivotPoints.s1 light",
  "pivotPoints.s2 light",
  "atrStops.longStop dark",
  "atrStops.shortStop dark",
  "atrStops.longStop light",
  "atrStops.shortStop light",
  "fractals.upPrice dark",
  "fractals.downPrice dark",
  "fractals.upPrice light",
  "fractals.downPrice light",
  "ppo.histogramUp dark",
  "ppo.histogramDown dark",
  "ppo.histogramUp light",
  "ppo.histogramDown light",
  "vortex.viPlus dark",
  "vortex.viMinus dark",
  "vortex.viPlus light",
  "vortex.viMinus light",
  "klinger.histogramUp dark",
  "klinger.histogramDown dark",
  "klinger.histogramUp light",
  "klinger.histogramDown light",
  "cci.color dark",
  "cci.color light",
  "cmo.color dark",
  "cmo.color light",
  "imi.color dark",
  "imi.color light",
  "coppock.color dark",
  "coppock.color light",
  "ultimateOscillator.color dark",
  "ultimateOscillator.color light",
  "atr.color dark",
  "atr.color light",
  "ulcer.color dark",
  "ulcer.color light",
  "obv.color dark",
  "obv.color light",
  "cmf.color dark",
  "cmf.color light",
  "pvt.color dark",
  "pvt.color light",
  "cvd.color dark",
  "cvd.color light",
  "emv.color dark",
  "emv.color light",
  "adaptiveMa.color dark",
  "adaptiveMa.color light",
  "linearRegression.color dark",
  "linearRegression.color light",
  "volumeMa.color dark",
  "volumeMa.color light",
  "swingPoints.high dark",
  "swingPoints.low dark",
  "swingPoints.high light",
  "swingPoints.low light",
  "sessionBreakout.high dark",
  "sessionBreakout.low dark",
  "sessionBreakout.high light",
  "sessionBreakout.low light",
  "liquiditySweep.color dark",
  "liquiditySweep.color light",
  "highest.color dark",
  "highest.color light",
  "lowest.color dark",
  "lowest.color light",
  "weightedClose.color dark",
  "weightedClose.color light",
]);

/**
 * Pairs of lines in one preset within ΔE_OK 0.10 of each other when theme
 * colours arrived. Lines given the same colour on purpose are not checked.
 */
const KNOWN_CLOSE_LINES = new Set(["ichimoku.kijun/senkouB dark"]);

function allPresets(): Map<string, IndicatorPreset> {
  const presets = new Map<string, IndicatorPreset>(INDICATOR_PRESETS);
  registerTrendCraftPresets({
    addRule() {},
    addPreset: (name: string, preset: IndicatorPreset) => presets.set(name, preset),
    registerRenderer() {},
  } as never);
  return presets;
}

describe("preset colours", () => {
  const cases: [string, string, ThemeColors][] = [];
  for (const [name, preset] of allPresets()) {
    const colors: [string, string][] = [];
    if (typeof preset.color === "string") colors.push(["color", preset.color]);
    for (const [k, v] of Object.entries(preset.channelColors ?? {})) colors.push([k, v]);
    for (const [key, color] of colors) {
      for (const [mode, theme] of THEMES) cases.push([`${name}.${key} ${mode}`, color, theme]);
    }
  }

  it.each(cases)("%s (%s) has 3:1 contrast, or is a known exception", (id, color, theme) => {
    const drawn = opaqueOver(resolveThemeColor(color, theme), theme.background);
    const passes = contrastRatio(drawn, theme.background) >= MIN_CONTRAST;
    expect(passes, KNOWN_LOW_CONTRAST.has(id) ? "fixed: remove from the list" : "below 3:1").toBe(
      !KNOWN_LOW_CONTRAST.has(id),
    );
  });

  it.each(cases)(
    "%s (%s) stays clear of the candle colours, or is a known exception",
    (id, color, theme) => {
      const drawn = opaqueOver(resolveThemeColor(color, theme), theme.background);
      const clear = [theme.upColor, theme.downColor].every(
        (candle) => deltaE(drawn, candle) >= MIN_FROM_CANDLES,
      );
      expect(
        clear,
        KNOWN_NEAR_CANDLES.has(id) ? "fixed: remove from the list" : "near a candle",
      ).toBe(!KNOWN_NEAR_CANDLES.has(id));
    },
  );

  const pairs: [string, string, string, ThemeColors][] = [];
  for (const [name, preset] of allPresets()) {
    const colors = Object.entries(preset.channelColors ?? {});
    if (typeof preset.color === "string") colors.unshift(["color", preset.color]);
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        if (colors[i][1] === colors[j][1]) continue;
        for (const [mode, theme] of THEMES) {
          pairs.push([
            `${name}.${colors[i][0]}/${colors[j][0]} ${mode}`,
            colors[i][1],
            colors[j][1],
            theme,
          ]);
        }
      }
    }
  }

  it.each(pairs)(
    "%s: the lines of one preset stay apart, or are a known exception",
    (id, a, b, theme) => {
      const drawn = (c: string) => opaqueOver(resolveThemeColor(c, theme), theme.background);
      const apart = deltaE(drawn(a), drawn(b)) >= MIN_FROM_CANDLES;
      expect(apart, KNOWN_CLOSE_LINES.has(id) ? "fixed: remove from the list" : "too close").toBe(
        !KNOWN_CLOSE_LINES.has(id),
      );
    },
  );

  it("lists no exception that is not a preset colour", () => {
    const pairIds = new Set(pairs.map(([id]) => id));
    for (const id of KNOWN_CLOSE_LINES) expect(pairIds.has(id), id).toBe(true);
    const ids = new Set(cases.map(([id]) => id));
    for (const id of KNOWN_LOW_CONTRAST) expect(ids.has(id), id).toBe(true);
    for (const id of KNOWN_NEAR_CANDLES) expect(ids.has(id), id).toBe(true);
  });

  it("uses only known colour tokens", () => {
    for (const [id, color] of cases) {
      if (color.startsWith("@")) expect(isKnownThemeColorToken(color), id).toBe(true);
    }
  });
});

describe("resolveThemeColor", () => {
  it("returns a CSS colour as it is", () => {
    expect(resolveThemeColor("#2196F3", DARK_THEME)).toBe("#2196F3");
    expect(resolveThemeColor("rgba(1,2,3,0.5)", LIGHT_THEME)).toBe("rgba(1,2,3,0.5)");
  });

  it("follows the theme's candle colours for @up and @down", () => {
    const blue = { ...DARK_THEME, upColor: "#2962ff" };
    expect(resolveThemeColor("@up", blue)).toBe("#2962ff");
    expect(resolveThemeColor("@down", LIGHT_THEME)).toBe(LIGHT_THEME.downColor);
  });

  it("does not follow the candle colours for profit and loss", () => {
    const blue = { ...DARK_THEME, upColor: "#2962ff", downColor: "#ff6d00" };
    expect(resolveThemeColor("@profit", blue)).toBe(BUILTIN_SEMANTIC.dark.profit);
    expect(resolveThemeColor("@loss", blue)).toBe(BUILTIN_SEMANTIC.dark.loss);
  });

  it("takes semantic colours for the theme's mode, or its own", () => {
    expect(resolveThemeColor("@loss", LIGHT_THEME)).toBe(BUILTIN_SEMANTIC.light.loss);
    const own = { ...DARK_THEME, semantic: { loss: "#ff0000" } };
    expect(resolveThemeColor("@loss", own)).toBe("#ff0000");
    expect(resolveThemeColor("@profit", own)).toBe(BUILTIN_SEMANTIC.dark.profit);
  });

  it("takes palette entries, wrapping at the palette length", () => {
    expect(resolveThemeColor("@palette.0", DARK_THEME)).toBe(BUILTIN_PALETTES.dark[0]);
    expect(resolveThemeColor("@palette.1", LIGHT_THEME)).toBe(BUILTIN_PALETTES.light[1]);
    const three = { ...DARK_THEME, palette: ["#111111", "#222222", "#333333"] };
    expect(resolveThemeColor("@palette.4", three)).toBe("#222222");
  });

  it("draws an unknown token in the theme text colour", () => {
    expect(isKnownThemeColorToken("@nope")).toBe(false);
    expect(resolveThemeColor("@nope", DARK_THEME)).toBe(DARK_THEME.text);
  });

  it("picks the built-in colours for a spread theme by its background", () => {
    const white = { ...DARK_THEME, background: "#ffffff" };
    expect(resolveThemeColor("@palette.0", white)).toBe(BUILTIN_PALETTES.light[0]);
    expect(resolveThemeColor("@loss", white)).toBe(BUILTIN_SEMANTIC.light.loss);
  });
});

describe("readThemeMode", () => {
  it("reads a long malformed background in linear time", () => {
    // Many "rgb(" and no ")": an unanchored pattern retries from each one.
    const long = "rgb(".repeat(40_000);
    const start = performance.now();
    expect(readThemeMode({ ...DARK_THEME, background: long })).toBeUndefined();
    expect(
      readThemeMode({ ...DARK_THEME, background: `rgba(${"1,".repeat(100_000)}` }),
    ).toBeUndefined();
    // The unanchored pattern took about 2 s on this input.
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("reads the mode from an opaque background", () => {
    expect(readThemeMode(DARK_THEME)).toBe("dark");
    expect(readThemeMode(LIGHT_THEME)).toBe("light");
    expect(readThemeMode({ ...DARK_THEME, background: "rgb(250, 250, 250)" })).toBe("light");
  });

  it("prefers an explicit mode", () => {
    expect(readThemeMode({ ...DARK_THEME, background: "#ffffff", mode: "dark" })).toBe("dark");
  });

  it.each(["transparent", "rgba(255, 255, 255, 0.5)", "#ffffff80", "var(--bg)"])(
    "cannot read %s",
    (background) => {
      expect(readThemeMode({ ...DARK_THEME, background })).toBeUndefined();
      // …and falls back to the dark built-in colours.
      expect(resolveThemeColor("@palette.0", { ...DARK_THEME, background })).toBe(
        BUILTIN_PALETTES.dark[0],
      );
    },
  );

  it("uses the light built-in colours for a transparent background with mode: light", () => {
    const t = { ...DARK_THEME, background: "transparent", mode: "light" as const };
    expect(resolveThemeColor("@palette.0", t)).toBe(BUILTIN_PALETTES.light[0]);
  });
});

describe("resolveSeriesColors", () => {
  it("returns a config without tokens unchanged", () => {
    const config = { color: "#123456", channelColors: { a: "#abcdef" } };
    expect(resolveSeriesColors(config, DARK_THEME)).toBe(config);
  });

  it("resolves the colour, channel colours and marker colour", () => {
    const out = resolveSeriesColors(
      { color: "@palette.2", channelColors: { stop: "@loss" }, markers: { color: "@up" } },
      LIGHT_THEME,
    );
    expect(out.color).toBe(BUILTIN_PALETTES.light[2]);
    expect(out.channelColors).toEqual({ stop: BUILTIN_SEMANTIC.light.loss });
    expect(out.markers).toEqual({ color: LIGHT_THEME.upColor });
  });

  it("moves a channel off the first channel's colour when a theme puts them together", () => {
    // In the light theme "@palette.0" resolves to the colour the second
    // channel was given as a hex; in the dark theme they differ.
    const light0 = BUILTIN_PALETTES.light[0];
    const config = { channelColors: { line: "@palette.0", signal: light0 } };
    const dark = resolveSeriesColors(config, DARK_THEME).channelColors;
    expect(dark).toEqual({ line: BUILTIN_PALETTES.dark[0], signal: light0 });
    const light = resolveSeriesColors(config, LIGHT_THEME).channelColors ?? {};
    expect(light.line).toBe(light0);
    expect(light.signal).not.toBe(light0);
  });

  it("keeps channels that were given the same colour on purpose", () => {
    const out = resolveSeriesColors(
      { channelColors: { upper: "@loss", lower: "@loss" } },
      DARK_THEME,
    );
    expect(out.channelColors).toEqual({
      upper: BUILTIN_SEMANTIC.dark.loss,
      lower: BUILTIN_SEMANTIC.dark.loss,
    });
  });
});
