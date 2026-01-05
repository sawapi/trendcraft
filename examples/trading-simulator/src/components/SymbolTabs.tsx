import { useState, useCallback } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { readFileAsText, parseCSV } from "../utils/fileParser";

interface FileDropDialogProps {
  onClose: () => void;
}

function FileDropDialog({ onClose }: FileDropDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createSymbolSession = useSimulatorStore((s) => s.createSymbolSession);

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

        createSymbolSession(candles, file.name);
        onClose();
      } catch {
        setError("ファイルの読み込みに失敗しました");
      }
    },
    [createSymbolSession, onClose]
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
    <div className="file-drop-dialog-overlay" onClick={onClose}>
      <div className="file-drop-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>銘柄を追加</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div
          className={`dialog-drop-zone ${isDragging ? "dragging" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <p>CSVファイルをドロップ</p>
          <p className="sub">またはクリックして選択</p>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

export function SymbolTabs() {
  const {
    symbols,
    activeSymbolId,
    switchSymbol,
    closeSymbolSession,
    phase,
  } = useSimulatorStore();

  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleClose = (e: React.MouseEvent, symbolId: string) => {
    e.stopPropagation();
    if (symbols.length > 1) {
      closeSymbolSession(symbolId);
    }
  };

  // シミュレーション中は銘柄追加を無効化
  const canAddSymbol = phase === "setup";

  // 銘柄が1つ以下の場合はタブを表示しない
  if (symbols.length <= 1 && !canAddSymbol) {
    return null;
  }

  return (
    <>
      <div className="symbol-tabs">
        <div className="tabs-container">
          {symbols.map((symbol, index) => (
            <button
              key={symbol.id}
              className={`tab ${symbol.id === activeSymbolId ? "active" : ""}`}
              onClick={() => switchSymbol(symbol.id)}
              title={`${symbol.fileName} (Ctrl+${index + 1})`}
            >
              <span className="tab-name">{symbol.fileName}</span>
              {symbol.positions.length > 0 && (
                <span className="tab-position-badge">
                  {symbol.positions.reduce((sum, p) => sum + p.shares, 0)}株
                </span>
              )}
              {symbols.length > 1 && (
                <span
                  className="tab-close"
                  onClick={(e) => handleClose(e, symbol.id)}
                  title="閉じる"
                >
                  ×
                </span>
              )}
            </button>
          ))}
        </div>
        {canAddSymbol && (
          <button
            className="add-tab-btn"
            onClick={() => setShowAddDialog(true)}
            title="新規銘柄を追加 (Ctrl+T)"
          >
            +
          </button>
        )}
      </div>
      {showAddDialog && (
        <FileDropDialog onClose={() => setShowAddDialog(false)} />
      )}
    </>
  );
}
