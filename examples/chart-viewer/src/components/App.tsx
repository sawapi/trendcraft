import { useCallback, useEffect, useRef, useState } from "react";
import { createChartApi, registerChartRef } from "../api";
import { useDataQuality } from "../hooks/useDataQuality";
import { usePostMessageLoader } from "../hooks/usePostMessageLoader";
import { useChartStore } from "../store/chartStore";
import type { DrawingToolType } from "../types";
import { BacktestPanel } from "./BacktestPanel";
import { ComparisonSelector } from "./ComparisonSelector";
import { CrosshairDataPanel } from "./CrosshairDataPanel";
import { DataQualityPanel } from "./DataQualityPanel";
import { DrawingToolbar } from "./DrawingToolbar";
import { FileDropZone } from "./FileDropZone";
import { IndicatorSettingsDialog } from "./IndicatorSettingsDialog";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { MainChart, type MainChartHandle } from "./MainChart";
import { PeriodSelector } from "./PeriodSelector";
import { PositionSizingPanel } from "./PositionSizingPanel";
import { SignalsPanel } from "./SignalsPanel";
import { SymbolSearch } from "./SymbolSearch";
import { TimeframeSelector } from "./TimeframeSelector";
import { Watchlist, useWatchlist } from "./Watchlist";
import { OptimizationPanel } from "./optimization/OptimizationPanel";

/**
 * Format a timestamp as YYYY/MM/DD
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Label mapping for overlay types
 */
const OVERLAY_LABELS: Record<string, string> = {
  sma5: "SMA5",
  sma25: "SMA25",
  sma75: "SMA75",
  ema12: "EMA12",
  ema26: "EMA26",
  wma20: "WMA20",
  bb: "BB",
  donchian: "Donchian",
  keltner: "Keltner",
  ichimoku: "Ichimoku",
  supertrend: "Supertrend",
  psar: "PSAR",
  hma: "HMA",
  mcginley: "McGinley",
  emaRibbon: "EMA Ribbon",
};

/**
 * Label mapping for subchart types
 */
const SUBCHART_LABELS: Record<string, string> = {
  rsi: "RSI",
  macd: "MACD",
  stochastics: "Stoch",
  dmi: "DMI",
  stochrsi: "StochRSI",
  mfi: "MFI",
  obv: "OBV",
  cci: "CCI",
  williams: "Williams",
  roc: "ROC",
  rangebound: "Range",
  cmf: "CMF",
  volumeAnomaly: "VolAnomaly",
  volumeProfile: "VolProfile",
  volumeTrend: "VolTrend",
  per: "PER",
  pbr: "PBR",
  connorsRsi: "CRSI",
  choppiness: "CHOP",
  klinger: "KVO",
  cmo: "CMO",
  adxr: "ADXR",
  imi: "IMI",
  elderForce: "EFI",
};

