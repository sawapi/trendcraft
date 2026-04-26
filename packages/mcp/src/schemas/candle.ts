import { z } from "zod";

export const candleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().optional(),
});

// Length validation is handled by calcIndicatorHandler so that the surfaced
// error follows the canonical INVALID_INPUT envelope instead of a raw zod blob.
export const candlesArraySchema = z.array(candleSchema);

export type Candle = z.infer<typeof candleSchema>;
