import { useCallback, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { parseCSV, readFileAsText } from "../utils/fileParser";

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
          setError("Failed to parse CSV data");
          return;
        }

        createSymbolSession(candles, file.name);
        onClose();
      } catch {
        setError("Failed to read file");
      }
    },
    [createSymbolSession, onClose],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
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
      className="file-drop-dialog-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="file-drop-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h3>Add Symbol</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div
          className={`dialog-drop-zone ${isDragging ? "dragging" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
          onKeyDown={(e) => e.key === "Enter" && handleClick()}
          role="button"
          tabIndex={0}
        >
          <p>Drop CSV file here</p>
          <p className="sub">or click to select</p>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

export function SymbolTabs() {
  const { symbols, activeSymbolId, switchSymbol, closeSymbolSession, phase } = useSimulatorStore();

  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleClose = (e: React.MouseEvent, symbolId: string) => {
    e.stopPropagation();
    if (symbols.length > 1) {
      closeSymbolSession(symbolId);
    }
  };

  // Disable adding symbols during simulation
  const canAddSymbol = phase === "setup";

  // Don't show tabs when there's only one or no symbols
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
                  {symbol.positions.reduce((sum, p) => sum + p.shares, 0)}
                </span>
              )}
              {symbols.length > 1 && (
                <span
                  className="tab-close"
                  onClick={(e) => handleClose(e, symbol.id)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleClose(e as unknown as React.MouseEvent, symbol.id)
                  }
                  role="button"
                  tabIndex={0}
                  title="Close"
                >
                  ×
                </span>
              )}
            </button>
          ))}
        </div>
        {canAddSymbol && (
          <button
            type="button"
            className="add-tab-btn"
            onClick={() => setShowAddDialog(true)}
            title="Add symbol (Ctrl+T)"
          >
            +
          </button>
        )}
      </div>
      {showAddDialog && <FileDropDialog onClose={() => setShowAddDialog(false)} />}
    </>
  );
}