export default function App() {
  // Listen for postMessage to load chart data from parent window
  usePostMessageLoader();

  const mainChartRef = useRef<MainChartHandle>(null);

  // Expose programmatic API on window for LLM agents and DevTools
  useEffect(() => {
    // biome-ignore lint/suspicious/noExplicitAny: exposing debug API on window
    (window as any).__chartStore = useChartStore;
    // biome-ignore lint/suspicious/noExplicitAny: exposing debug API on window
    (window as any).__chart = createChartApi();
    registerChartRef(mainChartRef);
    console.log("[chart-viewer] API ready. Type __chart.help() for usage.");
  }, []);

  const fileName = useChartStore((state) => state.fileName);
  const rawCandles = useChartStore((state) => state.rawCandles);
  const currentCandles = useChartStore((state) => state.currentCandles);
  const sidebarCollapsed = useChartStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useChartStore((state) => state.toggleSidebar);
  const reset = useChartStore((state) => state.reset);
  const enabledOverlays = useChartStore((state) => state.enabledOverlays);
  const enabledIndicators = useChartStore((state) => state.enabledIndicators);
  const zoomRange = useChartStore((state) => state.zoomRange);

  const theme = useChartStore((state) => state.theme);
  const setTheme = useChartStore((state) => state.setTheme);
  const yAxisType = useChartStore((state) => state.yAxisType);
  const setYAxisType = useChartStore((state) => state.setYAxisType);
  const yAxisPercent = useChartStore((state) => state.yAxisPercent);
  const setYAxisPercent = useChartStore((state) => state.setYAxisPercent);

  const hasData = rawCandles.length > 0;
  const watchlist = useWatchlist();

  // Data quality validation
  const validationResult = useDataQuality(currentCandles);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Calculate visible date range from zoom range
  const getVisibleDateRange = useCallback(() => {
    if (currentCandles.length === 0) return null;
    const startIdx = Math.floor((zoomRange.start / 100) * currentCandles.length);
    const endIdx = Math.ceil((zoomRange.end / 100) * currentCandles.length) - 1;
    const clampedStart = Math.max(0, Math.min(startIdx, currentCandles.length - 1));
    const clampedEnd = Math.max(0, Math.min(endIdx, currentCandles.length - 1));

    return {
      start: formatDate(currentCandles[clampedStart].time),
      end: formatDate(currentCandles[clampedEnd].time),
      count: clampedEnd - clampedStart + 1,
    };
  }, [currentCandles, zoomRange]);

  const visibleRange = hasData ? getVisibleDateRange() : null;

  // Mobile state
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Copy feedback state
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Keyboard shortcuts
  const undoDrawing = useChartStore((state) => state.undoDrawing);
  const redoDrawing = useChartStore((state) => state.redoDrawing);
  const setActiveDrawingTool = useChartStore((state) => state.setActiveDrawingTool);
  const setTimeframe = useChartStore((state) => state.setTimeframe);

  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  useEffect(() => {
    const DRAWING_TOOLS: DrawingToolType[] = [
      "cursor",
      "hline",
      "trendline",
      "fibRetracement",
      "rect",
      "text",
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs or dialogs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          undoDrawing();
          return;
        }
        if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
          e.preventDefault();
          redoDrawing();
          return;
        }
        return;
      }

      // Drawing tool shortcuts (1-6)
      const num = Number.parseInt(e.key, 10);
      if (num >= 1 && num <= 6) {
        setActiveDrawingTool(DRAWING_TOOLS[num - 1]);
        return;
      }

      switch (e.key) {
        case "d":
          setTimeframe("daily");
          break;
        case "w":
          setTimeframe("weekly");
          break;
        case "m":
          setTimeframe("monthly");
          break;
        case "+":
        case "=": {
          const state = useChartStore.getState();
          const range = 10;
          const newStart = Math.min(state.zoomRange.start + range, state.zoomRange.end - 5);
          useChartStore.getState().setZoomRange({ start: newStart, end: state.zoomRange.end });
          break;
        }
        case "-": {
          const state = useChartStore.getState();
          const newStart = Math.max(state.zoomRange.start - 10, 0);
          useChartStore.getState().setZoomRange({ start: newStart, end: state.zoomRange.end });
          break;
        }
        case "f":
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
          break;
        case "Escape":
          setActiveDrawingTool("cursor");
          break;
        case "Delete":
        case "Backspace": {
          const state = useChartStore.getState();
          if (state.selectedDrawingId) {
            state.removeDrawing(state.selectedDrawingId);
          }
          break;
        }
        case "?":
          setShortcutsHelpOpen((prev) => !prev);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoDrawing, redoDrawing, setActiveDrawingTool, setTimeframe]);

  // Close sidebar when clicking overlay
  const handleOverlayClick = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Open mobile sidebar
  const handleOpenSidebar = useCallback(() => {
    setSidebarOpen(true);
  }, []);

  // Determine sidebar classes
  const sidebarClasses = [
    "signals-sidebar",
    isMobile && sidebarOpen && "mobile-open",
    !isMobile && sidebarCollapsed && "collapsed",
  ]
    .filter(Boolean)
    .join(" ");

  // Build enabled indicator labels for the indicator bar
  const enabledLabels = [
    ...enabledOverlays.map((key) => ({
      key,
      label: OVERLAY_LABELS[key] || key,
      type: "overlay" as const,
    })),
    ...enabledIndicators.map((key) => ({
      key,
      label: SUBCHART_LABELS[key] || key,
      type: "subchart" as const,
    })),
  ];

  return (
    <div className="app" data-theme={theme}>
      <header className="app-header">
        <h1>Chart Viewer</h1>
        {!hasData && <SymbolSearch />}
        {hasData && (
          <div className="header-info">
            <span className="file-name">{fileName}</span>
            {import.meta.env.VITE_ALPACA_ENABLED && fileName && (
              <button
                type="button"
                className="watchlist-star-btn"
                onClick={() =>
                  watchlist.has(fileName) ? watchlist.remove(fileName) : watchlist.add(fileName)
                }
                title={watchlist.has(fileName) ? "Remove from watchlist" : "Add to watchlist"}
              >
                <span className="material-icons md-16">
                  {watchlist.has(fileName) ? "star" : "star_outline"}
                </span>
              </button>
            )}
            <span className="candle-count">{currentCandles.length} candles</span>
            <TimeframeSelector />
            <PeriodSelector />
            {visibleRange && (
              <span className="visible-range">
                {visibleRange.start} - {visibleRange.end} ({visibleRange.count})
              </span>
            )}

            {/* Y-axis controls */}
            <button
              type="button"
              className={`header-toggle-btn ${yAxisType === "log" ? "active" : ""}`}
              onClick={() => setYAxisType(yAxisType === "log" ? "value" : "log")}
              title="Toggle logarithmic scale"
            >
              Log
            </button>
            <button
              type="button"
              className={`header-toggle-btn ${yAxisPercent ? "active" : ""}`}
              onClick={() => setYAxisPercent(!yAxisPercent)}
              title="Toggle percentage mode"
            >
              %
            </button>

            <button
              type="button"
              className="reset-button"
              onClick={() => mainChartRef.current?.exportPNG()}
            >
              <span className="material-icons md-16">download</span>
              PNG
            </button>
            <button
              type="button"
              className="reset-button"
              onClick={() => mainChartRef.current?.exportSVG()}
            >
              <span className="material-icons md-16">download</span>
              SVG
            </button>
            <button
              type="button"
              className="reset-button"
              onClick={async () => {
                const ok = await mainChartRef.current?.copyToClipboard();
                if (ok) {
                  setCopyFeedback(true);
                  setTimeout(() => setCopyFeedback(false), 1500);
                }
              }}
              title="Copy chart to clipboard"
            >
              <span className="material-icons md-16">
                {copyFeedback ? "check" : "content_copy"}
              </span>
              {copyFeedback ? "Copied!" : "Copy"}
            </button>

            {/* Theme toggle */}
            <button
              type="button"
              className="reset-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              <span className="material-icons md-16">
                {theme === "dark" ? "light_mode" : "dark_mode"}
              </span>
            </button>

            <button type="button" className="reset-button" onClick={reset}>
              <span className="material-icons md-16">refresh</span>
              Reset
            </button>
          </div>
        )}
      </header>

      <div className="indicator-bar">
        {hasData && <SymbolSearch />}
        {hasData && <Watchlist symbols={watchlist.symbols} onRemove={watchlist.remove} />}
        {hasData && (
          <>
            <button
              type="button"
              className="settings-button"
              onClick={() => setSettingsOpen(true)}
              title="Indicator Settings"
            >
              <span className="material-icons">settings</span>
              Settings
            </button>
            <ComparisonSelector />
            {enabledLabels.length > 0 && (
              <div className="enabled-indicators">
                {enabledLabels.map(({ key, label, type }) => (
                  <span
                    key={key}
                    className={`indicator-tag ${type === "overlay" ? "overlay-tag" : "subchart-tag"}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <IndicatorSettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <KeyboardShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />

      {hasData && <CrosshairDataPanel />}

      {hasData && validationResult && validationResult.totalFindings > 0 && (
        <DataQualityPanel result={validationResult} />
      )}

      <main className="app-main">
        {!hasData ? (
          <FileDropZone />
        ) : (
          <>
            <div className="chart-area-wrapper">
              <DrawingToolbar />
              <div className="chart-area">
                <MainChart ref={mainChartRef} />
              </div>
            </div>

            {/* Mobile overlay */}
            {isMobile && (
              <div
                className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
                onClick={handleOverlayClick}
              />
            )}

            {/* Sidebar */}
            <div className={sidebarClasses}>
              {/* Toggle button (desktop only) */}
              {!isMobile && (
                <button
                  type="button"
                  className="sidebar-toggle"
                  onClick={toggleSidebar}
                  aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <span className="material-icons md-18">
                    {sidebarCollapsed ? "chevron_left" : "chevron_right"}
                  </span>
                </button>
              )}
              {/* Close button (mobile only) */}
              {isMobile && sidebarOpen && (
                <button
                  type="button"
                  className="sidebar-close"
                  onClick={handleOverlayClick}
                  aria-label="Close sidebar"
                >
                  <span className="material-icons">close</span>
                </button>
              )}
              <SignalsPanel />
              <BacktestPanel />
              <OptimizationPanel />
              <PositionSizingPanel />
            </div>

            {/* Mobile open button */}
            {isMobile && !sidebarOpen && (
              <button
                type="button"
                className="mobile-sidebar-open"
                onClick={handleOpenSidebar}
                aria-label="Open sidebar"
              >
                <span className="material-icons md-24">menu</span>
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
