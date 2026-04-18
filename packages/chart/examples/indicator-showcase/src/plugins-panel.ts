/**
 * Plugins Panel — Toggle buttons for chart primitive plugins that don't fit
 * the `indicatorPresets` series-line model (background heatmaps, zones,
 * pitchfork, volume profile, etc.).
 *
 * Each entry computes its data from the current candles once and connects
 * the plugin on toggle. Tuned for demo data (200 daily bars) — production
 * callers would feed their own options/ranges.
 */

import type { ChartInstance } from "@trendcraft/chart";
import {
  connectAndrewsPitchfork,
  connectRegimeHeatmap,
  connectSessionZones,
  connectSmcLayer,
  connectSrConfluence,
  connectVolumeProfile,
  connectWyckoffPhase,
} from "@trendcraft/chart";
import type { NormalizedCandle } from "trendcraft";
import {
  fairValueGap,
  getAlternatingSwingPoints,
  hmmRegimes,
  killZones,
  liquiditySweep,
  orderBlock,
  srZones,
  volumeProfile,
  wyckoffPhases,
} from "trendcraft";

type PluginHandle = { remove: () => void };

type PluginSpec = {
  id: string;
  label: string;
  description: string;
  connect: () => PluginHandle | null;
};

export function createPluginsPanel(
  container: HTMLElement,
  candles: NormalizedCandle[],
  chart: ChartInstance,
): void {
  const active = new Map<string, PluginHandle>();

  const specs: PluginSpec[] = [
    {
      id: "srConfluence",
      label: "S/R Confluence",
      description: "Multi-source support/resistance zones",
      connect: () => {
        const { zones } = srZones(candles);
        return connectSrConfluence(chart, zones);
      },
    },
    {
      id: "smcLayer",
      label: "SMC Layer",
      description: "Order Blocks + FVG + Liquidity Sweeps",
      connect: () =>
        connectSmcLayer(chart, {
          orderBlocks: orderBlock(candles),
          fvgs: fairValueGap(candles),
          sweeps: liquiditySweep(candles),
        }),
    },
    {
      id: "regimeHeatmap",
      label: "Regime Heatmap",
      description: "HMM-classified market regime background",
      connect: () => connectRegimeHeatmap(chart, hmmRegimes(candles)),
    },
    {
      id: "wyckoffPhase",
      label: "Wyckoff Phase",
      description: "Accumulation / markup / distribution bands",
      connect: () => connectWyckoffPhase(chart, { phases: wyckoffPhases(candles) }),
    },
    {
      id: "sessionZones",
      label: "Session Zones",
      description: "ICT kill-zone backgrounds (Asia / London / NY)",
      connect: () => connectSessionZones(chart, killZones(candles)),
    },
    {
      id: "andrewsPitchfork",
      label: "Andrew's Pitchfork",
      description: "Median + handles from the last 3 swing anchors",
      connect: () => {
        const last3 = getAlternatingSwingPoints(candles, 3, { leftBars: 10, rightBars: 10 });
        if (last3.length < 3) return null;
        return connectAndrewsPitchfork(chart, {
          p0: { index: last3[0].index, price: last3[0].price },
          p1: { index: last3[1].index, price: last3[1].price },
          p2: { index: last3[2].index, price: last3[2].price },
        });
      },
    },
    {
      id: "volumeProfile",
      label: "Volume Profile",
      description: "Horizontal volume-by-price histogram + POC",
      connect: () => connectVolumeProfile(chart, volumeProfile(candles, { levels: 30 })),
    },
  ];

  // Header
  const header = document.createElement("div");
  header.style.cssText =
    "padding:10px 12px;background:#181c27;border-top:1px solid #2a2e39;border-bottom:1px solid #1e222d;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;";
  header.textContent = "▼ Plugins";
  container.appendChild(header);

  for (const spec of specs) {
    const row = document.createElement("div");
    row.style.cssText =
      "padding:8px 12px 8px 24px;cursor:pointer;border-bottom:1px solid #1e222d;display:flex;align-items:flex-start;gap:10px;user-select:none;";

    const checkbox = document.createElement("div");
    checkbox.style.cssText =
      "width:14px;height:14px;border:1px solid #4a4e59;border-radius:3px;margin-top:2px;flex-shrink:0;";

    const text = document.createElement("div");
    text.style.cssText = "flex:1;min-width:0;";
    const title = document.createElement("div");
    title.textContent = spec.label;
    title.style.cssText = "font-weight:500;";
    const desc = document.createElement("div");
    desc.textContent = spec.description;
    desc.style.cssText = "font-size:11px;color:#787b86;margin-top:2px;";
    text.appendChild(title);
    text.appendChild(desc);

    row.appendChild(checkbox);
    row.appendChild(text);
    container.appendChild(row);

    const applyActive = (isActive: boolean) => {
      if (isActive) {
        checkbox.style.background = "#2196F3";
        checkbox.style.borderColor = "#2196F3";
        row.style.background = "#1e2530";
      } else {
        checkbox.style.background = "transparent";
        checkbox.style.borderColor = "#4a4e59";
        row.style.background = "transparent";
      }
    };

    row.addEventListener("click", () => {
      const existing = active.get(spec.id);
      if (existing) {
        existing.remove();
        active.delete(spec.id);
        applyActive(false);
      } else {
        const handle = spec.connect();
        if (!handle) {
          console.warn(`Plugin ${spec.id} could not be connected (insufficient data)`);
          return;
        }
        active.set(spec.id, handle);
        applyActive(true);
      }
    });
  }
}
