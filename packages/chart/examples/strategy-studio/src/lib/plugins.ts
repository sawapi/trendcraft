/**
 * Plugin catalog for the Strategy Studio PluginsPanel. Each entry's `build`
 * returns a `PluginHandle` or `null` when the slice is too short to render
 * (Andrews Pitchfork needs 3 alternating swings, Volume Profile needs ≥20
 * bars). Host owns lifecycle: build on toggle on, `handle.remove()` on
 * toggle off or session rebuild.
 */

import {
  type ChartInstance,
  connectAndrewsPitchfork,
  connectPricePatterns,
  connectSmcLayer,
  connectVolumeProfile,
  connectWyckoffPhase,
  filterPricePatterns,
} from "@trendcraft/chart";
import {
  breakOfStructure,
  changeOfCharacter,
  doubleBottom,
  doubleTop,
  fairValueGap,
  getAlternatingSwingPoints,
  headAndShoulders,
  inverseHeadAndShoulders,
  liquiditySweep,
  orderBlock,
  type PatternSignal,
  volumeProfile,
  vsa,
  wyckoffPhases,
} from "trendcraft";
import type { CatalogEntry } from "../panels/ToggleCatalogPanel";
import type { StudioCandle } from "./sample-data";

export type PluginCategory = "smc" | "structure" | "volume" | "patterns";

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
];

export const PLUGIN_BY_KIND: Map<string, PluginDef> = new Map(
  PLUGIN_CATALOG.map((d) => [d.kind, d]),
);
