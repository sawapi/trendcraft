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
import { PresetSelector } from "./panels/PresetSelector";
import { ResultsSummary } from "./panels/ResultsSummary";
import { StrategyBuilder } from "./panels/StrategyBuilder";

function resolvePresetId(kind: string): string {
  return KIND_TO_PRESET_KEY[kind] ?? kind;
}

export function App() {
  const candles = sampleCandles;
  const regime = useRegime(candles);

  const [activeKinds, setActiveKinds] = useState<ReadonlySet<string>>(() => new Set());

  const toggleKind = useCallback((kind: string) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

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
    };
  }, [chart, candles]);

  useEffect(() => {
    const conn = connectionRef.current;
    if (!conn) return;
    const handles = handlesRef.current;

    // Add new
    for (const kind of activeKinds) {
      if (handles.has(kind)) continue;
      const presetId = resolvePresetId(kind);
      if (!localStudioAPI.getIndicatorPreset(kind)) continue;
      try {
        handles.set(kind, conn.add(presetId));
      } catch (err) {
        console.warn(`[strategy-studio] Failed to add ${kind} (${presetId}):`, err);
      }
    }

    // Remove dropped
    for (const [kind, handle] of handles) {
      if (!activeKinds.has(kind)) {
        handle.remove();
        handles.delete(kind);
      }
    }
  }, [activeKinds]);

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
        <PresetSelector regime={regime} activeKinds={activeKinds} onToggle={toggleKind} />
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
    </div>
  );
}
