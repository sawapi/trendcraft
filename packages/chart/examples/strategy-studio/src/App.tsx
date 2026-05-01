import { type IndicatorConnection, connectIndicators } from "@trendcraft/chart";
import { registerTrendCraftPresets } from "@trendcraft/chart/presets";
import { useTrendChart } from "@trendcraft/chart/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { indicatorPresets, parseStrategy, validateStrategyJSON } from "trendcraft";
import { useBacktestRunner } from "./hooks/useBacktestRunner";
import { useRegime } from "./hooks/useRegime";
import { sampleCandles } from "./lib/sample-data";
import { builderReducer, initialBuilderState, strategyJSONToState } from "./lib/strategy-state";
import { KIND_TO_PRESET_KEY, localStudioAPI } from "./lib/studio-api";
import { ParamPopover } from "./panels/ParamPopover";
import { PresetSelector } from "./panels/PresetSelector";
import { ResultsSummary } from "./panels/ResultsSummary";
import { StrategyBuilder } from "./panels/StrategyBuilder";

function resolvePresetId(kind: string): string {
  return KIND_TO_PRESET_KEY[kind] ?? kind;
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

export function App() {
  const candles = sampleCandles;
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

  useEffect(() => {
    if (!chart) return;
    // Register TrendCraft-specific introspection rules + presets so chart-side
    // shapes like adaptiveRsi (`{rsi, effectivePeriod, ...}`), connorsRsi,
    // klinger, vsa etc. are auto-detected and rendered. Without this they fall
    // through generic introspection and end up labelled "Indicator" / "Series"
    // with no visible series.
    registerTrendCraftPresets(chart);
    const conn = connectIndicators(chart, {
      presets: indicatorPresets,
      candles,
    });
    connectionRef.current = conn;
    handlesRef.current = new Map();
    return () => {
      conn.disconnect();
      connectionRef.current = null;
      handlesRef.current.clear();
      paramSigRef.current.clear();
    };
  }, [chart, candles]);

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
  }, [instances, chart]);

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
    chart.on("seriesEditRequest", onEdit);
    chart.on("seriesRemoveRequest", onRemove);
    return () => {
      chart.off("seriesEditRequest", onEdit);
      chart.off("seriesRemoveRequest", onRemove);
    };
  }, [chart]);

  // Close the popover if its instance was removed (or never existed).
  const popoverInstance = useMemo(() => {
    if (!popoverState) return null;
    return instances.find((i) => i.id === popoverState.instanceId) ?? null;
  }, [popoverState, instances]);

  const headerInfo = useMemo(
    () => `${candles.length} bars · LLM-free · regime-aware`,
    [candles.length],
  );

  // ---- PR3: strategy builder + backtest runner ----
  const [builderState, builderDispatch] = useReducer(
    builderReducer,
    undefined,
    initialBuilderState,
  );
  const [jsonText, setJsonText] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);
  const runner = useBacktestRunner(chart, candles);

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
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#787b86" }}>{headerInfo}</span>
      </header>

      <aside className="pane left">
        <PresetSelector
          regime={regime}
          instanceCountsByKind={instanceCountsByKind}
          onToggle={toggleKind}
          onAdd={addInstanceOfKind}
        />
      </aside>

      <main className="pane center">
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
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
