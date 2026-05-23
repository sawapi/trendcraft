import { connectIndicators, type IndicatorConnection, type SignalMarker } from "@trendcraft/chart";
import { registerTrendCraftPresets } from "@trendcraft/chart/presets";
import { useTrendChart } from "@trendcraft/chart/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { indicatorPresets, parseStrategy, validateStrategyJSON } from "trendcraft";
import { ChartToolbar } from "./components/ChartToolbar";
import { DataSourcePanel } from "./components/DataSourcePanel";
import { useBacktestRunner } from "./hooks/useBacktestRunner";
import { useDataSource } from "./hooks/useDataSource";
import { useRegime } from "./hooks/useRegime";
import { dataSourceKey } from "./lib/data-sources";
import { createLiveSimulator, type SimulatorHandle } from "./lib/live-simulator";
import type { OptimizationComputation } from "./lib/optimization";
import { PLUGIN_BY_KIND, type PluginHandle } from "./lib/plugins";
import { clampedSeedEnd, lastEmittedIdx } from "./lib/replay";
import { SIGNAL_BY_KIND } from "./lib/signals";
import { builderReducer, initialBuilderState, strategyJSONToState } from "./lib/strategy-state";
import { localStudioAPI } from "./lib/studio-api";
import { MetaStrategyPanel } from "./panels/MetaStrategyPanel";
import { OptimizationPanel } from "./panels/OptimizationPanel";
import { ParamPopover } from "./panels/ParamPopover";
import { PluginsPanel } from "./panels/PluginsPanel";
import { PortfolioPanel } from "./panels/PortfolioPanel";
import { PresetSelector } from "./panels/PresetSelector";
import { ReplayControls, type SpeedTier } from "./panels/ReplayControls";
import { ResultsSummary } from "./panels/ResultsSummary";
import { RiskPanel } from "./panels/RiskPanel";
import { ScoringPanel } from "./panels/ScoringPanel";
import { SignalsPanel } from "./panels/SignalsPanel";
import { StrategyBuilder } from "./panels/StrategyBuilder";
import { StrategyDnaPanel } from "./panels/StrategyDnaPanel";

function resolvePresetId(kind: string): string {
  return localStudioAPI.resolvePresetKey(kind) ?? kind;
}

/**
 * One mounted indicator on the chart. Multiple instances of the same `kind`
 * are supported (e.g. SMA(5), SMA(20), SMA(60)); `id` is the stable identity.
 */
export type IndicatorInstance = {
  id: string;
  kind: string;
  params: Record<string, number>;
};

export type ReplayStatus = "idle" | "playing" | "paused" | "complete";

export type ReplayState =
  | { mode: "static" }
  | {
      mode: "live";
      cursorIndex: number;
      status: ReplayStatus;
      speed: SpeedTier;
    };

export const SPEED_MS: Record<SpeedTier, number> = {
  "1x": 250,
  "2x": 125,
  "5x": 50,
  Max: 8,
};

