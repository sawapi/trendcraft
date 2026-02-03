import { useCallback, useRef, useState } from "react";
import { useChartStore } from "../store/chartStore";
import { parseFile } from "../utils/fileParser";

export function FileDropZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadCandles = useChartStore((state) => state.loadCandles);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv")) {
        setError("Please select a CSV file");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { candles, fundamentals } = await parseFile(file);

        if (candles.length === 0) {
          setError("No valid data found");
          return;
        }

        loadCandles(candles, fundamentals, file.name);
      } catch (e) {
        setError(`Failed to load file: ${e}`);
      } finally {
        setIsLoading(false);
      }
    },
    [loadCandles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  return (
    <div className="file-drop-zone-container">
      <div
        className={`file-drop-zone ${isDragOver ? "dragover" : ""} ${isLoading ? "loading" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <div className="drop-zone-content">
          {isLoading ? (
            <p>Loading...</p>
          ) : (
            <>
              <p className="drop-zone-main">Drag & Drop CSV File</p>
              <p className="drop-zone-sub">or click to select a file</p>
            </>
          )}
          {error && <p className="drop-zone-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
