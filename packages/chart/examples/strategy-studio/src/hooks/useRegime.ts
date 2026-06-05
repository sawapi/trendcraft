import { useMemo } from "react";
import type { StudioCandle } from "../lib/sample-data";
import { localStudioAPI, type RegimeSummary } from "../lib/studio-api";

export function useRegime(candles: StudioCandle[]): RegimeSummary {
  return useMemo(() => localStudioAPI.detectRegime(candles), [candles]);
}
