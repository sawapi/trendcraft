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
  const [loadedFiles, setLoadedFiles] = useState<string[]>([]);
  const loadCandles = useSimulatorStore((s) => s.loadCandles);
  const createSymbolSession = useSimulatorStore((s) => s.createSymbolSession);

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
            isPlaying: false,
          });

          // シンボルの状態を更新
          const state = useSimulatorStore.getState();
          const symbolId = state.symbols[0]?.id;
          if (symbolId) {
            useSimulatorStore.setState({
              symbols: state.symbols.map(s =>
                s.id === symbolId
                  ? {
                      ...s,
                      positions: pendingSession.positions,
                      tradeHistory: pendingSession.tradeHistory,
                      equityCurve: pendingSession.equityCurve,
                      indicatorData,
                      startIndex: pendingSession.config.startIndex,
                    }
                  : s
              ),
              currentDateIndex: pendingSession.currentIndex - pendingSession.config.startIndex - pendingSession.config.initialCandleCount,
            });
          }
        } else {
          // 新しいファイルの場合は銘柄を追加
          // 現在の状態を直接取得して判定
          const currentState = useSimulatorStore.getState();
          if (currentState.symbols.length === 0) {
            // 最初のファイル
            loadCandles(candles, file.name);
          } else {
            // 追加のファイル
            createSymbolSession(candles, file.name);
          }
          setLoadedFiles(prev => [...prev, file.name]);
        }
      } catch {
        setError("ファイルの読み込みに失敗しました");
      }
    },
    [loadCandles, createSymbolSession, pendingSession]
  );

  // 複数ファイルを処理
  const handleFiles = useCallback(
    async (files: FileList) => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith(".csv")) {
          await handleFile(file);
        }
      }
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
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
    input.multiple = true;  // 複数選択を有効化
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    };
    input.click();
  }, [handleFiles]);

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
          <p className="sub">またはクリックして選択（複数可）</p>
        </>
      )}
      {loadedFiles.length > 0 && (
        <div className="loaded-files">
          <p className="sub">読み込み済み: {loadedFiles.join(", ")}</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
