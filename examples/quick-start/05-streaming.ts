/**
 * 05 — Streaming Pipeline
 *
 * Process candles one-by-one with incremental indicators and streaming conditions.
 * Run: npx tsx examples/quick-start/05-streaming.ts
 */
import { type NormalizedCandle, incremental, streaming } from "../../src";

// Generate 100 candles
function generateCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = 150;
  const baseTime = Date.now() - count * 60_000;

  for (let i = 0; i < count; i++) {
    // Create trend cycles for signal generation
    const cycle = Math.sin((i / count) * Math.PI * 6) * 0.8;
    const change = cycle + (Math.random() - 0.5) * 2;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 1.5;
    const low = Math.min(open, close) - Math.random() * 1.5;
    const volume = Math.floor(100_000 + Math.random() * 200_000);

    candles.push({ time: baseTime + i * 60_000, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

// --- Build streaming pipeline ---
const pipeline = streaming.createPipeline({
  indicators: [
    { name: "rsi", create: () => incremental.createRsi({ period: 14 }) },
    { name: "ema9", create: () => incremental.createEma({ period: 9 }) },
    { name: "ema21", create: () => incremental.createEma({ period: 21 }) },
    { name: "bb", create: () => incremental.createBollingerBands({ period: 20, stdDev: 2 }) },
  ],
  entry: streaming.and(
    streaming.rsiBelow(35, "rsi"),
    streaming.crossOver(
      (snapshot) => streaming.getNumber(snapshot, "ema9"),
      (snapshot) => streaming.getNumber(snapshot, "ema21"),
    ),
  ),
  exit: streaming.or(
    streaming.rsiAbove(70, "rsi"),
    streaming.crossUnder(
      (snapshot) => streaming.getNumber(snapshot, "ema9"),
      (snapshot) => streaming.getNumber(snapshot, "ema21"),
    ),
  ),
});

// --- Process candles one by one ---
const candles = generateCandles(100);
let entryCount = 0;
let exitCount = 0;

console.log("=== Streaming Pipeline ===\n");

for (const candle of candles) {
  const result = pipeline.next(candle);

  if (result.entry) {
    entryCount++;
    const time = new Date(candle.time).toISOString().slice(11, 19);
    const rsiVal = result.snapshot.rsi;
    console.log(
      `  ENTRY @ ${time}  Close=${candle.close.toFixed(2)}  RSI=${typeof rsiVal === "number" ? rsiVal.toFixed(1) : "—"}`,
    );
  }

  if (result.exit) {
    exitCount++;
    const time = new Date(candle.time).toISOString().slice(11, 19);
    const rsiVal = result.snapshot.rsi;
    console.log(
      `  EXIT  @ ${time}  Close=${candle.close.toFixed(2)}  RSI=${typeof rsiVal === "number" ? rsiVal.toFixed(1) : "—"}`,
    );
  }
}

console.log(`\nProcessed ${candles.length} candles: ${entryCount} entries, ${exitCount} exits.`);
console.log("Pipeline state is preserved — ready for the next candle.");
