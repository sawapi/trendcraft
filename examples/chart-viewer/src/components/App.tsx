import { useCallback, useEffect, useRef, useState } from "react";
import { useChartStore } from "../store/chartStore";
import { usePostMessageLoader } from "../hooks/usePostMessageLoader";
import { BacktestPanel } from "./BacktestPanel";
import { FileDropZone } from "./FileDropZone";
import { IndicatorSettingsDialog } from "./IndicatorSettingsDialog";
import { MainChart, type MainChartHandle } from "./MainChart";
import { PeriodSelector } from "./PeriodSelector";
import { SignalsPanel } from "./SignalsPanel";
import { TimeframeSelector } from "./TimeframeSelector";

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
};

export default function App() {
  // Listen for postMessage to load chart data from parent window
  usePostMessageLoader();

  const mainChartRef = useRef<MainChartHandle>(null);

  const fileName = useChartStore((state) => state.fileName);
  const rawCandles = useChartStore((state) => state.rawCandles);
  const currentCandles = useChartStore((state) => state.currentCandles);
  const sidebarCollapsed = useChartStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useChartStore((state) => state.toggleSidebar);
  const reset = useChartStore((state) => state.reset);
  const enabledOverlays = useChartStore((state) => state.enabledOverlays);
  const enabledIndicators = useChartStore((state) => state.enabledIndicators);
  const zoomRange = useChartStore((state) => state.zoomRange);

  const hasData = rawCandles.length > 0;

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

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
  ].filter(Boolean).join(" ");

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
    <div className="app">
      <header className="app-header">
        <h1>Chart Viewer</h1>
        {hasData && (
          <div className="header-info">
            <span className="file-name">{fileName}</span>
            <span className="candle-count">{currentCandles.length} candles</span>
            <TimeframeSelector />
            <PeriodSelector />
            {visibleRange && (
              <span className="visible-range">
                {visibleRange.start} - {visibleRange.end} ({visibleRange.count})
              </span>
            )}
            <button type="button" className="reset-button" onClick={() => mainChartRef.current?.exportPNG()}>
              <span className="material-icons md-16">download</span>
              PNG
            </button>
            <button type="button" className="reset-button" onClick={() => mainChartRef.current?.exportSVG()}>
              <span className="material-icons md-16">download</span>
              SVG
            </button>
            <button type="button" className="reset-button" onClick={reset}>
              <span className="material-icons md-16">refresh</span>
              Reset
            </button>
          </div>
        )}
      </header>

      {hasData && (
        <div className="indicator-bar">
          <button
            type="button"
            className="settings-button"
            onClick={() => setSettingsOpen(true)}
            title="Indicator Settings"
          >
            <span className="material-icons">settings</span>
            Settings
          </button>
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
        </div>
      )}

      <IndicatorSettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <main className="app-main">
        {!hasData ? (
          <FileDropZone />
        ) : (
          <>
            <div className="chart-area">
              <MainChart ref={mainChartRef} />
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
