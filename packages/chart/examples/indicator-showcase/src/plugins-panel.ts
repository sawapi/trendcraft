/**
 * Plugins Panel — Toggle buttons for chart primitive plugins that don't fit
 * the `indicatorPresets` series-line model (background heatmaps, zones,
 * pitchfork, volume profile, etc.).
 *
 * Each entry computes its data from the current candles on toggle and
 * connects the plugin. The panel can be rebuilt against a new candle set
 * (e.g. daily ↔ intraday switch) via `destroy()` + re-create.
 *
 * Live mode: when `opts.live` is provided, every active plugin is also
 * driven by `connectLivePrimitives` so it recomputes on every candleComplete
 * event from the live source.
 */

import type { ChartInstance, LivePrimitivesConnection } from "@trendcraft/chart";
import {
  connectAndrewsPitchfork,
  connectLivePrimitives,
  connectMarketProfile,
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
  marketProfile,
  orderBlock,
  srZones,
  volumeProfile,
  vsa,
  wyckoffPhases,
} from "trendcraft";
import type { LiveSource } from "./live-simulator";

// Per-plugin update signatures vary (zones[], smc sources, regime data, etc.).
// Each spec pairs the matching `recompute` shape with its own handle, so
// widening here is safe.
type PluginHandle = {
  remove: () => void;
  // biome-ignore lint/suspicious/noExplicitAny: see comment above
  update: (data: any) => void;
};

/**
 * One plugin spec — produces both a handle and the recompute closure that
 * the live wiring can call on every candleComplete.
 */
type PluginSpec = {
  id: string;
  label: string;
  description: string;
  /** Returns null when the candle history can't satisfy the plugin (e.g. <3 swings). */
  build: (candles: NormalizedCandle[]) => {
    handle: PluginHandle;
    recompute: (cs: readonly NormalizedCandle[]) => unknown;
  } | null;
};

export type PluginsPanelHandle = {
  /** Remove the panel DOM + detach every active plugin from the chart. */
  destroy(): void;
};

const SPECS: PluginSpec[] = [
  {
    id: "srConfluence",
    label: "S/R Confluence",
    description: "Multi-source support/resistance zones",
    build: (candles) => {
      const handle = connectSrConfluence(chartRef, srZones(candles).zones);
      return {
        handle: handle as PluginHandle,
        recompute: (cs) => srZones(cs as NormalizedCandle[]).zones,
      };
    },
  },
  {
    id: "smcLayer",
    label: "SMC Layer (bundle)",
    description:
      "OB + FVG + Sweeps in one pass — use the individual SMC presets for per-indicator params",
    build: (candles) => {
      const sources = {
        orderBlocks: orderBlock(candles),
        fvgs: fairValueGap(candles),
        sweeps: liquiditySweep(candles),
      };
      const handle = connectSmcLayer(chartRef, sources);
      return {
        handle: handle as PluginHandle,
        recompute: (cs) => {
          const arr = cs as NormalizedCandle[];
          return {
            orderBlocks: orderBlock(arr),
            fvgs: fairValueGap(arr),
            sweeps: liquiditySweep(arr),
          };
        },
      };
    },
  },
  {
    id: "regimeHeatmap",
    label: "Regime Heatmap",
    description: "HMM-classified market regime background",
    build: (candles) => {
      const handle = connectRegimeHeatmap(chartRef, hmmRegimes(candles));
      return {
        handle: handle as PluginHandle,
        recompute: (cs) => hmmRegimes(cs as NormalizedCandle[]),
      };
    },
  },
  {
    id: "wyckoffPhase",
    label: "Wyckoff Phase",
    description: "Range boxes + PS/SC/SOS/... event labels + phase badge",
    build: (candles) => {
      const handle = connectWyckoffPhase(chartRef, {
        phases: wyckoffPhases(candles),
        vsa: vsa(candles),
        candles,
      });
      return {
        handle: handle as PluginHandle,
        recompute: (cs) => {
          const arr = cs as NormalizedCandle[];
          return {
            phases: wyckoffPhases(arr),
            vsa: vsa(arr),
            candles: arr,
          };
        },
      };
    },
  },
  {
    id: "sessionZones",
    label: "Session Zones",
    description: "ICT kill-zone backgrounds (needs intraday data)",
    build: (candles) => {
      const handle = connectSessionZones(chartRef, killZones(candles));
      return {
        handle: handle as PluginHandle,
        recompute: (cs) => killZones(cs as NormalizedCandle[]),
      };
    },
  },
  {
    id: "andrewsPitchfork",
    label: "Andrew's Pitchfork",
    description: "Median + handles from the last 3 swing anchors",
    build: (candles) => {
      const points = pitchforkPoints(candles);
      if (!points) return null;
      const handle = connectAndrewsPitchfork(chartRef, points);
      return {
        handle: handle as PluginHandle,
        recompute: (cs) => pitchforkPoints(cs as NormalizedCandle[]) ?? points,
      };
    },
  },
  {
    id: "volumeProfile",
    label: "Volume Profile",
    description: "Horizontal volume-by-price histogram + POC",
    build: (candles) => {
      const handle = connectVolumeProfile(chartRef, volumeProfile(candles, { levels: 30 }));
      return {
        handle: handle as PluginHandle,
        recompute: (cs) => volumeProfile(cs as NormalizedCandle[], { levels: 30 }),
      };
    },
  },
  {
    id: "marketProfile",
    label: "Market Profile",
    description: "TPO-based time-at-price + POC / VAH / VAL",
    build: (candles) => {
      const handle = connectMarketProfile(chartRef, marketProfile(candles));
      return {
        handle: handle as PluginHandle,
        recompute: (cs) => marketProfile(cs as NormalizedCandle[]),
      };
    },
  },
];

