/**
 * useTerminalSize — track terminal dimensions with resize handling
 */

import { useStdout } from "ink";
import { useEffect, useState } from "react";

export type TerminalSize = {
  rows: number;
  columns: number;
};

/** Fixed overhead: header(3) + tabbar(2) + statusbar(1) + nav hint(1) + padding(2) = 9 */
const CHROME_ROWS = 9;

export function useTerminalSize(): TerminalSize & { contentRows: number } {
  const { stdout } = useStdout();

  const [size, setSize] = useState<TerminalSize>({
    rows: stdout.rows ?? 24,
    columns: stdout.columns ?? 80,
  });

  useEffect(() => {
    const onResize = () => {
      setSize({
        rows: stdout.rows ?? 24,
        columns: stdout.columns ?? 80,
      });
    };

    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return {
    ...size,
    contentRows: Math.max(5, size.rows - CHROME_ROWS),
  };
}
