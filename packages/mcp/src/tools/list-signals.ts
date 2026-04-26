import { z } from "zod";
import { type SignalSummary, listSupportedSignals } from "../dispatcher/signal-map";

export const listSignalsInputShape = {
  /**
   * Filter by output shape: `"series"` for per-bar boolean/state signals
   * (goldenCross, perfectOrder, candlestickPatterns), `"events"` for sparse
   * event arrays (squeeze, divergence, volume signals). Omit to return all.
   */
  shape: z.enum(["series", "events"]).optional(),
};

export function listSignalsHandler(input: { shape?: "series" | "events" }): SignalSummary[] {
  const all = listSupportedSignals();
  if (!input.shape) return all;
  return all.filter((s) => s.shape === input.shape);
}
