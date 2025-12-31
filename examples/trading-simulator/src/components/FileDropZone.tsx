import { useCallback, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { readFileAsText, parseCSV } from "../utils/fileParser";

export function FileDropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadCandles = useSimulatorStore((s) => s.loadCandles);

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

        loadCandles(candles, file.name);
      } catch {
        setError("ファイルの読み込みに失敗しました");
      }
    },
    [loadCandles]
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
      <p>CSVファイルをドロップ</p>
      <p className="sub">またはクリックして選択</p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
