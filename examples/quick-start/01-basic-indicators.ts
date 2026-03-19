/**
 * 01 — Basic Indicators
 *
 * Calculate SMA, RSI, MACD, and Bollinger Bands on sample data.
 * Run: npx tsx examples/quick-start/01-basic-indicators.ts
 */
import { type NormalizedCandle, bollingerBands, ema, macd, rsi, sma } from "../../src";

// Generate 60 days of synthetic price data
function generateCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = 150;
  const baseTime = Date.now() - count * 86_400_000;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * 4; // slight upward bias
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const volume = Math.floor(800_000 + Math.random() * 400_000);

    candles.push({
      time: baseTime + i * 86_400_000,
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }
  return candles;
}

const candles = generateCandles(60);

// --- Indicators ---
const sma20 = sma(candles, { period: 20 });
const ema12 = ema(candles, { period: 12 });
const rsi14 = rsi(candles, { period: 14 });
const macdData = macd(candles, { fast: 12, slow: 26, signal: 9 });
const bb = bollingerBands(candles, { period: 20, stdDev: 2 });

// Show last 5 values
console.log("=== Last 5 bars ===\n");
for (let i = candles.length - 5; i < candles.length; i++) {
  const date = new Date(candles[i].time).toISOString().slice(0, 10);
  console.log(`[${date}] Close: ${candles[i].close.toFixed(2)}`);
  console.log(`  SMA(20): ${sma20[i]?.value?.toFixed(2) ?? "—"}`);
  console.log(`  EMA(12): ${ema12[i]?.value?.toFixed(2) ?? "—"}`);
  console.log(`  RSI(14): ${rsi14[i]?.value?.toFixed(2) ?? "—"}`);

  const m = macdData[i]?.value;
  if (m?.macd != null) {
    console.log(
      `  MACD: ${m.macd.toFixed(4)}  Signal: ${m.signal?.toFixed(4) ?? "—"}  Hist: ${m.histogram?.toFixed(4) ?? "—"}`,
    );
  }

  const b = bb[i]?.value;
  if (b?.upper != null) {
    console.log(`  BB: [${b.lower?.toFixed(2)}, ${b.middle?.toFixed(2)}, ${b.upper.toFixed(2)}]`);
  }
  console.log();
}

console.log("Done! Calculated 5 indicators on 60 candles.");
