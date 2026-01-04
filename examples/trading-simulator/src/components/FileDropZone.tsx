import { useCallback, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { readFileAsText, parseCSV } from "../utils/fileParser";
import { calculateIndicators } from "../utils/indicators";
import type { SessionData } from "../hooks/useSessionPersistence";

interface FileDropZoneProps {
  pendingSession?: SessionData | null;
}

export function FileDropZone({ pendingSession }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadCandles = useSimulatorStore((s) => s.loadCandles);

  // pendingSessionがある場合のメッセージ
  const hasSession = !!pendingSession;

  const handleFile = useCallback(
    async (file: File) => {
      try {
        setError(null);
        const text = await readFileAsText(file);
        const candles = parseCSV(text);

        if (candles.length === 0) {
          setError("CSVからデータを読み込めませんでした");
          return;
        }

        // セッションがあり、同じファイル名の場合は復元
        if (pendingSession && file.name === pendingSession.fileName) {
          // 先にcandlesをロード
          loadCandles(candles, file.name);

          // インジケーターを計算
          const reportIndicators = new Set([
            ...pendingSession.config.enabledIndicators,
            "sma25",
            "sma75",
            "rsi",
            "macd",
            "bb",
          ]);
          const indicatorData = calculateIndicators(
            candles,
            Array.from(reportIndicators),
            pendingSession.config.indicatorParams
          );

          // セッション状態を復元
          useSimulatorStore.setState({
            phase: pendingSession.phase,
            startIndex: pendingSession.config.startIndex,
            initialCandleCount: pendingSession.config.initialCandleCount,
            initialCapital: pendingSession.config.initialCapital,
            enabledIndicators: pendingSession.config.enabledIndicators,
            indicatorParams: pendingSession.config.indicatorParams,
            commissionRate: pendingSession.config.commissionRate,
            slippageBps: pendingSession.config.slippageBps,
            taxRate: pendingSession.config.taxRate,
            stopLossPercent: pendingSession.config.stopLossPercent,
            takeProfitPercent: pendingSession.config.takeProfitPercent,
            trailingStopEnabled: pendingSession.config.trailingStopEnabled ?? false,
            trailingStopPercent: pendingSession.config.trailingStopPercent ?? 5,
            currentIndex: pendingSession.currentIndex,
            positions: pendingSession.positions,
            tradeHistory: pendingSession.tradeHistory,
            equityCurve: pendingSession.equityCurve,
            indicatorData,
            isPlaying: false,
          });
        } else {
          loadCandles(candles, file.name);
        }
      } catch {
        setError("ファイルの読み込みに失敗しました");
      }
    },
    [loadCandles, pendingSession]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  }, [handleFile]);

  return (
    <div
      className={`drop-zone ${isDragging ? "dragging" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      {hasSession ? (
        <>
          <p>セッションを復元するには</p>
          <p className="highlight">{pendingSession?.fileName}</p>
          <p className="sub">をドロップまたは選択してください</p>
        </>
      ) : (
        <>
          <p>CSVファイルをドロップ</p>
          <p className="sub">またはクリックして選択</p>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
