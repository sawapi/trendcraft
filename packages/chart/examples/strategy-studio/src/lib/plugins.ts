/**
 * Plugin catalog for the Strategy Studio PluginsPanel. Each entry's `build`
 * returns a `PluginHandle` or `null` when the slice is too short to render
 * (Andrews Pitchfork needs 3 alternating swings, Volume Profile needs ≥20
 * bars). Host owns lifecycle: build on toggle on, `handle.remove()` on
 * toggle off or session rebuild.
 */

import {
  addAutoChannelLine,
  addAutoFibExtension,
  addAutoFibRetracement,
  addAutoTrendLine,
  type ChartInstance,
  connectAndrewsPitchfork,
  connectMarketProfile,
  connectPricePatterns,
  connectRegimeHeatmap,
  connectSessionZones,
  connectSmcLayer,
  connectSqueezeDots,
  connectSrConfluence,
  connectVolumeProfile,
  connectWyckoffPhase,
  filterPricePatterns,
} from "@trendcraft/chart";
import {
  bollingerSqueeze,
  breakOfStructure,
  changeOfCharacter,
  doubleBottom,
  doubleTop,
  fairValueGap,
  getAlternatingSwingPoints,
  headAndShoulders,
  hmmRegimes,
  inverseHeadAndShoulders,
  killZones,
  liquiditySweep,
  marketProfile,
  orderBlock,
  type PatternSignal,
  srZones,
  volumeProfile,
  vsa,
  wyckoffPhases,
} from "trendcraft";
import type { CatalogEntry } from "../panels/ToggleCatalogPanel";
import type { StudioCandle } from "./sample-data";

export type PluginCategory =
  | "smc"
  | "structure"
  | "volume"
  | "patterns"
  | "regime"
  | "session"
  | "drawings"
  | "signals";

export type PluginHandle = { remove(): void };

export type PluginDef = CatalogEntry<PluginCategory> & {
  build: (chart: ChartInstance, candles: StudioCandle[]) => PluginHandle | null;
};

