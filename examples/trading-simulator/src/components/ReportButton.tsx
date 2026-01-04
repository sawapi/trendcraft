import { useCallback, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import {
  generateMarkdownReport,
  generateCSVReport,
  generateJSONReport,
  downloadReport,
} from "../utils/reportGenerator";

type ExportFormat = "markdown" | "csv" | "json";

export function ReportButton() {
  const {
    fileName,
    allCandles,
    startIndex,
    initialCandleCount,
    currentIndex,
    initialCapital,
    enabledIndicators,
    tradeHistory,
    phase,
    reset,
    commissionRate,
    slippageBps,
    taxRate,
  } = useSimulatorStore();

  const [showFormats, setShowFormats] = useState(false);

  const getReportData = useCallback(() => {
    const simStartIndex = startIndex + initialCandleCount;
    const startDate = allCandles[simStartIndex]?.time || 0;
    const endDate = allCandles[currentIndex]?.time || 0;
    // Buy&Hold比較用の価格
    const startPrice = allCandles[simStartIndex]?.close || 0;
    const endPrice = allCandles[currentIndex]?.close || 0;
    // シミュレーション期間の営業日数（marketExposure計算用）
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

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const data = getReportData();
      const date = new Date().toISOString().split("T")[0];

      switch (format) {
        case "markdown": {
          const content = generateMarkdownReport(data);
          downloadReport(content, `simulation-report-${date}.md`, "text/markdown;charset=utf-8");
          break;
        }
        case "csv": {
          const content = generateCSVReport(data);
          downloadReport(content, `simulation-trades-${date}.csv`, "text/csv;charset=utf-8");
          break;
        }
        case "json": {
          const content = generateJSONReport(data);
          downloadReport(content, `simulation-report-${date}.json`, "application/json;charset=utf-8");
          break;
        }
      }
      setShowFormats(false);
    },
    [getReportData]
  );

  const handleReset = useCallback(() => {
    if (
      tradeHistory.length > 0 &&
      !confirm("シミュレーションをリセットしますか？取引履歴は失われます。")
    ) {
      return;
    }
    reset();
  }, [tradeHistory.length, reset]);

  return (
    <div className="report-panel">
      <div className="export-dropdown">
        <button
          className="btn-primary"
          onClick={() => setShowFormats(!showFormats)}
          disabled={tradeHistory.length === 0}
        >
          レポート出力
          <span className="material-icons dropdown-icon">
            {showFormats ? "expand_less" : "expand_more"}
          </span>
        </button>
        {showFormats && tradeHistory.length > 0 && (
          <div className="export-formats">
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
