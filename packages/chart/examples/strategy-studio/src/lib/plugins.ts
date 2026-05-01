/**
 * Plugin catalog for the Strategy Studio PluginsPanel. Each entry knows how
 * to compute its data sources from a candle slice and connect a chart-side
 * primitive plugin.
 *
 * The `build` function returns a `PluginHandle` (or `null` if there isn't
 * enough data for the plugin to render — e.g. Andrews Pitchfork needs three
 * alternating swings). The host owns lifecycle: it calls `build` on toggle
 * on, stashes the handle, and calls `handle.remove()` on toggle off / on
 * any session rebuild.
 *
 * Replay-aware: pass `candles` already sliced to the playhead so plugins
 * never compute over future bars.
 */

import {
  type ChartInstance,
  connectAndrewsPitchfork,
  connectSmcLayer,
  connectVolumeProfile,
  connectWyckoffPhase,
} from "@trendcraft/chart";
import {
  breakOfStructure,
  changeOfCharacter,
  fairValueGap,
  getAlternatingSwingPoints,
  liquiditySweep,
  orderBlock,
  volumeProfile,
  vsa,
  wyckoffPhases,
} from "trendcraft";
import type { StudioCandle } from "./sample-data";

export type PluginCategory = "smc" | "structure" | "volume";

export type PluginHandle = { remove(): void };

export type PluginDef = {
  kind: string;
  label: string;
  category: PluginCategory;
  description: string;
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
];

export const PLUGIN_BY_KIND: Map<string, PluginDef> = new Map(
  PLUGIN_CATALOG.map((d) => [d.kind, d]),
);
