import { z } from "zod";

export const candleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().optional(),
});

export const candlesArraySchema = z.array(candleSchema).min(1);

export type Candle = z.infer<typeof candleSchema>;
