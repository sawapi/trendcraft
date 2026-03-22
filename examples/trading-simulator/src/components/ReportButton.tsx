import { useCallback, useMemo, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import {
  type PortfolioReportData,
  type SymbolReportData,
  downloadReport,
  generateCSVReport,
  generateJSONReport,
  generateMarkdownReport,
  generatePortfolioCSVReport,
  generatePortfolioJSONReport,
  generatePortfolioMarkdownReport,
} from "../utils/reportGenerator";

type ExportFormat = "markdown" | "csv" | "json";
type ReportScope = "individual" | "portfolio";

export function ReportButton() {
  const {
    symbols,
    activeSymbolId,
    commonDateRange,
    currentDateIndex,
    initialCandleCount,
    initialCapital,
    enabledIndicators,
    phase,
    reset,
    resetFunds,
    commissionRate,
    slippageBps,
    taxRate,
  } = useSimulatorStore();

  // Get active symbol
  const activeSymbol = useMemo(() => {
    if (!activeSymbolId) return symbols[0] || null;
    return symbols.find((s) => s.id === activeSymbolId) || null;
  }, [symbols, activeSymbolId]);

  const fileName = activeSymbol?.fileName || "";
  const allCandles = activeSymbol?.allCandles || [];
  const tradeHistory = activeSymbol?.tradeHistory || [];
  const startIndex = activeSymbol?.startIndex || 0;

  // Compute currentIndex from globalDate
  const currentIndex = useMemo(() => {
    if (!activeSymbol || !commonDateRange || currentDateIndex < 0) return 0;
    const targetDate = commonDateRange.dates[currentDateIndex];
    if (!targetDate) return 0;
    return activeSymbol.allCandles.findIndex((c) => c.time === targetDate);
  }, [activeSymbol, commonDateRange, currentDateIndex]);

  const [showFormats, setShowFormats] = useState(false);
  const [reportScope, setReportScope] = useState<ReportScope>("individual");

  // Check if any symbol has trades
  const hasAnyTrades = useMemo(() => {
    return symbols.some((s) => s.tradeHistory.length > 0);
  }, [symbols]);

  // Check if there are multiple symbols
  const hasMultipleSymbols = symbols.length > 1;

  // Get individual report data
  const getReportData = useCallback(() => {
    const simStartIndex = startIndex + initialCandleCount;
    const startDate = allCandles[simStartIndex]?.time || 0;
    const endDate = allCandles[currentIndex]?.time || 0;
    const startPrice = allCandles[simStartIndex]?.close || 0;
    const endPrice = allCandles[currentIndex]?.close || 0;
    const totalTradingDays = currentIndex - simStartIndex + 1;
    return {
      fileName,
      startDate,
      endDate,
      initialCapital,
      enabledIndicators,
      tradeHistory,
      startPrice,
      endPrice,
      commissionRate,
      slippageBps,
      taxRate,
      totalTradingDays,
    };
  }, [
    fileName,
    allCandles,
    startIndex,
    initialCandleCount,
    currentIndex,
    initialCapital,
    enabledIndicators,
    tradeHistory,
    commissionRate,
    slippageBps,
    taxRate,
  ]);

  // Get portfolio report data
  const getPortfolioReportData = useCallback((): PortfolioReportData => {
    const symbolReports: SymbolReportData[] = symbols.map((symbol) => {
      const symStartIndex = symbol.startIndex || 0;
      const simStartIndex = symStartIndex + initialCandleCount;

      // Calculate currentIndex for this symbol
      let symCurrentIndex = 0;
      if (commonDateRange && currentDateIndex >= 0) {
        const targetDate = commonDateRange.dates[currentDateIndex];
        if (targetDate) {
          symCurrentIndex = symbol.allCandles.findIndex((c) => c.time === targetDate);
          if (symCurrentIndex < 0) symCurrentIndex = 0;
        }
      }

      const startDate = symbol.allCandles[simStartIndex]?.time || 0;
      const endDate = symbol.allCandles[symCurrentIndex]?.time || 0;
      const startPrice = symbol.allCandles[simStartIndex]?.close || 0;
      const endPrice = symbol.allCandles[symCurrentIndex]?.close || 0;
      const totalTradingDays = symCurrentIndex - simStartIndex + 1;

      return {
        symbolId: symbol.id,
        fileName: symbol.fileName,
        startDate,
        endDate,
        initialCapital,
        enabledIndicators,
        tradeHistory: symbol.tradeHistory,
        startPrice,
        endPrice,
        commissionRate,
        slippageBps,
        taxRate,
        totalTradingDays: totalTradingDays > 0 ? totalTradingDays : 0,
      };
    });

    return {
      symbols: symbolReports,
      initialCapital,
      enabledIndicators,
      commissionRate,
      slippageBps,
      taxRate,
    };
  }, [
    symbols,
    commonDateRange,
    currentDateIndex,
    initialCandleCount,
    initialCapital,
    enabledIndicators,
    commissionRate,
    slippageBps,
    taxRate,
  ]);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const date = new Date().toISOString().split("T")[0];
      const isPortfolio = reportScope === "portfolio";
      const prefix = isPortfolio ? "portfolio" : fileName.replace(/\.[^/.]+$/, "");

      const generators = isPortfolio
        ? {
            markdown: () => generatePortfolioMarkdownReport(getPortfolioReportData()),
            csv: () => generatePortfolioCSVReport(getPortfolioReportData()),
            json: () => generatePortfolioJSONReport(getPortfolioReportData()),
          }
        : {
            markdown: () => generateMarkdownReport(getReportData()),
            csv: () => generateCSVReport(getReportData()),
            json: () => generateJSONReport(getReportData()),
          };

      const fileInfo = {
        markdown: { ext: "md", mime: "text/markdown;charset=utf-8", suffix: "report" },
        csv: { ext: "csv", mime: "text/csv;charset=utf-8", suffix: "trades" },
        json: { ext: "json", mime: "application/json;charset=utf-8", suffix: "report" },
      };

      const info = fileInfo[format];
      const content = generators[format]();
      downloadReport(content, `${prefix}-${info.suffix}-${date}.${info.ext}`, info.mime);
      setShowFormats(false);
    },
    [reportScope, getReportData, getPortfolioReportData, fileName],
  );

  const handleResetFunds = useCallback(() => {
    const totalTrades = symbols.reduce((sum, s) => sum + s.tradeHistory.length, 0);
    if (
      totalTrades > 0 &&
      !confirm(
        "Reset funds? All trades and positions will be cleared, but data and settings are preserved.",
      )
    ) {
      return;
    }
    resetFunds();
  }, [symbols, resetFunds]);

  const handleReset = useCallback(() => {
    const totalTrades = symbols.reduce((sum, s) => sum + s.tradeHistory.length, 0);
    if (totalTrades > 0 && !confirm("Reset simulation? Trade history will be lost.")) {
      return;
    }
    reset();
  }, [symbols, reset]);

  // Check if report export is available
  const canExport = reportScope === "portfolio" ? hasAnyTrades : tradeHistory.length > 0;

  return (
    <div className="report-panel">
      <div className="export-dropdown">
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowFormats(!showFormats)}
          disabled={!canExport}
        >
          Export Report
          <span className="material-icons dropdown-icon">
            {showFormats ? "expand_less" : "expand_more"}
          </span>
        </button>
        {showFormats && canExport && (
          <div className="export-formats">
            {/* Scope selector (only for multi-symbol) */}
            {hasMultipleSymbols && (
              <div className="report-scope-selector">
                <button
                  type="button"
                  className={`scope-btn ${reportScope === "individual" ? "active" : ""}`}
                  onClick={() => setReportScope("individual")}
                >
                  Individual ({fileName})
                </button>
                <button
                  type="button"
                  className={`scope-btn ${reportScope === "portfolio" ? "active" : ""}`}
                  onClick={() => setReportScope("portfolio")}
                >
                  Portfolio
                </button>
              </div>
            )}
            <button type="button" onClick={() => handleExport("markdown")}>
              <span className="material-icons">description</span>
              Markdown
            </button>
            <button type="button" onClick={() => handleExport("csv")}>
              <span className="material-icons">table_chart</span>
              CSV
            </button>
            <button type="button" onClick={() => handleExport("json")}>
              <span className="material-icons">data_object</span>
              JSON
            </button>
          </div>
        )}
      </div>
      {phase !== "finished" && (
        <button
          type="button"
          className="btn-secondary"
          onClick={handleResetFunds}
          title="Clear all trades and positions, restart from beginning"
        >
          Reset Funds
        </button>
      )}
      <button type="button" className="btn-secondary" onClick={handleReset}>
        {phase === "finished" ? "New Simulation" : "Reset"}
      </button>
    </div>
  );
}
