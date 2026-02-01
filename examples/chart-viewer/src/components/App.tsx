import { useCallback, useEffect, useState } from "react";
import { useChartStore } from "../store/chartStore";
import { BacktestPanel } from "./BacktestPanel";
import { FileDropZone } from "./FileDropZone";
import { IndicatorSettingsDialog } from "./IndicatorSettingsDialog";
import { MainChart } from "./MainChart";
import { SignalsPanel } from "./SignalsPanel";
import { TimeframeSelector } from "./TimeframeSelector";

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
  const fileName = useChartStore((state) => state.fileName);
  const rawCandles = useChartStore((state) => state.rawCandles);
  const currentCandles = useChartStore((state) => state.currentCandles);
  const sidebarCollapsed = useChartStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useChartStore((state) => state.toggleSidebar);
  const reset = useChartStore((state) => state.reset);
  const enabledOverlays = useChartStore((state) => state.enabledOverlays);
  const enabledIndicators = useChartStore((state) => state.enabledIndicators);

  const hasData = rawCandles.length > 0;

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
  const getSidebarClasses = () => {
    const classes = ["signals-sidebar"];
    if (isMobile) {
      if (sidebarOpen) {
        classes.push("mobile-open");
      }
    } else {
      if (sidebarCollapsed) {
        classes.push("collapsed");
      }
    }
    return classes.join(" ");
  };

  // Get enabled indicator labels
  const getEnabledLabels = () => {
    const overlayLabels = enabledOverlays.map((key) => ({
      key,
      label: OVERLAY_LABELS[key] || key,
      type: "overlay" as const,
    }));
    const subchartLabels = enabledIndicators.map((key) => ({
      key,
      label: SUBCHART_LABELS[key] || key,
      type: "subchart" as const,
    }));
    return [...overlayLabels, ...subchartLabels];
  };

  const enabledLabels = getEnabledLabels();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Chart Viewer</h1>
        {hasData && (
          <div className="header-info">
            <span className="file-name">{fileName}</span>
            <span className="candle-count">{currentCandles.length} candles</span>
            <TimeframeSelector />
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
              <MainChart />
            </div>

            {/* Mobile overlay */}
            {isMobile && (
              <div
                className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
                onClick={handleOverlayClick}
              />
            )}

            {/* Sidebar */}
            <div className={getSidebarClasses()}>
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
