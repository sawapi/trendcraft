/**
 * 04 — Stock Screening
 *
 * Screen multiple "stocks" against technical conditions.
 * Run: npx tsx examples/quick-start/04-screening.ts
 */
import { type NormalizedCandle, bollingerBands, rsi, sma } from "../../src";

// Generate synthetic data for multiple stocks
function generateStock(
  name: string,
  startPrice: number,
  drift: number,
  count: number,
): { name: string; candles: NormalizedCandle[] } {
  const candles: NormalizedCandle[] = [];
  let price = startPrice;
  const baseTime = Date.now() - count * 86_400_000;

  for (let i = 0; i < count; i++) {
    const change = drift + (Math.random() - 0.5) * 3;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const volume = Math.floor(500_000 + Math.random() * 500_000);

    candles.push({ time: baseTime + i * 86_400_000, open, high, low, close, volume });
    price = Math.max(close, 10);
  }
  return { name, candles };
}

const stocks = [
  generateStock("AAPL", 180, 0.2, 60),
  generateStock("MSFT", 400, 0.3, 60),
  generateStock("GOOGL", 140, -0.1, 60),
  generateStock("AMZN", 180, 0.15, 60),
  generateStock("NVDA", 800, -0.3, 60),
  generateStock("META", 500, 0.1, 60),
];

// --- Screen: RSI oversold + price above SMA(20) + near lower Bollinger Band ---
console.log("=== Stock Screening Results ===\n");
console.log("Criteria: RSI(14) < 40 AND Price > SMA(20) AND Close < BB Lower + 2%\n");

type ScreenResult = {
  name: string;
  close: number;
  rsi: number;
  sma20: number;
  bbLower: number;
  signal: string;
};

const results: ScreenResult[] = [];

for (const stock of stocks) {
  const { candles } = stock;
  const last = candles.length - 1;

  const rsiData = rsi(candles, { period: 14 });
  const smaData = sma(candles, { period: 20 });
  const bbData = bollingerBands(candles, { period: 20, stdDev: 2 });

  const rsiVal = rsiData[last]?.value;
  const smaVal = smaData[last]?.value;
  const bbVal = bbData[last]?.value;
  const closeVal = candles[last].close;

  if (rsiVal == null || smaVal == null || bbVal?.lower == null) continue;

  const isOversold = rsiVal < 40;
  const aboveSma = closeVal > smaVal;
  const nearLowerBB = closeVal < bbVal.lower * 1.02;

  const signals: string[] = [];
  if (isOversold) signals.push("RSI oversold");
  if (aboveSma) signals.push("Above SMA(20)");
  if (nearLowerBB) signals.push("Near BB lower");

  results.push({
    name: stock.name,
    close: closeVal,
    rsi: rsiVal,
    sma20: smaVal,
    bbLower: bbVal.lower,
    signal: signals.length >= 2 ? signals.join(" + ") : "—",
  });
}

// Print table
console.log(
  `${"Symbol".padEnd(8)}${"Close".padStart(10)}${"RSI".padStart(8)}${"SMA(20)".padStart(10)}${"BB Lower".padStart(10)}  Signal`,
);
console.log("-".repeat(70));

for (const r of results) {
  console.log(
    `${r.name.padEnd(8)}${r.close.toFixed(2).padStart(10)}${r.rsi.toFixed(1).padStart(8)}${r.sma20.toFixed(2).padStart(10)}${r.bbLower.toFixed(2).padStart(10)}  ${r.signal}`,
  );
}

const hits = results.filter((r) => r.signal !== "—");
console.log(`\n${hits.length}/${results.length} stocks match screening criteria.`);