function pitchforkPoints(candles: NormalizedCandle[]) {
  const last3 = getAlternatingSwingPoints(candles, 3, { leftBars: 10, rightBars: 10 });
  if (last3.length < 3) return null;
  return {
    p0: { index: last3[0].index, price: last3[0].price },
    p1: { index: last3[1].index, price: last3[1].price },
    p2: { index: last3[2].index, price: last3[2].price },
  };
}

// The specs above close over a mutable `chartRef`. The panel factory sets it
// on every mount so SPECS can stay a single module-level list.
let chartRef: ChartInstance = null as unknown as ChartInstance;

export function createPluginsPanel(
  container: HTMLElement,
  candles: NormalizedCandle[],
  chart: ChartInstance,
  opts: { live?: LiveSource } = {},
): PluginsPanelHandle {
  chartRef = chart;
  const active = new Map<string, PluginHandle>();
  const liveConns = new Map<string, LivePrimitivesConnection>();
  const panelRoot = document.createElement("div");
  panelRoot.dataset.role = "plugins-panel";
  container.appendChild(panelRoot);

  // Header
  const header = document.createElement("div");
  header.style.cssText =
    "padding:10px 12px;background:#181c27;border-top:1px solid #2a2e39;border-bottom:1px solid #1e222d;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;";
  header.textContent = "▼ Plugins";
  panelRoot.appendChild(header);

  for (const spec of SPECS) {
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
    panelRoot.appendChild(row);

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
        liveConns.get(spec.id)?.disconnect();
        liveConns.delete(spec.id);
        existing.remove();
        active.delete(spec.id);
        applyActive(false);
      } else {
        const built = spec.build(candles);
        if (!built) {
          console.warn(`Plugin ${spec.id} could not be connected (insufficient data)`);
          return;
        }
        active.set(spec.id, built.handle);
        applyActive(true);
        if (opts.live) {
          const conn = connectLivePrimitives(opts.live, [
            { recompute: built.recompute, handle: built.handle, name: spec.id },
          ]);
          liveConns.set(spec.id, conn);
        }
      }
    });
  }

  return {
    destroy() {
      for (const conn of liveConns.values()) conn.disconnect();
      liveConns.clear();
      for (const h of active.values()) h.remove();
      active.clear();
      panelRoot.remove();
    },
  };
}