export const PLUGIN_CATALOG: readonly PluginDef[] = [
  {
    kind: "smcLayer",
    label: "SMC Layer",
    category: "smc",
    description:
      "Smart Money Concepts overlay: order blocks, fair value gaps, liquidity sweeps, BoS / CHoCH.",
    build: (chart, candles) => {
      if (candles.length < 30) return null;
      return connectSmcLayer(chart, {
        orderBlocks: orderBlock(candles),
        fvgs: fairValueGap(candles),
        sweeps: liquiditySweep(candles),
        bos: breakOfStructure(candles),
        choch: changeOfCharacter(candles),
      });
    },
  },
  {
    kind: "wyckoff",
    label: "Wyckoff Phase",
    category: "structure",
    description:
      "Phase boxes (accumulation / markup / distribution / markdown) with VSA confirmation.",
    build: (chart, candles) => {
      if (candles.length < 50) return null;
      return connectWyckoffPhase(chart, {
        phases: wyckoffPhases(candles),
        vsa: vsa(candles),
        candles,
      });
    },
  },
  {
    kind: "andrewsPitchfork",
    label: "Andrews Pitchfork",
    category: "structure",
    description:
      "Median + parallel handles drawn from the three most recent alternating swing points.",
    build: (chart, candles) => {
      const swings = getAlternatingSwingPoints(candles, 3, { leftBars: 10, rightBars: 10 });
      if (swings.length < 3) return null;
      const [p0, p1, p2] = swings;
      return connectAndrewsPitchfork(chart, {
        p0: { index: p0.index, price: p0.price },
        p1: { index: p1.index, price: p1.price },
        p2: { index: p2.index, price: p2.price },
      });
    },
  },
  {
    kind: "volumeProfile",
    label: "Volume Profile",
    category: "volume",
    description: "Horizontal histogram on the right edge: POC, VAH, VAL, value-area shading.",
    build: (chart, candles) => {
      if (candles.length < 20) return null;
      const profile = volumeProfile(candles, { levels: 30 });
      return connectVolumeProfile(chart, profile);
    },
  },
  {
    kind: "pricePatterns",
    label: "Price Patterns",
    category: "patterns",
    description:
      "Double tops / bottoms and (inverse) head-and-shoulders with measured-move targets and necklines.",
    build: (chart, candles) => {
      if (candles.length < 30) return null;
      const signals: PatternSignal[] = [
        ...doubleBottom(candles),
        ...doubleTop(candles),
        ...inverseHeadAndShoulders(candles),
        ...headAndShoulders(candles),
      ];
      // Pre-filter so the toggle stays "available" only when something
      // would actually render — otherwise the user sees an empty overlay
      // and can't tell whether the slice has no patterns or the plugin
      // failed silently.
      if (filterPricePatterns(signals).length === 0) return null;
      return connectPricePatterns(chart, signals);
    },
  },
  {
    kind: "srConfluence",
    label: "S/R Confluence",
    category: "structure",
    description:
      "Multi-source support / resistance zones (swing, pivot, VWAP, volume profile, round levels) clustered with strength scoring.",
    build: (chart, candles) => {
      if (candles.length < 30) return null;
      const { zones } = srZones(candles);
      if (zones.length === 0) return null;
      return connectSrConfluence(chart, zones);
    },
  },
  {
    kind: "regimeHeatmap",
    label: "Regime Heatmap",
    category: "regime",
    description:
      "HMM-classified market regime as a background heatmap (trend up / trend down / range / volatile).",
    build: (chart, candles) => {
      // HMM Baum-Welch needs enough observations to fit a 4-state mixture
      // — below ~60 bars the inferred regimes are noise.
      if (candles.length < 60) return null;
      return connectRegimeHeatmap(chart, hmmRegimes(candles));
    },
  },
  {
    kind: "sessionZones",
    label: "Session Zones",
    category: "session",
    description:
      "ICT kill-zone background bands (Tokyo / London / NY sessions). Needs intraday data to render.",
    build: (chart, candles) => {
      const zones = killZones(candles);
      if (zones.length === 0) return null;
      return connectSessionZones(chart, zones);
    },
  },
  {
    kind: "marketProfile",
    label: "Market Profile",
    category: "volume",
    description:
      "TPO-based time-at-price distribution: POC, VAH, VAL plus the full letter histogram on the right edge.",
    build: (chart, candles) => {
      if (candles.length < 20) return null;
      return connectMarketProfile(chart, marketProfile(candles));
    },
  },
  {
    kind: "autoFibRetracement",
    label: "Auto Fib Retracement",
    category: "drawings",
    description:
      "Auto-anchored 23.6 / 38.2 / 50 / 61.8 / 78.6 retracement between the latest swing high and low.",
    build: (chart, candles) => {
      const anchors = getAlternatingSwingPoints(candles, 4, { leftBars: 10, rightBars: 10 });
      if (anchors.length < 2) return null;
      const id = addAutoFibRetracement(chart, anchors);
      if (!id) return null;
      return { remove: () => chart.removeDrawing(id) };
    },
  },
  {
    kind: "autoFibExtension",
    label: "Auto Fib Extension",
    category: "drawings",
    description:
      "Auto-anchored extension projecting from the last three alternating swings (127.2 / 161.8 / 200 / 261.8).",
    build: (chart, candles) => {
      const anchors = getAlternatingSwingPoints(candles, 6, { leftBars: 10, rightBars: 10 });
      if (anchors.length < 3) return null;
      const id = addAutoFibExtension(chart, anchors);
      if (!id) return null;
      return { remove: () => chart.removeDrawing(id) };
    },
  },
  {
    kind: "autoTrendLines",
    label: "Auto Trend Lines",
    category: "structure",
    description:
      "Resistance + support trend lines through the last two swing highs and lows, extended to the latest bar.",
    build: (chart, candles) => {
      const anchors = getAlternatingSwingPoints(candles, 6, { leftBars: 10, rightBars: 10 });
      if (anchors.length < 2) return null;
      const extendToTime = candles[candles.length - 1]?.time ?? 0;
      const ids: string[] = [];
      const r = addAutoTrendLine(chart, anchors, { line: "resistance", extendToTime });
      if (r) ids.push(r);
      const s = addAutoTrendLine(chart, anchors, { line: "support", extendToTime });
      if (s) ids.push(s);
      if (ids.length === 0) return null;
      return {
        remove: () => {
          for (const id of ids) chart.removeDrawing(id);
        },
      };
    },
  },
  {
    kind: "autoChannel",
    label: "Auto Channel",
    category: "structure",
    description:
      "Parallel channel through the last two same-type swings with the opposing side as offset, extended to the latest bar.",
    build: (chart, candles) => {
      const anchors = getAlternatingSwingPoints(candles, 6, { leftBars: 10, rightBars: 10 });
      if (anchors.length < 3) return null;
      const extendToTime = candles[candles.length - 1]?.time ?? 0;
      const id = addAutoChannelLine(chart, anchors, { extendToTime });
      if (!id) return null;
      return { remove: () => chart.removeDrawing(id) };
    },
  },
  {
    kind: "squeezeDots",
    label: "Squeeze Dots",
    category: "signals",
    description:
      "TTM-style squeeze indicator dots along the pane bottom — red while Bollinger ⊂ Keltner, green on release.",
    build: (chart, candles) => {
      if (candles.length < 30) return null;
      const sigs = bollingerSqueeze(candles, { threshold: 10 });
      if (sigs.length === 0) return null;
      return connectSqueezeDots(chart, sigs, candles);
    },
  },
];

export const PLUGIN_BY_KIND: Map<string, PluginDef> = new Map(
  PLUGIN_CATALOG.map((d) => [d.kind, d]),
);
