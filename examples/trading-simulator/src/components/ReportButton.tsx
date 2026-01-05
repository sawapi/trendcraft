import { useCallback, useState, useMemo } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import {
  generateMarkdownReport,
  generateCSVReport,
  generateJSONReport,
  generatePortfolioMarkdownReport,
  generatePortfolioCSVReport,
  generatePortfolioJSONReport,
  downloadReport,
  type PortfolioReportData,
  type SymbolReportData,
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
    commissionRate,
    slippageBps,
    taxRate,
  } = useSimulatorStore();

  // アクティブ銘柄を取得
  const activeSymbol = useMemo(() => {
    if (!activeSymbolId) return symbols[0] || null;
    return symbols.find(s => s.id === activeSymbolId) || null;
  }, [symbols, activeSymbolId]);

  const fileName = activeSymbol?.fileName || "";
  const allCandles = activeSymbol?.allCandles || [];
  const tradeHistory = activeSymbol?.tradeHistory || [];
  const startIndex = activeSymbol?.startIndex || 0;

  // currentIndexをglobalDateから算出
  const currentIndex = useMemo(() => {
    if (!activeSymbol || !commonDateRange || currentDateIndex < 0) return 0;
    const targetDate = commonDateRange.dates[currentDateIndex];
    if (!targetDate) return 0;
    return activeSymbol.allCandles.findIndex(c => c.time === targetDate);
  }, [activeSymbol, commonDateRange, currentDateIndex]);

  const [showFormats, setShowFormats] = useState(false);
  const [reportScope, setReportScope] = useState<ReportScope>("individual");

  // 全銘柄に取引があるかチェック
  const hasAnyTrades = useMemo(() => {
    return symbols.some(s => s.tradeHistory.length > 0);
  }, [symbols]);

  // 複数銘柄があるかチェック
  const hasMultipleSymbols = symbols.length > 1;

  // 個別レポートデータを取得
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

  // ポートフォリオレポートデータを取得
  const getPortfolioReportData = useCallback((): PortfolioReportData => {
    const symbolReports: SymbolReportData[] = symbols.map(symbol => {
      const symStartIndex = symbol.startIndex || 0;
      const simStartIndex = symStartIndex + initialCandleCount;

      // この銘柄のcurrentIndexを計算
      let symCurrentIndex = 0;
      if (commonDateRange && currentDateIndex >= 0) {
        const targetDate = commonDateRange.dates[currentDateIndex];
        if (targetDate) {
          symCurrentIndex = symbol.allCandles.findIndex(c => c.time === targetDate);
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

      if (reportScope === "portfolio") {
        // ポートフォリオレポート
        const data = getPortfolioReportData();
        switch (format) {
          case "markdown": {
            const content = generatePortfolioMarkdownReport(data);
            downloadReport(content, `portfolio-report-${date}.md`, "text/markdown;charset=utf-8");
            break;
          }
          case "csv": {
            const content = generatePortfolioCSVReport(data);
            downloadReport(content, `portfolio-trades-${date}.csv`, "text/csv;charset=utf-8");
            break;
          }
          case "json": {
            const content = generatePortfolioJSONReport(data);
            downloadReport(content, `portfolio-report-${date}.json`, "application/json;charset=utf-8");
            break;
          }
        }
      } else {
        // 個別レポート
        const data = getReportData();
        const symbolName = fileName.replace(/\.[^/.]+$/, "");
        switch (format) {
          case "markdown": {
            const content = generateMarkdownReport(data);
            downloadReport(content, `${symbolName}-report-${date}.md`, "text/markdown;charset=utf-8");
            break;
          }
          case "csv": {
            const content = generateCSVReport(data);
            downloadReport(content, `${symbolName}-trades-${date}.csv`, "text/csv;charset=utf-8");
            break;
          }
          case "json": {
            const content = generateJSONReport(data);
            downloadReport(content, `${symbolName}-report-${date}.json`, "application/json;charset=utf-8");
            break;
          }
        }
      }
      setShowFormats(false);
    },
    [reportScope, getReportData, getPortfolioReportData, fileName]
  );

  const handleReset = useCallback(() => {
    const totalTrades = symbols.reduce((sum, s) => sum + s.tradeHistory.length, 0);
    if (
      totalTrades > 0 &&
      !confirm("シミュレーションをリセットしますか？取引履歴は失われます。")
    ) {
      return;
    }
    reset();
  }, [symbols, reset]);

  // レポート出力可能かチェック
  const canExport = reportScope === "portfolio" ? hasAnyTrades : tradeHistory.length > 0;

  return (
    <div className="report-panel">
      <div className="export-dropdown">
        <button
          className="btn-primary"
          onClick={() => setShowFormats(!showFormats)}
          disabled={!canExport}
        >
          レポート出力
          <span className="material-icons dropdown-icon">
            {showFormats ? "expand_less" : "expand_more"}
          </span>
        </button>
        {showFormats && canExport && (
          <div className="export-formats">
            {/* スコープ選択（複数銘柄の場合のみ表示） */}
            {hasMultipleSymbols && (
              <div className="report-scope-selector">
                <button
                  className={`scope-btn ${reportScope === "individual" ? "active" : ""}`}
                  onClick={() => setReportScope("individual")}
                >
                  個別({fileName})
                </button>
                <button
                  className={`scope-btn ${reportScope === "portfolio" ? "active" : ""}`}
                  onClick={() => setReportScope("portfolio")}
                >
                  ポートフォリオ
                </button>
              </div>
            )}
            <button onClick={() => handleExport("markdown")}>
              <span className="material-icons">description</span>
              Markdown
            </button>
            <button onClick={() => handleExport("csv")}>
              <span className="material-icons">table_chart</span>
              CSV
            </button>
            <button onClick={() => handleExport("json")}>
              <span className="material-icons">data_object</span>
              JSON
            </button>
          </div>
        )}
      </div>
      <button className="btn-secondary" onClick={handleReset}>
        {phase === "finished" ? "新しいシミュレーション" : "リセット"}
      </button>
    </div>
  );
}
