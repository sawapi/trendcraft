/**
 * 03 — Grid Search Optimization
 *
 * Find optimal RSI thresholds and stop-loss via parameter grid search.
 * Run: npx tsx examples/quick-start/03-optimization.ts
 */
import { type NormalizedCandle, gridSearch, rsiAbove, rsiBelow } from "../../src";

// Generate 300 bars of data with trends
function generateCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = 100;
  const baseTime = Date.now() - count * 86_400_000;

  for (let i = 0; i < count; i++) {
    const cycle = Math.sin((i / count) * Math.PI * 4) * 0.3;
    const change = cycle + (Math.random() - 0.5) * 3;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const volume = Math.floor(500_000 + Math.random() * 500_000);

    candles.push({ time: baseTime + i * 86_400_000, open, high, low, close, volume });
    price = Math.max(close, 20);
  }
  return candles;
}

const candles = generateCandles(300);

// --- Grid Search ---
const result = gridSearch(
  candles,
  // Strategy factory: receives param combination, returns entry/exit conditions
  (params) => ({
    entry: rsiBelow(params.entryThreshold),
    exit: rsiAbove(params.exitThreshold),
    options: {
      capital: 1_000_000,
      stopLoss: params.stopLoss,
      commission: 0,
      commissionRate: 0.1,
    },
  }),
  // Parameter ranges
  [
    { name: "entryThreshold", min: 25, max: 35, step: 5 },
    { name: "exitThreshold", min: 65, max: 75, step: 5 },
    { name: "stopLoss", min: 3, max: 7, step: 2 },
  ],
  // Options
  {
    metric: "sharpe",
    keepAllResults: true,
  },
);

console.log("=== Grid Search Results ===\n");
console.log(`Combinations tested: ${result.totalCombinations}`);
console.log(`Valid combinations:  ${result.validCombinations}\n`);

// Show top 5
const top5 = result.results.slice(0, 5);
top5.forEach((r, i) => {
  console.log(
    `#${i + 1}  Sharpe: ${r.metrics.sharpe.toFixed(3)}  Return: ${r.metrics.returns.toFixed(2)}%  Trades: ${r.metrics.tradeCount}`,
  );
  console.log(
    `    Params: entry RSI<${r.params.entryThreshold}, exit RSI>${r.params.exitThreshold}, SL=${r.params.stopLoss}%`,
  );
});

console.log(
  `\nBest: RSI entry<${result.bestParams.entryThreshold}, exit>${result.bestParams.exitThreshold}, SL=${result.bestParams.stopLoss}%  (Sharpe: ${result.bestScore.toFixed(3)})`,
);
