import { useCallback } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { generateMarkdownReport, downloadReport } from "../utils/reportGenerator";

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
  } = useSimulatorStore();

  const handleExport = useCallback(() => {
    const startDate = allCandles[startIndex + initialCandleCount]?.time || 0;
    const endDate = allCandles[currentIndex]?.time || 0;

    const markdown = generateMarkdownReport({
      fileName,
      startDate,
      endDate,
      initialCapital,
      enabledIndicators,
      tradeHistory,
    });

    const date = new Date().toISOString().split("T")[0];
    const reportFileName = `simulation-report-${date}.md`;
    downloadReport(markdown, reportFileName);
  }, [
    fileName,
    allCandles,
    startIndex,
    initialCandleCount,
    currentIndex,
    initialCapital,
    enabledIndicators,
    tradeHistory,
  ]);

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
      <button
        className="btn-primary"
        onClick={handleExport}
        disabled={tradeHistory.length === 0}
      >
        レポート出力 (Markdown)
      </button>
      <button className="btn-secondary" onClick={handleReset}>
        {phase === "finished" ? "新しいシミュレーション" : "リセット"}
      </button>
    </div>
  );
}