export function App() {
  const {
    candles,
    source: dataSource,
    setSource: setDataSource,
    reload: reloadDataSource,
    loading: dataLoading,
    error: dataError,
    reloadTick: dataReloadTick,
  } = useDataSource();
  const regime = useRegime(candles);

  const [instances, setInstances] = useState<IndicatorInstance[]>([]);
  const [popoverState, setPopoverState] = useState<{
    instanceId: string;
    anchorEl: HTMLElement;
  } | null>(null);
  // Mirror of popoverState read by the mount effect so it doesn't have to add
  // popoverState to its deps (which would re-run the whole add/remove sweep
  // on every popover open/close).
  const popoverStateRef = useRef(popoverState);
  popoverStateRef.current = popoverState;
  const nextIdRef = useRef(1);

  const [replay, setReplay] = useState<ReplayState>({ mode: "static" });
  const [progress, setProgress] = useState(0);
  const replayRef = useRef(replay);
  replayRef.current = replay;

  // Anchor mode — when on, the next chart click starts Replay at that bar.
  // Shift+click is also recognized as anchor (regardless of mode). Driven via
  // a ref so the chart click handler reads it without re-binding on every
  // toggle.
  const [anchorMode, setAnchorMode] = useState(false);
  const anchorModeRef = useRef(anchorMode);
  anchorModeRef.current = anchorMode;
  const toggleAnchor = useCallback(() => setAnchorMode((v) => !v), []);
  // Esc cancels anchor mode.
  useEffect(() => {
    if (!anchorMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAnchorMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchorMode]);

  // Reset replay whenever the underlying candle series changes (different
  // symbol / timeframe / source). A live cursorIndex against stale data
  // would render bars from the previous series.
  const dataKey = dataSourceKey(dataSource);
  const lastDataKeyRef = useRef(dataKey);
  useEffect(() => {
    if (lastDataKeyRef.current !== dataKey) {
      lastDataKeyRef.current = dataKey;
      setReplay({ mode: "static" });
      setProgress(0);
    }
  }, [dataKey]);

  const newInstance = useCallback(
    (kind: string): IndicatorInstance => ({
      id: `inst-${nextIdRef.current++}`,
      kind,
      params: {},
    }),
    [],
  );

  // Empty kind → add one; non-empty → clear all of that kind. Per-row +N chip
  // is the path to stack more (SMA(5)+SMA(20)+SMA(60)).
  const toggleKind = useCallback(
    (kind: string) => {
      if (!localStudioAPI.getIndicatorPreset(kind)) return;
      setInstances((prev) =>
        prev.some((i) => i.kind === kind)
          ? prev.filter((i) => i.kind !== kind)
          : [...prev, newInstance(kind)],
      );
    },
    [newInstance],
  );

  const addInstanceOfKind = useCallback(
    (kind: string) => {
      if (!localStudioAPI.getIndicatorPreset(kind)) return;
      setInstances((prev) => [...prev, newInstance(kind)]);
    },
    [newInstance],
  );

  const removeInstance = useCallback((id: string) => {
    setInstances((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateInstanceParam = useCallback((id: string, key: string, value: number) => {
    setInstances((prev) =>
      prev.map((i) => (i.id === id ? { ...i, params: { ...i.params, [key]: value } } : i)),
    );
  }, []);

  const resetInstanceParams = useCallback((id: string) => {
    setInstances((prev) => prev.map((i) => (i.id === id ? { ...i, params: {} } : i)));
  }, []);

  const instanceCountsByKind = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of instances) counts[i.kind] = (counts[i.kind] ?? 0) + 1;
    return counts;
  }, [instances]);

  const [enabledSignals, setEnabledSignals] = useState<ReadonlySet<string>>(() => new Set());
  const toggleSignal = useCallback((kind: string) => {
    setEnabledSignals((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const [enabledPlugins, setEnabledPlugins] = useState<ReadonlySet<string>>(() => new Set());
  const togglePlugin = useCallback((kind: string) => {
    setEnabledPlugins((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);
  const [unavailablePlugins, setUnavailablePlugins] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const pluginHandlesRef = useRef<Map<string, PluginHandle>>(new Map());

  // Compute markers for each enabled signal once per (set + candles); the
  // result is referentially stable across Replay progress ticks so the
  // playhead-filter memo below skips recompute unless the playhead moves.
  const signalMarkersByKind = useMemo(() => {
    const out: Record<string, SignalMarker[]> = {};
    for (const kind of enabledSignals) {
      const def = SIGNAL_BY_KIND.get(kind);
      if (!def) continue;
      try {
        out[kind] = def.compute(candles);
      } catch (err) {
        console.warn(`[strategy-studio] Signal ${kind} failed:`, err);
        out[kind] = [];
      }
    }
    return out;
  }, [enabledSignals, candles]);

  const signalCountByKind = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [kind, markers] of Object.entries(signalMarkersByKind)) {
      counts[kind] = markers.length;
    }
    return counts;
  }, [signalMarkersByKind]);

  const { containerRef, chart } = useTrendChart({
    candles,
    theme: "dark",
    options: { watermark: "STRATEGY STUDIO" },
  });

  // Manage the indicator connection imperatively so each preset gets its full
  // SeriesMeta (label, channelColors). The `useTrendChart` `indicators` prop
  // skips that metadata and would render BB as anonymous channels.
  const connectionRef = useRef<IndicatorConnection | null>(null);
  const handlesRef = useRef<Map<string, ReturnType<IndicatorConnection["add"]>>>(new Map());
  // The chart has no live `update(params)` API, so a param edit triggers
  // remove+add. The signature memo lets us skip that round-trip when the
  // user hasn't actually changed anything.
  const paramSigRef = useRef<Map<string, string>>(new Map());
  const seriesIdToInstanceIdRef = useRef<Map<string, string>>(new Map());
  const simulatorRef = useRef<SimulatorHandle | null>(null);

  // Connection sessions are keyed by mode + cursor so toggling Replay and
  // re-anchoring both rebuild from scratch. Speed changes don't restart the
  // session — they go through `setIntervalMs` in a separate effect.
  const sessionKey = replay.mode === "live" ? `live-${replay.cursorIndex}` : "static";

  // Register TrendCraft-specific introspection rules + presets so chart-side
  // shapes like adaptiveRsi (`{rsi, effectivePeriod, ...}`), connorsRsi,
  // klinger, vsa etc. are auto-detected and rendered. Must run only once per
  // chart instance — `chart.addRule` appends to the process-wide registry,
  // so calling this on every replay rebuild would duplicate every rule and
  // slow down shape detection over time.
  useEffect(() => {
    if (!chart) return;
    registerTrendCraftPresets(chart);
  }, [chart]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sessionKey is the trigger key — speed is handled in a separate effect, replay is read via ref.
  useEffect(() => {
    if (!chart) return;
    const r = replayRef.current;
    let conn: IndicatorConnection;
    if (r.mode === "live") {
      const seedEnd = clampedSeedEnd(candles, r.cursorIndex);
      const sim = createLiveSimulator({
        candles,
        seedRatio: seedEnd / candles.length,
        intervalMs: SPEED_MS[r.speed],
      });
      simulatorRef.current = sim;
      // Pass `[]` for backfill: the simulator's live.completedCandles already
      // holds the seed, and connectIndicators concatenates `candles` +
      // `live.completedCandles` for warm-up. Passing the full `candles` here
      // would duplicate the seed AND warm indicators with future bars the
      // replay hasn't reached — exactly the look-ahead leak Replay exists
      // to prevent. Batch-only presets (no `createFactory`, e.g. adaptiveRsi,
      // heikinAshi) are kept fresh by connectIndicators itself: it re-runs
      // `compute` against the growing history on every candleComplete unless
      // a preset opts out via `liveRecompute: false`.
      conn = connectIndicators(chart, {
        presets: indicatorPresets,
        candles: [],
        live: sim.live,
      });
    } else {
      simulatorRef.current = null;
      // Restore the full candle history. Live mode replaces the chart's
      // candles with `liveSource.completedCandles` (= seed only); without
      // this reset, exiting Replay would leave the chart stuck on the seed
      // slice — the `candles` prop reference to useTrendChart hasn't
      // changed, so its own effect won't re-fire.
      chart.setCandles(candles);
      conn = connectIndicators(chart, { presets: indicatorPresets, candles });
    }
    connectionRef.current = conn;
    handlesRef.current = new Map();
    paramSigRef.current = new Map();
    seriesIdToInstanceIdRef.current = new Map();

    return () => {
      conn.disconnect();
      simulatorRef.current?.dispose();
      simulatorRef.current = null;
      connectionRef.current = null;
      handlesRef.current.clear();
      paramSigRef.current.clear();
      seriesIdToInstanceIdRef.current.clear();
    };
  }, [chart, candles, sessionKey]);

  // Speed changes flip an existing simulator's interval without restarting.
  useEffect(() => {
    if (replay.mode !== "live") return;
    simulatorRef.current?.setIntervalMs(SPEED_MS[replay.speed]);
  }, [replay]);

  // Mirror simulator state (play/idle/complete/progress) into React. rAF-coalesced
  // so a Max-speed playback (~125 ticks/sec) doesn't flood React with renders.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sessionKey re-binds the listener whenever the simulator instance is replaced.
  useEffect(() => {
    const sim = simulatorRef.current;
    if (!sim || replay.mode !== "live") {
      setProgress(0);
      return;
    }
    let rafId: number | null = null;
    const flush = () => {
      rafId = null;
      const s = sim.getState();
      setProgress(sim.getProgress());
      setReplay((prev) =>
        prev.mode === "live" && prev.status !== s ? { ...prev, status: s } : prev,
      );
    };
    const unsub = sim.onChange(() => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(flush);
    });
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      unsub();
    };
  }, [replay.mode, sessionKey]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sessionKey re-runs the mount sweep after every connection rebuild.
  useEffect(() => {
    const conn = connectionRef.current;
    if (!conn) return;
    const handles = handlesRef.current;
    const sigs = paramSigRef.current;
    const liveIds = new Set(instances.map((i) => i.id));

    const idMap = seriesIdToInstanceIdRef.current;

    const unmount = (instId: string): void => {
      const handle = handles.get(instId);
      if (!handle) return;
      if (handle.series.id) idMap.delete(handle.series.id);
      handle.remove();
      handles.delete(instId);
      sigs.delete(instId);
    };

    const mount = (instance: IndicatorInstance): void => {
      const presetId = resolvePresetId(instance.kind);
      if (!localStudioAPI.getIndicatorPreset(instance.kind)) return;
      try {
        // snapshotName override — most presets derive a unique snapshot from
        // params (SMA(5)/SMA(20) collide-free), but a few use a static string
        // (e.g. emaRibbon) and would clobber duplicates without this.
        const handle = conn.add(presetId, {
          ...instance.params,
          snapshotName: `${presetId}-${instance.id}`,
        });
        handles.set(instance.id, handle);
        sigs.set(instance.id, JSON.stringify(instance.params));
        if (handle.series.id) idMap.set(handle.series.id, instance.id);
      } catch (err) {
        console.warn(`[strategy-studio] Failed to add ${instance.kind} (${presetId}):`, err);
      }
    };

    // Add or remount on param-signature change
    for (const instance of instances) {
      const desiredSig = JSON.stringify(instance.params);
      const existing = handles.get(instance.id);
      if (!existing) {
        mount(instance);
        continue;
      }
      if (sigs.get(instance.id) !== desiredSig) {
        unmount(instance.id);
        mount(instance);
        // The popover's anchor element was just detached by the legend rebuild.
        // Re-resolve it from the chart so the popover stays attached to the new
        // row instead of floating against a dead DOM node.
        if (chart && popoverStateRef.current?.instanceId === instance.id) {
          const newSeriesId = handles.get(instance.id)?.series.id;
          const newAnchor = newSeriesId ? chart.getLegendRow(newSeriesId) : null;
          if (newAnchor) setPopoverState({ instanceId: instance.id, anchorEl: newAnchor });
        }
      }
    }

    for (const id of [...handles.keys()]) {
      if (!liveIds.has(id)) unmount(id);
    }
  }, [instances, chart, sessionKey]);

  // The chart announces lifecycle intent (⚙/✕ on legend rows) but never acts
  // on it — the host owns indicator lifecycle.
  useEffect(() => {
    if (!chart) return;
    const onEdit = (data: unknown) => {
      const payload = data as { seriesId?: string; anchorEl?: HTMLElement } | null;
      if (!payload?.seriesId || !payload.anchorEl) return;
      const instId = seriesIdToInstanceIdRef.current.get(payload.seriesId);
      if (instId) setPopoverState({ instanceId: instId, anchorEl: payload.anchorEl });
    };
    const onRemove = (data: unknown) => {
      const seriesId = (data as { seriesId?: string } | null)?.seriesId;
      if (!seriesId) return;
      const instId = seriesIdToInstanceIdRef.current.get(seriesId);
      if (instId) setInstances((prev) => prev.filter((i) => i.id !== instId));
    };
    const onClick = (data: unknown) => {
      const payload = data as { index: number | null; shiftKey?: boolean } | null;
      if (payload?.index == null) return;
      // A click anchors Replay only when the user has explicitly opted in:
      // either by arming anchor-mode via the toolbar button, or by holding
      // Shift while clicking. Plain clicks do nothing so users can interact
      // with the chart without accidentally entering Replay. Live-mode
      // clicks are ignored — re-anchoring mid-replay would surprise the
      // user; use Exit ✕ first.
      // `cursorIndex` becomes seedEnd downstream and the seed is
      // `candles[0..seedEnd-1]`, so add 1 to include the clicked candle in
      // the snapshot rather than treating it as the first queued bar.
      const wantAnchor = anchorModeRef.current || payload.shiftKey === true;
      if (!wantAnchor) return;
      if (replayRef.current.mode !== "static") return;
      setReplay({
        mode: "live",
        cursorIndex: payload.index + 1,
        status: "idle",
        speed: "1x",
      });
      setAnchorMode(false);
    };
    chart.on("seriesEditRequest", onEdit);
    chart.on("seriesRemoveRequest", onRemove);
    chart.on("click", onClick);
    return () => {
      chart.off("seriesEditRequest", onEdit);
      chart.off("seriesRemoveRequest", onRemove);
      chart.off("click", onClick);
    };
  }, [chart]);

  const replayPlay = useCallback(() => {
    simulatorRef.current?.play();
  }, []);
  const replayPause = useCallback(() => {
    simulatorRef.current?.pause();
  }, []);
  const replayStep = useCallback(() => {
    simulatorRef.current?.stepOnce();
  }, []);
  const replaySetSpeed = useCallback((speed: SpeedTier) => {
    setReplay((prev) => (prev.mode === "live" ? { ...prev, speed } : prev));
  }, []);
  const replayExit = useCallback(() => {
    setReplay({ mode: "static" });
  }, []);

  // Hotkeys: Space = play/pause, → = step. Skip when typing in a form field.
  useEffect(() => {
    function isTyping(e: KeyboardEvent): boolean {
      const t = e.target as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      const r = replayRef.current;
      if (r.mode !== "live") return;
      if (isTyping(e)) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (r.status === "playing") replayPause();
        else replayPlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        replayStep();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [replayPlay, replayPause, replayStep]);

  // Close the popover if its instance was removed (or never existed).
  const popoverInstance = useMemo(() => {
    if (!popoverState) return null;
    return instances.find((i) => i.id === popoverState.instanceId) ?? null;
  }, [popoverState, instances]);

  // Integer index of the *last emitted* candle in candle space. The simulator
  // tracks "next to emit"; subtract 1 so the cursor and backtest slice never
  // include a bar the user hasn't seen yet (the whole point of Replay).
  // Recomputes whenever progress moves but returns the same number across
  // most frames — downstream memos depending on it skip recompute via
  // Object.is, so Max-speed playback doesn't churn the right pane.
  const playheadIdx = useMemo(
    () => (replay.mode !== "live" ? null : lastEmittedIdx(candles, replay.cursorIndex, progress)),
    [replay, progress, candles],
  );

  const cursorCandle = useMemo(
    () => (playheadIdx == null ? null : (candles[playheadIdx] ?? null)),
    [candles, playheadIdx],
  );

  // Markers visible to the chart: in Replay mode, hide anything past the
  // playhead so the user can't see signals that haven't "happened yet".
  const visibleSignalMarkers = useMemo(() => {
    const all: SignalMarker[] = [];
    for (const markers of Object.values(signalMarkersByKind)) all.push(...markers);
    if (playheadIdx == null) return all;
    const cutoff = candles[playheadIdx]?.time;
    return cutoff == null ? all : all.filter((m) => m.time <= cutoff);
  }, [signalMarkersByKind, playheadIdx, candles]);

  useEffect(() => {
    chart?.addSignals(visibleSignalMarkers);
  }, [chart, visibleSignalMarkers]);

  const headerInfo = useMemo(() => {
    const base = `${candles.length} bars · LLM-free · regime-aware`;
    if (dataSource.kind === "alpaca") {
      return `${dataSource.symbol} ${dataSource.timeframe} · ${base}`;
    }
    return `synthetic · ${base}`;
  }, [candles.length, dataSource]);

  // ---- PR3: strategy builder + backtest runner ----
  const [builderState, builderDispatch] = useReducer(
    builderReducer,
    undefined,
    initialBuilderState,
  );
  const [jsonText, setJsonText] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);

  // Lifted from OptimizationPanel so StrategyDnaPanel can read the
  // same computation state without duplicating the run trigger. Pass
  // the full discriminated union — DNA panel surfaces empty/error
  // states with their own messages instead of collapsing them to
  // "Run a grid search...".
  const [optimizationResult, setOptimizationResult] = useState<OptimizationComputation>({
    kind: "idle",
  });

  // Backtest snapshot against history up to the current playhead — what the
  // user sees on chart matches what backtest sees.
  const backtestCandles = useMemo(
    () => (playheadIdx == null ? candles : candles.slice(0, playheadIdx + 1)),
    [candles, playheadIdx],
  );

  const runner = useBacktestRunner(chart, backtestCandles);

  // Plugins are heavyweight (SMC alone runs 5 sub-computations across the
  // slice) — rebuilding 25× / sec at Max-speed Replay would block the main
  // thread. Strategy: freeze the playhead trigger during playback so existing
  // overlays stay on their last snapshot, AND diff add/remove on toggle so
  // flipping a single plugin only computes that one — not the unchanged
  // siblings. The user gets a fresh snapshot the moment they pause / step
  // / exit, which matches how analysts actually use these overlays.
  const skipPluginRebuild = replay.mode === "live" && replay.status === "playing";
  const lastPluginPlayheadRef = useRef<number | null>(playheadIdx);
  if (!skipPluginRebuild) lastPluginPlayheadRef.current = playheadIdx;
  const pluginPlayheadDep = lastPluginPlayheadRef.current;

  const prevPluginSliceKeyRef = useRef<string>("init");
  const prevPluginChartRef = useRef<typeof chart | null>(null);
  const prevPluginCandlesRef = useRef<typeof candles | null>(null);
  // Plugins capture their (time, price) coordinates at build time and do NOT
  // subscribe to `chart.setCandles()` — the chart API contract is "host
  // removes + reconnects on data change" (see `connectPricePatterns`
  // JSDoc). The rebuild trigger encodes:
  // - `sessionKey` + `pluginPlayheadDep`: replay state changes.
  //
  // Data-source changes (symbol / timeframe / Synthetic ↔ Alpaca) are
  // picked up via `candles` in the deps array below, not in this key. We
  // rely on `useDataSource` always calling `setCandles(newArray)` after a
  // source change, which yields a fresh reference React's shallow equality
  // catches. An earlier attempt used `dataKey` + a content signature
  // (length + first.time + last.time), but two same-timeframe Alpaca
  // symbols (SPY / AAPL on 1D) yielded identical signatures and triggered
  // a render-1 rebuild against the *previous* symbol's candles that
  // never re-fired afterwards.
  const pluginSliceKey = `${sessionKey}:${pluginPlayheadDep ?? "null"}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: backtestCandles is derived from candles+playheadIdx; including the raw `candles` reference fires the rebuild when `useDataSource.setCandles` swaps the array (post-fetch), which is the signal that primitives need to recompute. `pluginSliceKey` separately catches replay state changes; prevSliceKey/prevChart refs distinguish "slice or chart changed → rebuild all" from "toggle only → diff add/remove".
  useEffect(() => {
    if (!chart) return;
    const handles = pluginHandlesRef.current;
    // A new chart instance invalidates every primitive registration just
    // like a slice move does — old handles point at the previous chart and
    // would silently become orphans if we tried to diff against them.
    const chartChanged = prevPluginChartRef.current !== chart;
    const sliceMoved = prevPluginSliceKeyRef.current !== pluginSliceKey;
    const candlesChanged = prevPluginCandlesRef.current !== candles;
    const fullRebuild = chartChanged || sliceMoved || candlesChanged;

    if (fullRebuild) {
      // `chart.removeAllPrimitives()` drops every registered primitive and
      // fires their `destroy` hooks in one call — same outcome as iterating
      // `handles` and calling `.remove()` on each, but it's the canonical
      // pattern documented in COOKBOOK Recipe 14. Studio is the sole
      // primitive owner on this chart instance, so a "remove all" is safe.
      chart.removeAllPrimitives();
      handles.clear();
    } else {
      for (const [kind, handle] of [...handles]) {
        if (!enabledPlugins.has(kind)) {
          handle.remove();
          handles.delete(kind);
        }
      }
    }

    const stillUnavailable = new Set<string>();
    for (const kind of enabledPlugins) {
      if (handles.has(kind)) continue;
      const def = PLUGIN_BY_KIND.get(kind);
      if (!def) continue;
      try {
        const handle = def.build(chart, backtestCandles);
        if (handle) handles.set(kind, handle);
        else stillUnavailable.add(kind);
      } catch (err) {
        console.warn(`[strategy-studio] Plugin ${kind} failed:`, err);
        stillUnavailable.add(kind);
      }
    }
    setUnavailablePlugins((prev) => {
      if (prev.size === stillUnavailable.size && [...prev].every((k) => stillUnavailable.has(k))) {
        return prev;
      }
      return stillUnavailable;
    });

    prevPluginSliceKeyRef.current = pluginSliceKey;
    prevPluginChartRef.current = chart;
    prevPluginCandlesRef.current = candles;
  }, [chart, enabledPlugins, pluginSliceKey, candles]);

  // Unmount-only cleanup: the build effect above manages add/remove
  // imperatively (no per-run cleanup return), so primitives outlive each
  // re-render. This `[]`-deps effect is the only place that tears down
  // everything on App unmount.
  useEffect(
    () => () => {
      const handles = pluginHandlesRef.current;
      for (const handle of handles.values()) handle.remove();
      handles.clear();
    },
    [],
  );

  // Stale-result guard: stepping or toggling Replay changes the slice the
  // backtest *would* run against, but the cached result and chart trade
  // markers are still from the previous slice. Drop the runner state so
  // every right-pane panel (including PortfolioPanel) prompts the user to
  // re-run in lockstep — they all read from `runner.state.lastResult`,
  // which now carries the executed JSON too.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only fires when the slice boundary moves; runner.reset/state are stable across renders.
  useEffect(() => {
    if (runner.state.lastResult) runner.reset();
  }, [playheadIdx, replay.mode]);

  const handleImport = useCallback((raw: string) => {
    if (!raw.trim()) {
      setImportError(null);
      return;
    }
    try {
      // parseStrategy: JSON.parse + $schema/version checks. validateStrategyJSON:
      // deep field/condition validation against backtestRegistry. Both run in
      // sequence — parse first to get an object, then deep-validate that object.
      const json = parseStrategy(raw);
      const validation = validateStrategyJSON(json);
      if (!validation.valid) {
        setImportError(validation.errors.join("; "));
        return;
      }
      builderDispatch({ type: "replace", state: strategyJSONToState(json) });
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return (
    <div className="studio-grid">
      <header className="studio-header">
        <span className="studio-title">TrendCraft — Strategy Studio</span>
        <span className="studio-tag">@trendcraft/chart</span>
        <DataSourcePanel
          source={dataSource}
          loading={dataLoading}
          error={dataError}
          onChange={setDataSource}
          onReload={reloadDataSource}
        />
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#787b86" }}>{headerInfo}</span>
      </header>

      <aside className="pane left">
        <PresetSelector
          regime={regime}
          instanceCountsByKind={instanceCountsByKind}
          onToggle={toggleKind}
          onAdd={addInstanceOfKind}
        />
        <div className="pane-divider" />
        <SignalsPanel
          enabled={enabledSignals}
          countByKind={signalCountByKind}
          onToggle={toggleSignal}
        />
        <div className="pane-divider" />
        <PluginsPanel
          enabled={enabledPlugins}
          unavailable={unavailablePlugins}
          onToggle={togglePlugin}
        />
      </aside>

      <main className="pane center">
        <ChartToolbar chart={chart} />
        <ReplayControls
          replay={replay}
          progress={progress}
          cursorTime={cursorCandle?.time ?? null}
          cursorIsDaily={dataSource.kind === "synthetic" || dataSource.timeframe === "1Day"}
          anchorMode={anchorMode}
          onToggleAnchor={toggleAnchor}
          onPlay={replayPlay}
          onPause={replayPause}
          onStep={replayStep}
          onSpeed={replaySetSpeed}
          onExit={replayExit}
        />
        <div ref={containerRef} style={{ flex: "1 1 auto", width: "100%", minHeight: 0 }} />
      </main>

      <aside className="pane right">
        <StrategyBuilder
          state={builderState}
          dispatch={builderDispatch}
          onRun={runner.run}
          onImport={handleImport}
          jsonText={jsonText}
          onJsonTextChange={setJsonText}
          importError={importError}
          runError={runner.state.status === "error" ? runner.state.lastError : null}
        />
        <div className="pane-divider" />
        <ResultsSummary result={runner.state.lastResult?.result} />
        <div className="pane-divider" />
        <RiskPanel candles={backtestCandles} lastBacktest={runner.state.lastResult?.result} />
        <div className="pane-divider" />
        <MetaStrategyPanel
          lastResult={runner.state.lastResult?.result}
          candles={backtestCandles}
          isReplayPlaying={replay.mode === "live" && replay.status === "playing"}
        />
        <div className="pane-divider" />
        <PortfolioPanel
          strategy={runner.state.lastResult?.json}
          lastResult={runner.state.lastResult?.result}
          sliceStartTime={backtestCandles[0]?.time ?? null}
          sliceEndTime={backtestCandles[backtestCandles.length - 1]?.time ?? null}
          isReplayPlaying={replay.mode === "live" && replay.status === "playing"}
          dataSource={dataSource}
          reloadTick={dataReloadTick}
        />
        <div className="pane-divider" />
        <ScoringPanel
          candles={backtestCandles}
          isReplayPlaying={replay.mode === "live" && replay.status === "playing"}
        />
        <div className="pane-divider" />
        <OptimizationPanel
          strategy={runner.state.lastResult?.json}
          candles={backtestCandles}
          isReplayPlaying={replay.mode === "live" && replay.status === "playing"}
          onResult={setOptimizationResult}
        />
        <div className="pane-divider" />
        <StrategyDnaPanel optimizationResult={optimizationResult} />
      </aside>

      {popoverState && popoverInstance && (
        <ParamPopover
          instance={popoverInstance}
          anchorEl={popoverState.anchorEl}
          onParamChange={updateInstanceParam}
          onReset={resetInstanceParams}
          onRemove={removeInstance}
          onClose={() => setPopoverState(null)}
        />
      )}
    </div>
  );
}
