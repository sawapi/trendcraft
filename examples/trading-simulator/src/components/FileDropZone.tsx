import { useCallback, useState } from "react";
import type { SessionData } from "../hooks/useSessionPersistence";
import { useSimulatorStore } from "../store/simulatorStore";
import { parseCSV, readFileAsText } from "../utils/fileParser";
import { calculateIndicators } from "../utils/indicators";

interface FileDropZoneProps {
  pendingSession?: SessionData | null;
}

export function FileDropZone({ pendingSession }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFiles, setLoadedFiles] = useState<string[]>([]);
  const loadCandles = useSimulatorStore((s) => s.loadCandles);
  const createSymbolSession = useSimulatorStore((s) => s.createSymbolSession);

  // Message when a pending session exists
  const hasSession = !!pendingSession;

  const handleFile = useCallback(
    async (file: File) => {
      try {
        setError(null);
        const text = await readFileAsText(file);
        const candles = parseCSV(text);

        if (candles.length === 0) {
          setError("Failed to parse CSV data");
          return;
        }

        // If a session exists with the same filename, restore it
        if (pendingSession && file.name === pendingSession.fileName) {
          // Load candles first
          loadCandles(candles, file.name);

          // Calculate indicators
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
            pendingSession.config.indicatorParams,
          );

          // Restore session state
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

          // Update symbol state
          const state = useSimulatorStore.getState();
          const symbolId = state.symbols[0]?.id;
          if (symbolId) {
            useSimulatorStore.setState({
              symbols: state.symbols.map((s) =>
                s.id === symbolId
                  ? {
                      ...s,
                      positions: pendingSession.positions,
                      tradeHistory: pendingSession.tradeHistory,
                      equityCurve: pendingSession.equityCurve,
                      indicatorData,
                      startIndex: pendingSession.config.startIndex,
                    }
                  : s,
              ),
              currentDateIndex:
                pendingSession.currentIndex -
                pendingSession.config.startIndex -
                pendingSession.config.initialCandleCount,
            });
          }
        } else {
          // New file: add as symbol
          // Check current state directly
          const currentState = useSimulatorStore.getState();
          if (currentState.symbols.length === 0) {
            // First file
            loadCandles(candles, file.name);
          } else {
            // Additional file
            createSymbolSession(candles, file.name);
          }
          setLoadedFiles((prev) => [...prev, file.name]);
        }
      } catch {
        setError("Failed to read file");
      }
    },
    [loadCandles, createSymbolSession, pendingSession],
  );

  // Process multiple files
  const handleFiles = useCallback(
    async (files: FileList) => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith(".csv")) {
          await handleFile(file);
        }
      }
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
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
    input.multiple = true; // Enable multiple selection
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
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      role="button"
      tabIndex={0}
    >
      {hasSession ? (
        <>
          <p>To restore your session, drop</p>
          <p className="highlight">{pendingSession?.fileName}</p>
          <p className="sub">or click to select it</p>
        </>
      ) : (
        <>
          <p>Drop CSV file here</p>
          <p className="sub">or click to select (multiple OK)</p>
        </>
      )}
      {loadedFiles.length > 0 && (
        <div className="loaded-files">
          <p className="sub">Loaded: {loadedFiles.join(", ")}</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
